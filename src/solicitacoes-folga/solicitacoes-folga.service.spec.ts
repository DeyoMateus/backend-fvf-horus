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
