import { jest } from '@test/jest-globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';

function diaIso(deslocamentoDias: number): string {
  const d = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('SolicitacoesFolgaService', () => {
  function criarService(opts?: { sobreposta?: boolean; conflitoNoDia?: string }) {
    const base = {
      id: 'sol-1',
      motoristaId: 'mot-1',
      dataInicio: new Date('2026-11-10T00:00:00Z'),
      dataFim: new Date('2026-11-12T00:00:00Z'),
      status: 'PENDENTE',
    };
    const prisma = {
      motorista: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mot-1',
          nome: 'João da Silva',
          empresaId: 'emp-1',
          status: 'ATIVO',
          excluidoEm: null,
          empresa: { grupoId: 'g1', fusoHorario: 'America/Sao_Paulo' },
        }),
      },
      solicitacaoFolga: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts?.sobreposta ? { id: 'x' } : null),
        findUnique: jest.fn().mockResolvedValue(base),
        create: jest
          .fn()
          .mockImplementation((a: any) => Promise.resolve({ id: 'sol-1', ...a.data })),
        update: jest
          .fn()
          .mockImplementation((a: any) => Promise.resolve({ ...base, ...a.data })),
      },
    } as any;
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) } as any;
    const tenant = {
      verificarMotoristaAtivo: jest.fn().mockResolvedValue(undefined),
      verificarMotoristaNoGrupo: jest.fn().mockResolvedValue(undefined),
    } as any;
    const push = { notificarMotorista: jest.fn().mockResolvedValue(undefined) } as any;
    const whatsapp = {
      notificarGestoresDaEmpresa: jest.fn().mockResolvedValue(undefined),
    } as any;
    const folga = {
      conceder: jest.fn().mockImplementation((_m: string, dto: any) => {
        if (dto.data === opts?.conflitoNoDia) {
          return Promise.reject(new ConflictException('já existe'));
        }
        return Promise.resolve({ id: 'f-' + dto.data });
      }),
    } as any;
    const service = new SolicitacoesFolgaService(
      prisma, audit, tenant, push, whatsapp, folga,
    );
    return { service, prisma, audit, push, whatsapp, folga };
  }

  it('cria pedido de hoje em diante e avisa o RH sem expor observação', async () => {
    const { service, prisma, whatsapp } = criarService();
    await service.criar('mot-1', {
      dataInicio: diaIso(2),
      dataFim: diaIso(4),
      observacao: 'consulta médica',
    });
    expect(prisma.solicitacaoFolga.create).toHaveBeenCalledTimes(1);
    const msg = whatsapp.notificarGestoresDaEmpresa.mock.calls[0][1] as string;
    expect(msg).not.toContain('consulta');
    expect(msg).not.toContain('Silva');
  });

  it('recusa dia que já passou', async () => {
    const { service } = criarService();
    await expect(
      service.criar('mot-1', { dataInicio: diaIso(-3), dataFim: diaIso(-3) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa período maior que 15 dias e fim antes do início', async () => {
    const { service } = criarService();
    await expect(
      service.criar('mot-1', { dataInicio: diaIso(1), dataFim: diaIso(20) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.criar('mot-1', { dataInicio: diaIso(5), dataFim: diaIso(3) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa data impossível', async () => {
    const { service } = criarService();
    await expect(
      service.criar('mot-1', { dataInicio: '2099-02-31', dataFim: '2099-02-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa pedido sobreposto a outro pendente', async () => {
    const { service } = criarService({ sobreposta: true });
    await expect(
      service.criar('mot-1', { dataInicio: diaIso(2), dataFim: diaIso(3) }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aprovar cria uma folga por dia e pula dia que já tinha folga', async () => {
    const { service, folga, push, prisma } = criarService({
      conflitoNoDia: '2026-11-11',
    });
    const r = await service.aprovar('sol-1', 'ok', 'user-1', 'g1');
    expect(folga.conceder).toHaveBeenCalledTimes(3);
    expect(r.status).toBe('APROVADA');
    expect(prisma.solicitacaoFolga.update).toHaveBeenCalledTimes(1);
    expect(push.notificarMotorista).toHaveBeenCalledTimes(1);
  });

  it('negar exige justificativa e não cria folga', async () => {
    const { service, folga, push } = criarService();
    await expect(service.negar('sol-1', '  ', 'user-1', 'g1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const r = await service.negar('sol-1', 'Escala cheia nesses dias', 'user-1', 'g1');
    expect(r.status).toBe('NEGADA');
    expect(folga.conceder).not.toHaveBeenCalled();
    expect(push.notificarMotorista.mock.calls[0][2]).toContain('Escala cheia');
  });

  it('não decide pedido já decidido', async () => {
    const { service, prisma } = criarService();
    prisma.solicitacaoFolga.findUnique.mockResolvedValue({
      id: 'sol-1', motoristaId: 'mot-1', status: 'APROVADA',
      dataInicio: new Date('2026-11-10T00:00:00Z'), dataFim: new Date('2026-11-10T00:00:00Z'),
    });
    await expect(service.aprovar('sol-1', undefined, 'u', 'g1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('SolicitacoesFolgaService , expiração (Rodada 267)', () => {
  function montar(candidatos: any[], updateCount = 1) {
    const prisma = {
      solicitacaoFolga: {
        findMany: jest.fn().mockResolvedValue(candidatos),
        updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
      },
    } as any;
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) } as any;
    const push = { notificarMotorista: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new SolicitacoesFolgaService(
      prisma, audit, {} as any, push, {} as any, {} as any,
    );
    return { service, prisma, audit, push };
  }
  const pedido = (inicio: string, fim = inicio) => ({
    id: 'sol-' + inicio,
    motoristaId: 'mot-1',
    dataInicio: new Date(inicio + 'T00:00:00Z'),
    dataFim: new Date(fim + 'T00:00:00Z'),
    status: 'PENDENTE',
    motorista: {
      id: 'mot-1',
      nome: 'João',
      empresa: { grupoId: 'g1', fusoHorario: 'America/Sao_Paulo' },
    },
  });

  it('nega "não atendido no prazo" quando o primeiro dia pedido já passou', async () => {
    const { service, prisma, audit, push } = montar([pedido('2026-11-10', '2026-11-12')]);
    const n = await service.negarPendentesVencidos(new Date('2026-11-11T15:00:00Z'));
    expect(n).toBe(1);
    const data = prisma.solicitacaoFolga.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('NEGADA');
    expect(data.motivoDecisao).toBe('Não atendido no prazo');
    expect(data.decididoPorUsuarioId).toBeNull();
    expect(audit.registrar.mock.calls[0][0].acao).toBe('SOLICITACAO_FOLGA_NEGADA_AUTOMATICAMENTE');
    expect(push.notificarMotorista).toHaveBeenCalledTimes(1);
  });

  it('não nega enquanto o dia pedido ainda é hoje (fuso da empresa)', async () => {
    const { service, prisma } = montar([pedido('2026-11-10')]);
    // 10/11 às 02:00 UTC ainda é 09/11 à noite no Brasil; 10/11 15:00 UTC é o próprio dia.
    expect(await service.negarPendentesVencidos(new Date('2026-11-10T15:00:00Z'))).toBe(0);
    expect(await service.negarPendentesVencidos(new Date('2026-11-10T02:00:00Z'))).toBe(0);
    expect(prisma.solicitacaoFolga.updateMany).not.toHaveBeenCalled();
  });

  it('não avisa nem audita se o RH decidiu no meio tempo', async () => {
    const { service, audit, push } = montar([pedido('2026-11-10')], 0);
    expect(await service.negarPendentesVencidos(new Date('2026-11-12T15:00:00Z'))).toBe(0);
    expect(audit.registrar).not.toHaveBeenCalled();
    expect(push.notificarMotorista).not.toHaveBeenCalled();
  });
});
