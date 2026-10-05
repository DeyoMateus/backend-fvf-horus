import { jest } from '@test/jest-globals';
import { RegistrosJornadaService } from './registros-jornada.service';
import { TenantService } from '../common/tenant/tenant.service';

/**
 * Regressão: registros de jornada precisam ser listados/consolidados
 * por `timestampEvento` (o horário real do evento, informado pelo
 * aparelho), NUNCA só por `sequencial` (a ordem de chegada ao
 * servidor) , o app é offline-first, então um evento mais antigo pode
 * chegar ao backend DEPOIS de um mais novo (reconexão, retry, fila
 * local). `sequencial` continua correto e intocado nos dois lugares
 * onde ele decide a cadeia de hash de verdade (`create`, ao calcular o
 * próximo elo, e `verificarIntegridade`, ao recalcular a cadeia) , só
 * os caminhos de LEITURA/exibição foram corrigidos para priorizar o
 * horário real do evento.
 */
describe('RegistrosJornadaService , ordenação por timestampEvento, não por chegada ao servidor', () => {
  function criarServiceComPrismaMock(
    motorista: { empresaId: string; empresa: { grupoId: string } } | null,
  ) {
    const prismaMock = {
      motorista: { findUnique: jest.fn().mockResolvedValue(motorista) },
      registroJornada: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
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

  const ORDER_POR_HORARIO_REAL = [
    { timestampEvento: 'asc' },
    { sequencial: 'asc' },
  ];

  it('listByMotorista pede ao Prisma ordenar por timestampEvento (com sequencial só como desempate)', async () => {
    const { service, prismaMock } = criarServiceComPrismaMock({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    await service.listByMotorista('motorista-1', 'grupo-A');
    expect(prismaMock.registroJornada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: ORDER_POR_HORARIO_REAL }),
    );
  });

  it('consolidarViagens pede ao Prisma ordenar por timestampEvento (com sequencial só como desempate)', async () => {
    const { service, prismaMock } = criarServiceComPrismaMock({
      empresaId: 'empresa-A',
      empresa: { grupoId: 'grupo-A' },
    });
    await service.consolidarViagens('motorista-1', 'grupo-A');
    expect(prismaMock.registroJornada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: ORDER_POR_HORARIO_REAL }),
    );
  });

  it('listByMotoristaNoPeriodo pede ao Prisma ordenar por timestampEvento (com sequencial só como desempate)', async () => {
    const { service, prismaMock } = criarServiceComPrismaMock(null);
    service.listByMotoristaNoPeriodo('motorista-1');
    expect(prismaMock.registroJornada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: ORDER_POR_HORARIO_REAL }),
    );
  });

  it('verificarIntegridade continua ordenando só por sequencial , é a ordem real da cadeia de hash, não pode mudar', async () => {
    const prismaMock = {
      motorista: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'motorista-1',
          empresaId: 'empresa-A',
          empresa: { grupoId: 'grupo-A' },
          hashGenesis: 'genesis-x',
          certificadoPfxEnc: Buffer.from('pfx'),
          certificadoIv: 'iv',
          certificadoAuthTag: 'tag',
          certificadoFingerprint: 'fp-real',
        }),
      },
      registroJornada: { findMany: jest.fn().mockResolvedValue([]) },
      // Rodada 125: divergências já aceitas saem da lista.
      integridadeAceite: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const tenant = new TenantService(prismaMock);
    const hashChainMock = {
      verificarCadeia: jest
        .fn()
        .mockReturnValue({ valido: true, totalRegistros: 0, quebras: [] }),
    } as any;
    const cryptoMock = {
      decrypt: jest.fn().mockReturnValue(Buffer.from('pfx-decifrado')),
    } as any;
    const certificadosMock = {
      decodificar: jest
        .fn()
        .mockReturnValue({ certificadoPem: 'pem', fingerprint: 'fp-real' }),
    } as any;
    const auditMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new RegistrosJornadaService(
      prismaMock,
      hashChainMock,
      cryptoMock,
      certificadosMock,
      {} as any,
      auditMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tenant,
    );

    await service.verificarIntegridade('motorista-1', 'usuario-1', 'grupo-A');
    expect(prismaMock.registroJornada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sequencial: 'asc' } }),
    );
  });
});
