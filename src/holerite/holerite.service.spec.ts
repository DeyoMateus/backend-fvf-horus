import { jest } from '@test/jest-globals';
import { ForbiddenException } from '@nestjs/common';
import { HoleriteService } from './holerite.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Cobre o núcleo do cálculo do holerite: pareamento de intervalos
 * (direção/espera), split normal x extra (limiar de 8h/dia) e adicional
 * noturno (22h-5h) , inclusive combinando RegistroJornada real com
 * TratamentoPonto (fechamento do gestor), que é o motivo de existir
 * desta feature (Rodada 26).
 */
describe('HoleriteService', () => {
  function criarService(
    motorista: {
      empresaId: string;
      empresa: { grupoId: string; fusoHorario?: string };
    } | null,
  ) {
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      registroJornada: { findMany: jest.fn().mockResolvedValue([]) },
      tratamentoPonto: { findMany: jest.fn().mockResolvedValue([]) },
      // Rodada 146: só é consultada quando há troca de fuso entre os pontos.
      amostraLocalizacao: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const tenant = new TenantService(prismaMock);
    const service = new HoleriteService(prismaMock, tenant);
    return { service, prismaMock };
  }

  const opcoesTudo = {
    direcaoEspera: true,
    normalExtra: true,
    adicionalNoturno: true,
  };

  it('lança ForbiddenException quando o motorista pertence a outro grupo', async () => {
    const { service } = criarService({
      empresaId: 'empresa-B',
      empresa: { grupoId: 'grupo-B' },
    });
    await expect(
      service.calcular(
        'motorista-1',
        new Date('2026-09-01'),
        new Date('2026-09-02'),
        opcoesTudo,
        'grupo-A',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('soma direção normal (até 8h) sem gerar hora extra num dia de 6h de direção', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T10:00:00Z'),
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-10T16:00:00Z'),
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T23:59:59Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias).toHaveLength(1);
    expect(resultado.dias[0].direcaoMin).toBe(360);
    expect(resultado.dias[0].normalMin).toBe(360);
    expect(resultado.dias[0].extraMin).toBe(0);
    expect(resultado.dias[0].teveFechamentoGestor).toBe(false);
  });

  it('separa hora extra quando a direção do dia passa de 8h', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T08:00:00Z'),
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-10T18:00:00Z'),
        tipoEvento: 'FIM_DIRECAO',
      }, // 10h
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T23:59:59Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias[0].direcaoMin).toBe(600);
    expect(resultado.dias[0].normalMin).toBe(480);
    expect(resultado.dias[0].extraMin).toBe(120);
  });

  // Rodada 144: dia de trabalho e janela noturna em horário de Brasília
  // (UTC-3 fixo). 21h BRT = 00:00Z do dia seguinte.
  it('calcula adicional noturno só na parte do intervalo dentro de 22h-5h (horário de Brasília)', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    // Dirige das 21h às 23h BRT (1h fora da janela noturna + 1h dentro).
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-11T00:00:00Z'), // 21:00 BRT de 10/09
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-11T02:00:00Z'), // 23:00 BRT de 10/09
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T00:00:00Z'), // "só data" = dia 10 inteiro em BRT
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias).toHaveLength(1);
    expect(resultado.dias[0].dia).toBe('2026-09-10');
    expect(resultado.dias[0].direcaoMin).toBe(120);
    expect(resultado.dias[0].noturnoMin).toBe(60);
  });

  it('não conta como noturno um trecho das 18h às 20h BRT (que seria 22h-24h em UTC)', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T21:00:00Z'), // 18:00 BRT
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-10T23:00:00Z'), // 20:00 BRT
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias[0].direcaoMin).toBe(120);
    expect(resultado.dias[0].noturnoMin).toBe(0);
  });

  it('divide um trecho que cruza a meia-noite de Brasília (23h BRT às 02h BRT) em dois dias civis', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-11T02:00:00Z'), // 23:00 BRT de 10/09
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-11T05:00:00Z'), // 02:00 BRT de 11/09
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-11T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias.map((d) => d.dia)).toEqual([
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(resultado.dias[0].direcaoMin).toBe(60); // 23h-24h BRT
    expect(resultado.dias[1].direcaoMin).toBe(120); // 00h-02h BRT
    expect(resultado.dias[0].noturnoMin).toBe(60);
    expect(resultado.dias[1].noturnoMin).toBe(120);
  });

  // Rodada 146: a hora noturna e o dia seguem o fuso em que o motorista
  // ESTÁ; a duração é sempre a diferença entre instantes.
  it('motorista em Cuiabá (UTC-4): 21h-23h locais = 60 min noturnos (em Brasília seriam 120)', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-11T01:00:00Z'), // 21:00 em Cuiabá
        tipoEvento: 'INICIO_DIRECAO',
        fusoOffsetMin: -240,
      },
      {
        timestampEvento: new Date('2026-09-11T03:00:00Z'), // 23:00 em Cuiabá
        tipoEvento: 'FIM_DIRECAO',
        fusoOffsetMin: -240,
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-11T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias).toHaveLength(1);
    expect(resultado.dias[0].dia).toBe('2026-09-10');
    expect(resultado.dias[0].direcaoMin).toBe(120);
    expect(resultado.dias[0].noturnoMin).toBe(60);
    expect(prismaMock.amostraLocalizacao.findMany).not.toHaveBeenCalled();
  });

  it('viagem MT -> SP: 11h reais, sem hora fantasma nem hora faltando', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T12:00:00Z'), // 08:00 em Cuiabá
        tipoEvento: 'INICIO_DIRECAO',
        fusoOffsetMin: -240,
      },
      {
        timestampEvento: new Date('2026-09-10T23:00:00Z'), // 20:00 em São Paulo
        tipoEvento: 'FIM_DIRECAO',
        fusoOffsetMin: -180,
      },
    ]);
    prismaMock.amostraLocalizacao.findMany.mockResolvedValue([
      { capturadoEm: new Date('2026-09-10T15:00:00Z'), longitude: -55.0 },
      { capturadoEm: new Date('2026-09-10T18:00:00Z'), longitude: -50.0 },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias).toHaveLength(1);
    expect(resultado.dias[0].direcaoMin).toBe(11 * 60);
    expect(resultado.dias[0].noturnoMin).toBe(0);
  });

  it('viagem MT -> SP de madrugada: noturno pela parede de cada fuso e dia certo (8h reais)', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T22:00:00Z'), // 18:00 em Cuiabá
        tipoEvento: 'INICIO_DIRECAO',
        fusoOffsetMin: -240,
      },
      {
        timestampEvento: new Date('2026-09-11T06:00:00Z'), // 03:00 em São Paulo
        tipoEvento: 'FIM_DIRECAO',
        fusoOffsetMin: -180,
      },
    ]);
    // O fuso muda às 01:00Z (cruzou a divisa)
    prismaMock.amostraLocalizacao.findMany.mockResolvedValue([
      { capturadoEm: new Date('2026-09-11T01:00:00Z'), longitude: -50.0 },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-11T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.totais.direcaoMin).toBe(8 * 60);
    expect(resultado.totais.noturnoMin).toBe(5 * 60);
    expect(resultado.dias.map((d) => [d.dia, d.direcaoMin, d.noturnoMin])).toEqual([
      ['2026-09-10', 300, 120], // 18-21h em MT (0 noturno) + 22h-24h em SP (120)
      ['2026-09-11', 180, 180], // 00h-03h em SP
    ]);
  });

  it('registros sem fuso (app antigo) se comportam exatamente como antes: Brasília', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-11T01:00:00Z'), // 22:00 BRT
        tipoEvento: 'INICIO_DIRECAO',
      },
      {
        timestampEvento: new Date('2026-09-11T03:00:00Z'), // 00:00 BRT
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-11T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias[0].dia).toBe('2026-09-10');
    expect(resultado.dias[0].direcaoMin).toBe(120);
    expect(resultado.dias[0].noturnoMin).toBe(120);
  });

  it('período "só data" cobre o dia BRT inteiro: evento às 22h BRT do último dia entra', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([]);

    await service.calcular(
      'motorista-1',
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-09-30T00:00:00Z'),
      opcoesTudo,
      'grupo-A',
    );

    const where = prismaMock.registroJornada.findMany.mock.calls[0][0].where;
    expect(where.timestampEvento.gte).toEqual(new Date('2026-09-01T03:00:00.000Z'));
    expect(where.timestampEvento.lte).toEqual(new Date('2026-10-01T02:59:59.999Z'));
  });

  it('inclui um fechamento de ponto do gestor (TratamentoPonto) nas horas do dia e marca a flag', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    // Motorista bateu o início mas esqueceu o fim , gestor fechou com um TratamentoPonto de FIM_DIRECAO.
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T08:00:00Z'),
        tipoEvento: 'INICIO_DIRECAO',
      },
    ]);
    prismaMock.tratamentoPonto.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T12:00:00Z'),
        tipoEvento: 'FIM_DIRECAO',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T23:59:59Z'),
      opcoesTudo,
      'grupo-A',
    );

    expect(resultado.dias[0].direcaoMin).toBe(240);
    expect(resultado.dias[0].teveFechamentoGestor).toBe(true);
  });

  /**
   * Regressão real (pedido do usuário): um "ESPERA_CARGA_DESCARGA" sem
   * o "fim" correspondente (esquecido em teste, ou possível na
   * operação real) era estendido, sem limite, até o fim do período do
   * relatório , "mês corrente até hoje" pode significar dias/semanas
   * depois do início esquecido, inflando o total de espera pra valores
   * completamente irreais (ex.: "26:00" de espera num teste que não
   * chegou a esperar nem perto disso, mesmo depois de uma 1ª correção
   * que só limitava a 24h , ainda errado, só "menos errado"). A
   * correção definitiva: um trecho em aberto (sem fim verificado) não
   * é dado confiável pra um relatório de fechamento , não entra nos
   * totais até ser fechado (pelo próprio motorista ou, se ele
   * esqueceu, pelo gestor via TratamentoPonto , fluxo que já existe).
   */
  it('um trecho de espera em aberto (sem "fim" no período) não entra nos totais', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    // Início da espera num teste; nunca foi batido o "Fim de espera" ,
    // o período do relatório só termina bem mais tarde ("hoje").
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T08:00:00Z'),
        tipoEvento: 'ESPERA_CARGA_DESCARGA',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-09-15T00:00:00Z'), // período termina dias depois do início esquecido
      opcoesTudo,
      'grupo-A',
    );

    const totalEsperaMin = resultado.dias.reduce(
      (acc, d) => acc + d.esperaMin,
      0,
    );
    expect(totalEsperaMin).toBe(0); // não fechado, não conta , nem parcialmente
  });

  it('um trecho de espera em aberto some dos totais, mas volta a contar assim que o gestor fecha manualmente (TratamentoPonto)', async () => {
    const { service, prismaMock } = criarService({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    prismaMock.registroJornada.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T08:00:00Z'),
        tipoEvento: 'ESPERA_CARGA_DESCARGA',
      },
    ]);
    prismaMock.tratamentoPonto.findMany.mockResolvedValue([
      {
        timestampEvento: new Date('2026-09-10T09:30:00Z'),
        tipoEvento: 'FIM_ESPERA_CARGA_DESCARGA',
      },
    ]);

    const resultado = await service.calcular(
      'motorista-1',
      new Date('2026-09-10T00:00:00Z'),
      new Date('2026-09-10T23:59:59Z'),
      opcoesTudo,
      'grupo-A',
    );

    const totalEsperaMin = resultado.dias.reduce(
      (acc, d) => acc + d.esperaMin,
      0,
    );
    expect(totalEsperaMin).toBe(90); // 1h30, fechado de verdade pelo gestor
  });

  /**
   * Fechamento em lote (Rodada 36) , "janela de fechamento" do gestor:
   * fechar um conjunto de motoristas ou a frota inteira num PDF só.
   * Cobre a resolução da lista (todos ativos do grupo x lista
   * explícita) e a conferência de tenant sobre os ids pedidos , nunca
   * ignorar silenciosamente um id de outro grupo.
   */
  describe('calcularEmLote', () => {
    function criarServiceLote(
      motoristas: Array<{
        id: string;
        nome: string;
        cpf: string;
        cnh: string;
        empresa: { razaoSocial: string; cnpj: string };
      }>,
    ) {
      const prismaMock = {
        motorista: {
          findMany: jest.fn().mockResolvedValue(motoristas),
          findUnique: jest.fn(async ({ where }: any) => {
            const m = motoristas.find((x) => x.id === where.id);
            return m
              ? {
                  empresaId: 'empresa-A',
                  empresa: { grupoId: 'grupo-A', regraSindical: null },
                }
              : null;
          }),
        },
        registroJornada: { findMany: jest.fn().mockResolvedValue([]) },
        tratamentoPonto: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const tenant = new TenantService(prismaMock);
      const service = new HoleriteService(prismaMock, tenant);
      return { service, prismaMock };
    }

    const motoristasFrota = [
      {
        id: 'm1',
        nome: 'Ana',
        cpf: '111',
        cnh: 'a1',
        empresa: { razaoSocial: 'Transp A', cnpj: '1' },
      },
      {
        id: 'm2',
        nome: 'Bruno',
        cpf: '222',
        cnh: 'a2',
        empresa: { razaoSocial: 'Transp A', cnpj: '1' },
      },
    ];

    it('sem motoristaIds, calcula para todos os motoristas ativos do grupo (fechamento da frota)', async () => {
      const { service, prismaMock } = criarServiceLote(motoristasFrota);
      const itens = await service.calcularEmLote(
        null,
        new Date('2026-09-01'),
        new Date('2026-09-30'),
        opcoesTudo,
        'grupo-A',
      );

      expect(prismaMock.motorista.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ id: expect.anything() }),
        }),
      );
      expect(itens).toHaveLength(2);
      expect(itens.map((i) => i.motorista.nome)).toEqual(['Ana', 'Bruno']);
    });

    it('com motoristaIds, filtra só os pedidos', async () => {
      const { service, prismaMock } = criarServiceLote([motoristasFrota[0]]);
      const itens = await service.calcularEmLote(
        ['m1'],
        new Date('2026-09-01'),
        new Date('2026-09-30'),
        opcoesTudo,
        'grupo-A',
      );

      expect(prismaMock.motorista.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['m1'] } }),
        }),
      );
      expect(itens).toHaveLength(1);
    });

    it('lança ForbiddenException se algum motoristaId pedido não pertence ao grupo (não ignora silenciosamente)', async () => {
      // O grupo só tem o m1; m2 foi pedido mas não volta na consulta (findMany já filtra por grupoId).
      const { service } = criarServiceLote([motoristasFrota[0]]);
      await expect(
        service.calcularEmLote(
          ['m1', 'm2'],
          new Date('2026-09-01'),
          new Date('2026-09-30'),
          opcoesTudo,
          'grupo-A',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
