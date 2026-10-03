import { jest } from '@test/jest-globals';
import { RegistrosJornadaService } from './registros-jornada.service';
import { JornadaLegalService } from '../common/jornada-legal/jornada-legal.service';

/**
 * Regressão da Rodada 21: `verificarEAgendarProximoMotorista` (usado
 * tanto pelo job da fila agendada quanto pela varredura periódica de
 * segurança) deve, depois de reavaliar os limites, agendar o próximo
 * check via `VerificacaoJornadaAgendadaService` , ou cancelar qualquer
 * job pendente quando não há mais nada em aberto pra esperar.
 */
describe('RegistrosJornadaService , agendamento da próxima verificação (Rodada 21)', () => {
  function criarServiceComMocks(opts: {
    historico: any[];
    ultimoRegistro: any;
    motorista: any;
  }) {
    const alertaJornadaCreateMock = jest.fn().mockResolvedValue({});
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(opts.motorista) },
      registroJornada: {
        findFirst: jest.fn().mockResolvedValue(opts.ultimoRegistro),
        findMany: jest.fn().mockResolvedValue(opts.historico),
      },
      alertaJornada: {
        findMany: jest.fn().mockResolvedValue([]),
        create: alertaJornadaCreateMock,
      },
      // Rodada 93 , ver o mesmo comentário em
      // verificar-jornadas-abertas-proativamente.spec.ts.
      tratamentoPonto: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const pushMock = { notificarMotorista: jest.fn() } as any;
    const whatsappMock = { notificarGestoresDaEmpresa: jest.fn() } as any;
    const verificacaoAgendadaMock = {
      agendar: jest.fn().mockResolvedValue(undefined),
      cancelar: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new RegistrosJornadaService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      auditMock,
      new JornadaLegalService(),
      {} as any,
      pushMock,
      whatsappMock,
      {} as any,
      verificacaoAgendadaMock,
    );
    return {
      service,
      prismaMock,
      auditMock,
      pushMock,
      whatsappMock,
      verificacaoAgendadaMock,
    };
  }

  it('motorista ainda dirigindo (nada atingiu limite crítico) agenda o próximo check com o delay correto', async () => {
    const inicioDirecao = {
      id: 'registro-inicio-direcao',
      motoristaId: 'motorista-1',
      tipoEvento: 'INICIO_DIRECAO',
      timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
      sequencial: 2,
    };
    const historico = [
      {
        id: 'registro-inicio-jornada',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T07:55:00.000Z'),
        sequencial: 1,
      },
      inicioDirecao,
    ];

    const { service, verificacaoAgendadaMock } = criarServiceComMocks({
      historico,
      ultimoRegistro: inicioDirecao,
      motorista: { empresaId: 'empresa-A' },
    });

    // 1h de direção contínua decorrida às 09:00 , faltam 240min (4h)
    // pra ATENCAO de direção contínua (5h), que é o menor dos dois
    // limiares em aberto (o de jornada de direção, 8h, está mais longe).
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T09:00:00.000Z'));
    try {
      await service.verificarEAgendarProximoMotorista('motorista-1');
    } finally {
      jest.useRealTimers();
    }

    expect(verificacaoAgendadaMock.agendar).toHaveBeenCalledWith(
      'motorista-1',
      240 * 60000,
    );
    expect(verificacaoAgendadaMock.cancelar).not.toHaveBeenCalled();
  });

  it('motorista com jornada fechada (FIM_JORNADA) cancela qualquer job pendente em vez de agendar', async () => {
    const fimJornada = {
      id: 'registro-fim-jornada',
      motoristaId: 'motorista-1',
      tipoEvento: 'FIM_JORNADA',
      timestampEvento: new Date('2026-09-22T18:00:00.000Z'),
      sequencial: 3,
    };
    const historico = [
      {
        id: 'registro-inicio-jornada',
        motoristaId: 'motorista-1',
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date('2026-09-22T07:55:00.000Z'),
        sequencial: 1,
      },
      fimJornada,
    ];

    const { service, verificacaoAgendadaMock } = criarServiceComMocks({
      historico,
      ultimoRegistro: fimJornada,
      motorista: { empresaId: 'empresa-A' },
    });

    await service.verificarEAgendarProximoMotorista('motorista-1');

    expect(verificacaoAgendadaMock.cancelar).toHaveBeenCalledWith(
      'motorista-1',
    );
    expect(verificacaoAgendadaMock.agendar).not.toHaveBeenCalled();
  });
});
