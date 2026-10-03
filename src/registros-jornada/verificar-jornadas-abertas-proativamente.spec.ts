import { jest } from '@test/jest-globals';
import { RegistrosJornadaService } from './registros-jornada.service';
import { JornadaLegalService } from '../common/jornada-legal/jornada-legal.service';

/**
 * Regressão da Rodada 19: achado real do usuário , um motorista dirigindo
 * continuamente por 7h30 (bem acima do limite legal de 05:30 de direção
 * contínua) NÃO gerava nenhum alerta, nem para o motorista nem para o
 * gestor. Causa: `avaliarLimitesLegais` só rodava dentro da transação de
 * `create()`, disparado por um evento NOVO , sem nenhum evento novo
 * (motorista que simplesmente não aperta mais nada no app), o motor
 * nunca era chamado. `verificarJornadasAbertasProativamente` cobre esse
 * caso rodando fora de qualquer criação de evento, com "agora" sendo o
 * horário real da varredura.
 *
 * Rodada 20: por pedido do usuário, o cálculo continua só aqui no
 * servidor (não replicado no app, pra não gastar bateria do telefone).
 * O intervalo padrão subiu de 10 pra 30min, e a varredura passou a
 * notificar push/WhatsApp tanto em ATENCAO ("prestes a estourar")
 * quanto em CRITICO ("já estourou") , antes só CRITICO disparava.
 */
