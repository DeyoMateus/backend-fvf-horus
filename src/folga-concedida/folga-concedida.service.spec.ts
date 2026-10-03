import { jest } from '@test/jest-globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FolgaConcedidaService } from './folga-concedida.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Regras que este teste protege:
 *  1. Isolamento entre grupos (mesmo padrão de TratamentosPontoService).
 *  2. Conceder uma folga NUNCA cria/apaga/altera um RegistroJornada ,
 *     só levanta um AlertaJornada quando já existe ponto batido no dia
 *     coberto pela folga (ver o comentário da classe no service).
 *  3. `data`/`motoristaId` únicos: uma segunda folga no mesmo dia vira
 *     ConflictException (constraint @@unique do schema), não um crash.
 */
describe('FolgaConcedidaService', () => {
  function criarServiceComMocks(opts: {
    motorista?: { empresaId: string; empresa: { grupoId: string } } | null;
    registrosDoDia?: any[];
    criarLancaP2002?: boolean;
  }) {
    const motorista =
      opts.motorista === undefined
        ? { empresaId: 'empresa-A', empresa: { grupoId: 'grupo-A' } }
        : opts.motorista;
    const motoristaCompleto = motorista && { id: 'motorista-1', ...motorista };

    const folgaCriada = {
      id: 'folga-1',
      motoristaId: 'motorista-1',
      data: new Date('2026-10-01T00:00:00Z'),
    };

    const createFolga = opts.criarLancaP2002
      ? jest
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed',
              { code: 'P2002', clientVersion: 'x' },
            ),
          )
      : jest.fn().mockResolvedValue(folgaCriada);

    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motoristaCompleto) },
      folgaConcedida: {
        create: createFolga,
        findMany: jest.fn().mockResolvedValue([]),
      },
      registroJornada: {
        findMany: jest.fn().mockResolvedValue(opts.registrosDoDia ?? []),
      },
      alertaJornada: {
        create: jest.fn().mockResolvedValue({ id: 'alerta-1' }),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const whatsappMock = {
      notificarGestoresDaEmpresa: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new FolgaConcedidaService(
      prismaMock,
      auditMock,
      tenant,
      whatsappMock,
    );
    return { service, prismaMock };
  }

  it('lança NotFoundException quando o motorista não existe', async () => {
    const { service } = criarServiceComMocks({ motorista: null });
    await expect(
      service.conceder(
        'motorista-x',
        { data: '2026-10-01' },
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança ForbiddenException quando o motorista pertence a uma empresa de outro grupo', async () => {
    const { service } = criarServiceComMocks({
      motorista: { empresaId: 'empresa-B', empresa: { grupoId: 'grupo-B' } },
    });
    await expect(
      service.conceder(
        'motorista-1',
        { data: '2026-10-01' },
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('concede a folga e NÃO levanta alerta quando o dia não tem nenhum ponto batido', async () => {
    const { service, prismaMock } = criarServiceComMocks({
      registrosDoDia: [],
    });
    const folga = await service.conceder(
      'motorista-1',
      { data: '2026-10-01', motivo: 'descanso' },
      'usuario-1',
      'grupo-A',
    );

    expect(folga).toMatchObject({ id: 'folga-1' });
    expect(prismaMock.alertaJornada.create).not.toHaveBeenCalled();
  });

  it('concede a folga SEM apagar nenhum registro e levanta um alerta quando o dia já tem ponto batido', async () => {
    const registrosExistentes = [
      {
        id: 'registro-1',
        sequencial: 1,
        timestampEvento: new Date('2026-10-01T08:00:00Z'),
      },
      {
        id: 'registro-2',
        sequencial: 2,
        timestampEvento: new Date('2026-10-01T18:00:00Z'),
      },
    ];
    const { service, prismaMock } = criarServiceComMocks({
      registrosDoDia: registrosExistentes,
    });

    const folga = await service.conceder(
      'motorista-1',
      { data: '2026-10-01' },
      'usuario-1',
      'grupo-A',
    );

    expect(folga).toMatchObject({ id: 'folga-1' });
    // Nenhuma rota de update/delete existe no mock (nem foi chamada) ,
    // os dois registros continuam intocados, só o alerta é criado.
    expect(prismaMock.alertaJornada.create).toHaveBeenCalledTimes(1);
    const chamada = (prismaMock.alertaJornada.create as jest.Mock).mock
      .calls[0][0] as any;
    expect(chamada.data.tipo).toBe('PONTO_REGISTRADO_EM_DIA_DE_FOLGA');
    expect(chamada.data.registroGeradorId).toBe('registro-1');
    expect(chamada.data.detalhes.registrosConflitantesIds).toEqual([
      'registro-1',
      'registro-2',
    ]);
  });

  it('lança ConflictException ao tentar conceder uma segunda folga no mesmo dia', async () => {
    const { service } = criarServiceComMocks({ criarLancaP2002: true });
    await expect(
      service.conceder(
        'motorista-1',
        { data: '2026-10-01' },
        'usuario-1',
        'grupo-A',
      ),
    ).rejects.toThrow(ConflictException);
  });
});
