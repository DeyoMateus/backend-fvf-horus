import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Teste de integração real contra o Postgres (não usa mock nenhum) ,
 * confirma que o trigger `trg_registros_jornada_worm` (migration
 * 20260918120000) bloqueia de fato UPDATE e DELETE em `registros_jornada`,
 * mesmo direto via SQL/Prisma, não só através da API.
 *
 * Requer DATABASE_URL apontando pro Postgres de dev (docker-compose.dev.yml
 * , fvf-horus-postgres). Se não conseguir conectar, os testes falham com uma
 * mensagem clara em vez de travar (timeout do Jest).
 */
describe('WORM trigger , registros_jornada e amostras_localizacao (integração real)', () => {
  const prisma = new PrismaClient();
  let empresaId: string;
  let motoristaId: string;
  let registroId: string;
  let amostraId: string;

  beforeAll(async () => {
    await prisma.$connect();
    // Row-Level Security (Rodada 23): este teste usa um PrismaClient
    // cru, fora do PrismaService/NestJS , precisa setar o mesmo
    // sentinela de SISTEMA à mão. Uma única conexão dedicada pro teste
    // inteiro, então um `SET` de sessão (não `SET LOCAL`) já basta.
    await prisma.$executeRawUnsafe("SET app.grupo_atual = '__sistema__'");

    const grupo = await prisma.grupo.create({
      data: { razaoSocial: 'Grupo Teste WORM' },
    });
    const empresa = await prisma.empresa.create({
      data: {
        razaoSocial: 'Empresa Teste WORM',
        cnpj: `TESTE-${randomUUID()}`,
        grupoId: grupo.id,
      },
    });
    empresaId = empresa.id;

    const motorista = await prisma.motorista.create({
      data: {
        nome: 'Motorista Teste WORM',
        cpf: `CPF-${randomUUID()}`,
        cnh: `CNH-${randomUUID()}`,
        empresaId,
        hashGenesis: `GENESIS-${randomUUID()}`,
      },
    });
    motoristaId = motorista.id;

    const registro = await prisma.registroJornada.create({
      data: {
        motoristaId,
        tipoEvento: 'INICIO_JORNADA',
        timestampEvento: new Date(),
        sequencial: 1,
        hashAnterior: motorista.hashGenesis,
        hashAtual: `HASH-${randomUUID()}`,
        deviceUuidUsado: `device-${randomUUID()}`,
      },
    });
    registroId = registro.id;

    // Rodada 35: trigger WORM estendido pra amostras_localizacao
    // (migration 20260929000000) , testa da mesma forma.
    const amostra = await prisma.amostraLocalizacao.create({
      data: {
        motoristaId,
        latitude: -23.5505,
        longitude: -46.6333,
        capturadoEm: new Date(),
      },
    });
    amostraId = amostra.id;
  });

  afterAll(async () => {
    await prisma
      .$executeRawUnsafe(`DELETE FROM "motoristas" WHERE id = $1`, motoristaId)
      .catch(() => {});
    await prisma
      .$executeRawUnsafe(`DELETE FROM "empresas" WHERE id = $1`, empresaId)
      .catch(() => {});
    await prisma.$disconnect();
  });

  it('bloqueia UPDATE em registros_jornada', async () => {
    await expect(
      prisma.registroJornada.update({
        where: { id: registroId },
        data: { observacao: 'adulterado' },
      }),
    ).rejects.toThrow(/bloqueada|WORM/i);
  });

  it('bloqueia DELETE em registros_jornada', async () => {
    await expect(
      prisma.registroJornada.delete({ where: { id: registroId } }),
    ).rejects.toThrow(/bloqueada|WORM/i);
  });

  it('confirma que o registro original segue intacto depois das tentativas', async () => {
    const registro = await prisma.registroJornada.findUniqueOrThrow({
      where: { id: registroId },
    });
    expect(registro.observacao).toBeNull();
  });

  it('bloqueia UPDATE em amostras_localizacao', async () => {
    await expect(
      prisma.amostraLocalizacao.update({
        where: { id: amostraId },
        data: { latitude: 0 },
      }),
    ).rejects.toThrow(/bloqueada|WORM/i);
  });

  it('bloqueia DELETE em amostras_localizacao', async () => {
    await expect(
      prisma.amostraLocalizacao.delete({ where: { id: amostraId } }),
    ).rejects.toThrow(/bloqueada|WORM/i);
  });
});