describe('RegistrosJornadaService.verificarJornadasAbertasProativamente (Rodada 19)', () => {
  function criarServiceComMocks(opts: {
    jornadasAbertas: { motoristaId: string }[];
    ultimoRegistro: any;
    historico: any[];
    motorista: any;
  }) {
    const alertaJornadaCreateMock = jest.fn().mockResolvedValue({});
    const prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue(opts.jornadasAbertas),
      motorista: { findUnique: jest.fn().mockResolvedValue(opts.motorista) },
      registroJornada: {
        findFirst: jest.fn().mockResolvedValue(opts.ultimoRegistro),
        findMany: jest.fn().mockResolvedValue(opts.historico),
      },
      alertaJornada: {
        findMany: jest.fn().mockResolvedValue([]),
        create: alertaJornadaCreateMock,
      },
      // Rodada 93 , verificarEAgendarProximoMotorista agora confere se
      // existe um ajuste de FIM_JORNADA mais recente que o último
      // registro (ver registros-jornada.service.ts); sem nenhum ajuste
      // nestes testes, retorna null e o fluxo segue como antes.
      tratamentoPonto: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;
    const pushMock = { notificarMotorista: jest.fn() } as any;
    const whatsappMock = { notificarGestoresDaEmpresa: jest.fn() } as any;

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
    );
    return {
      service,
      prismaMock,
      auditMock,
      pushMock,
      whatsappMock,
      alertaJornadaCreateMock,
    };
  }

  it('motorista dirigindo continuamente há 7h30, sem nenhum evento novo, gera alerta CRÍTICO de direção contínua e notifica motorista + gestor', async () => {
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

    const { service, alertaJornadaCreateMock, pushMock, whatsappMock } =
      criarServiceComMocks({
        jornadasAbertas: [{ motoristaId: 'motorista-1' }],
        ultimoRegistro: inicioDirecao,
        historico,
        motorista: { empresaId: 'empresa-A' },
      });

    // Simula a varredura acontecendo 7h30 depois do início da direção ,
    // sem nenhum registro novo desde então.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T15:30:00.000Z'));
    try {
      await service.verificarJornadasAbertasProativamente();
    } finally {
      jest.useRealTimers();
    }

    expect(alertaJornadaCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motoristaId: 'motorista-1',
          tipo: 'DIRECAO_CONTINUA_EXCEDIDA',
          severidade: 'CRITICO',
          registroGeradorId: 'registro-inicio-direcao',
        }),
      }),
    );
    expect(pushMock.notificarMotorista).toHaveBeenCalledWith(
      'motorista-1',
      'Alerta de jornada',
      expect.stringContaining('05:30'),
      expect.objectContaining({ tipo: 'DIRECAO_CONTINUA_EXCEDIDA' }),
    );
    expect(whatsappMock.notificarGestoresDaEmpresa).toHaveBeenCalledWith(
      'empresa-A',
      expect.any(String),
    );
  });

  it('motorista dirigindo há 5h05 (ATENÇÃO, ainda não é CRÍTICO) também notifica motorista + gestor , Rodada 20', async () => {
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

    const { service, alertaJornadaCreateMock, pushMock, whatsappMock } =
      criarServiceComMocks({
        jornadasAbertas: [{ motoristaId: 'motorista-1' }],
        ultimoRegistro: inicioDirecao,
        historico,
        motorista: { empresaId: 'empresa-A' },
      });

    // 5h05 de direção contínua: passou dos 5h de ATENÇÃO, mas ainda não
    // chegou nos 5h30 de CRÍTICO. Antes da Rodada 20 essa varredura só
    // notificava em CRITICO , agora ATENÇÃO também dispara push/WhatsApp,
    // porque o ciclo é de 30 em 30min e esperar virar CRÍTICO pode não
    // dar tempo de reação.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T13:05:00.000Z'));
    try {
      await service.verificarJornadasAbertasProativamente();
    } finally {
      jest.useRealTimers();
    }

    expect(alertaJornadaCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motoristaId: 'motorista-1',
          tipo: 'DIRECAO_CONTINUA_PROXIMA_LIMITE',
          severidade: 'ATENCAO',
        }),
      }),
    );
    expect(pushMock.notificarMotorista).toHaveBeenCalledWith(
      'motorista-1',
      'Alerta de jornada',
      expect.any(String),
      expect.objectContaining({ tipo: 'DIRECAO_CONTINUA_PROXIMA_LIMITE' }),
    );
    expect(whatsappMock.notificarGestoresDaEmpresa).toHaveBeenCalledWith(
      'empresa-A',
      expect.any(String),
    );
  });

  it('motorista com jornada FECHADA (último evento relevante é FIM_JORNADA) nunca entra na varredura', async () => {
    const { service, prismaMock, alertaJornadaCreateMock } =
      criarServiceComMocks({
        jornadasAbertas: [], // a query SQL já filtra por WHERE tipoEvento != 'FIM_JORNADA' , simula que nada veio
        ultimoRegistro: null,
        historico: [],
        motorista: null,
      });

    await service.verificarJornadasAbertasProativamente();

    expect(prismaMock.motorista.findUnique).not.toHaveBeenCalled();
    expect(alertaJornadaCreateMock).not.toHaveBeenCalled();
  });

  it('erro ao avaliar um motorista não impede a varredura de seguir pros demais (fail-open)', async () => {
    const registroValido = {
      id: 'registro-2',
      motoristaId: 'motorista-2',
      tipoEvento: 'INICIO_DIRECAO',
      timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
      sequencial: 1,
    };
    const { service, prismaMock, auditMock } = criarServiceComMocks({
      jornadasAbertas: [
        { motoristaId: 'motorista-1' },
        { motoristaId: 'motorista-2' },
      ],
      ultimoRegistro: registroValido,
      historico: [registroValido],
      motorista: { empresaId: 'empresa-A' },
    });
    // motorista-1 quebra ao buscar o motorista (ex.: erro transitório de rede/DB) ,
    // motorista-2 (chamada seguinte) ainda deve ser avaliado normalmente.
    prismaMock.motorista.findUnique
      .mockRejectedValueOnce(new Error('falha simulada'))
      .mockResolvedValueOnce({ empresaId: 'empresa-A' });

    // Rodada 68 , o método passou a devolver quantos motoristas foram
    // avaliados (antes era void); aqui são os dois da lista, mesmo o
    // primeiro tendo falhado (fail-open: falha em um não tira ele da
    // contagem de "avaliados", só evita que quebre os demais).
    await expect(service.verificarJornadasAbertasProativamente()).resolves.toBe(
      2,
    );

    expect(auditMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'VERIFICACAO_PROATIVA_JORNADA_FALHA',
        entidadeId: 'motorista-1',
      }),
    );
    expect(prismaMock.motorista.findUnique).toHaveBeenCalledTimes(2);
  });
});
