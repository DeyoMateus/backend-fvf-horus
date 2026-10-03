import { jest } from '@test/jest-globals';
import { RegistrosJornadaService } from './registros-jornada.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Regressão da Rodada 16: `consolidarViagens` deixou de agrupar
 * jornadas por gap de tempo (36h, Rodada 2) e passou a agrupar pelo(s)
 * CT-e que o motorista carrega , uma viagem vai do vínculo do 1º CT-e
 * até a entrega do último do grupo, e um CT-e vinculado enquanto ainda
 * há algum em aberto entra na MESMA viagem. Jornada sem nenhum CT-e no
 * período vira viagem avulsa.
 */
describe('RegistrosJornadaService.consolidarViagens , agrupamento por CT-e (Rodada 16)', () => {
  function criarServiceComMocks(registros: any[], documentosCte: any[]) {
    const prismaMock = {
      motorista: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            empresaId: 'empresa-A',
            empresa: { grupoId: 'grupo-A' },
          }),
      },
      registroJornada: {
        findMany: jest.fn().mockResolvedValue(registros),
      },
      documentoCarga: {
        findMany: jest.fn().mockResolvedValue(documentosCte),
      },
    } as any;

    const tenant = new TenantService(prismaMock);
    const service = new RegistrosJornadaService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tenant,
    );
    return { service, prismaMock };
  }

  function jornadaDia(dataBase: string, horaInicio: string, horaFim: string) {
    return [
      {
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date(`${dataBase}T${horaInicio}:00.000Z`),
      },
      {
        tipoEvento: 'FIM_JORNADA',
        timestampEvento: new Date(`${dataBase}T${horaFim}:00.000Z`),
      },
    ];
  }

  it('duas jornadas em dias distintos (sem sobreposição de 36h) entram na MESMA viagem quando cobertas pelo mesmo CT-e', async () => {
    const registros = [
      ...jornadaDia('2026-09-20', '08:00', '18:00'),
      ...jornadaDia('2026-09-23', '08:00', '18:00'),
    ];
    // Gap real entre as duas jornadas é de ~62h (bem maior que o antigo limite de 36h) ,
    // só ficam na mesma viagem porque o CT-e cobre as duas.
    const documentosCte = [
      {
        id: 'cte-1',
        numero: '123',
        createdAt: new Date('2026-09-19T12:00:00.000Z'),
        entregueEm: new Date('2026-09-23T19:00:00.000Z'),
      },
    ];
    const { service } = criarServiceComMocks(registros, documentosCte);

    const viagens = await service.consolidarViagens('motorista-1', 'grupo-A');

    expect(viagens).toHaveLength(1);
    expect(viagens[0].jornadas).toHaveLength(2);
    expect(viagens[0].ctesRelacionados).toEqual([
      { id: 'cte-1', numero: '123' },
    ]);
  });

  it('jornada sem nenhum CT-e vinculado no período vira viagem avulsa', async () => {
    const registros = jornadaDia('2026-09-20', '08:00', '18:00');
    const { service } = criarServiceComMocks(registros, []);

    const viagens = await service.consolidarViagens('motorista-1', 'grupo-A');

    expect(viagens).toHaveLength(1);
    expect(viagens[0].jornadas).toHaveLength(1);
    expect(viagens[0].ctesRelacionados).toEqual([]);
  });

  it('dois CT-e mesclam num único grupo/viagem quando o 2º é vinculado antes do 1º ser entregue', async () => {
    const registros = [
      ...jornadaDia('2026-09-20', '08:00', '18:00'),
      ...jornadaDia('2026-09-22', '08:00', '18:00'),
    ];
    const documentosCte = [
      {
        id: 'cte-1',
        numero: '111',
        createdAt: new Date('2026-09-20T07:00:00.000Z'),
        entregueEm: new Date('2026-09-22T19:00:00.000Z'),
      },
      {
        // Vinculado em 21/09, enquanto o cte-1 ainda estava em aberto (entregue só em 22/09) , mescla no mesmo grupo.
        id: 'cte-2',
        numero: '222',
        createdAt: new Date('2026-09-21T10:00:00.000Z'),
        entregueEm: new Date('2026-09-22T20:00:00.000Z'),
      },
    ];
    const { service } = criarServiceComMocks(registros, documentosCte);

    const viagens = await service.consolidarViagens('motorista-1', 'grupo-A');

    expect(viagens).toHaveLength(1);
    expect(viagens[0].jornadas).toHaveLength(2);
    expect(viagens[0].ctesRelacionados.map((c) => c.numero).sort()).toEqual([
      '111',
      '222',
    ]);
  });

  it('CT-e ainda não entregue (statusCarga em aberto) mantém a viagem "em andamento" mesmo com a última jornada já fechada', async () => {
    const registros = jornadaDia('2026-09-20', '08:00', '18:00');
    const documentosCte = [
      {
        id: 'cte-1',
        numero: '333',
        createdAt: new Date('2026-09-20T07:00:00.000Z'),
        entregueEm: null,
      },
    ];
    const { service } = criarServiceComMocks(registros, documentosCte);

    const viagens = await service.consolidarViagens('motorista-1', 'grupo-A');

    expect(viagens).toHaveLength(1);
    expect(viagens[0].emAndamento).toBe(true);
  });

  it('CT-e vinculado bem depois de outro já ter sido totalmente entregue (sem sobreposição) vira viagem nova', async () => {
    const registros = [
      ...jornadaDia('2026-09-10', '08:00', '18:00'),
      ...jornadaDia('2026-09-20', '08:00', '18:00'),
    ];
    const documentosCte = [
      {
        id: 'cte-1',
        numero: '111',
        createdAt: new Date('2026-09-10T07:00:00.000Z'),
        entregueEm: new Date('2026-09-10T19:00:00.000Z'),
      },
      {
        id: 'cte-2',
        numero: '222',
        createdAt: new Date('2026-09-20T07:00:00.000Z'),
        entregueEm: new Date('2026-09-20T19:00:00.000Z'),
      },
    ];
    const { service } = criarServiceComMocks(registros, documentosCte);

    const viagens = await service.consolidarViagens('motorista-1', 'grupo-A');

    expect(viagens).toHaveLength(2);
    expect(viagens.every((v) => v.jornadas.length === 1)).toBe(true);
  });
});
