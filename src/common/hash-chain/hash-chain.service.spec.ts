import { HashChainService } from './hash-chain.service';

describe('HashChainService', () => {
  const service = new HashChainService();

  it('gera o mesmo hash para o mesmo payload canônico (determinístico)', () => {
    const payload = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: '2026-09-18T08:00:00.000Z',
      sequencial: 1,
      deviceUuidUsado: 'device-1',
    };
    const h1 = service.calcularHash('GENESIS', 1, payload);
    const h2 = service.calcularHash('GENESIS', 1, payload);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('gera hashes diferentes quando qualquer campo do payload muda', () => {
    const base = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: '2026-09-18T08:00:00.000Z',
      sequencial: 1,
      deviceUuidUsado: 'device-1',
    };
    const h1 = service.calcularHash('GENESIS', 1, base);
    const h2 = service.calcularHash('GENESIS', 1, {
      ...base,
      observacao: 'mudou',
    });
    expect(h1).not.toBe(h2);
  });

  /**
   * Regressão da Rodada 59: a remoção do campo "odometro" da tela de
   * registro de ponto ficou, por um momento, hardcoded como `null` dentro
   * de `canonicalizar` , o que quebrava a verificação de integridade de
   * qualquer registro ANTIGO que tivesse odômetro preenchido, mesmo sem
   * nenhuma adulteração real. O campo não é mais coletado em registros
   * novos, mas o hash SEMPRE precisa refletir o valor real que estava no
   * registro no momento em que o hash foi calculado , este teste garante
   * que isso nunca regride de novo.
   */
  it('o valor de odômetro de um registro antigo continua entrando no cálculo do hash (não pode ser ignorado/fixado)', () => {
    const base = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: '2026-09-18T08:00:00.000Z',
      sequencial: 1,
      deviceUuidUsado: 'device-1',
    };
    const h1 = service.calcularHash('GENESIS', 1, {
      ...base,
      odometro: 100000,
    });
    const h2 = service.calcularHash('GENESIS', 1, {
      ...base,
      odometro: 100050,
    });
    expect(h1).not.toBe(h2);
  });

  it('valida uma cadeia íntegra', () => {
    const hashGenesis = service.gerarHashGenesis({
      empresaId: 'e1',
      cpf: '11111111111',
      cnh: 'AAA111',
    });

    const evento1 = {
      motoristaId: 'm1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-18T08:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 1,
      deviceUuidUsado: 'device-1',
    };
    const hashAtual1 = service.calcularHash(hashGenesis, 1, evento1);

    const evento2 = {
      motoristaId: 'm1',
      tipoEvento: 'FIM_JORNADA',
      timestampEvento: new Date('2026-09-18T18:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 2,
      deviceUuidUsado: 'device-1',
    };
    const hashAtual2 = service.calcularHash(hashAtual1, 2, evento2);

    const registros = [
      { ...evento1, hashAnterior: hashGenesis, hashAtual: hashAtual1 },
      { ...evento2, hashAnterior: hashAtual1, hashAtual: hashAtual2 },
    ];

    const resultado = service.verificarCadeia(hashGenesis, registros);
    expect(resultado.valido).toBe(true);
    expect(resultado.totalRegistros).toBe(2);
  });

  it('detecta adulteração de um evento no meio da cadeia', () => {
    const hashGenesis = service.gerarHashGenesis({
      empresaId: 'e1',
      cpf: '22222222222',
      cnh: 'BBB222',
    });

    const evento1 = {
      motoristaId: 'm2',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-18T08:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 1,
      deviceUuidUsado: 'device-2',
    };
    const hashAtual1 = service.calcularHash(hashGenesis, 1, evento1);

    const registros = [
      // observação adulterada depois do fato, sem recalcular o hash , deve ser detectado.
      {
        ...evento1,
        observacao: 'adulterado',
        hashAnterior: hashGenesis,
        hashAtual: hashAtual1,
      },
    ];

    const resultado = service.verificarCadeia(hashGenesis, registros);
    expect(resultado.valido).toBe(false);
    expect(resultado.primeiraQuebraSequencial).toBe(1);
  });

  /**
   * Regressão de um bug real encontrado em produção: `latitude`/`longitude`
   * são `Decimal` no Postgres, e o Prisma devolve colunas `Decimal` como
   * um objeto (não um `number` puro) quando lidas de volta do banco , mas
   * na CRIAÇÃO do registro, o valor vem do DTO já como `number`. Antes da
   * correção, `canonicalizar` serializava esses dois tipos de forma
   * diferente no JSON (`-23.55` vs `"-23.5500000"`), então TODO registro
   * com GPS reprovava a verificação de integridade mesmo sem nenhuma
   * adulteração real. Este teste simula exatamente essa diferença de tipo
   * (um objeto com `toString`/`valueOf`, como o `Prisma.Decimal` da lib
   * decimal.js) e garante que `paraNumero` normaliza os dois pro mesmo
   * valor antes de entrar no hash.
   */
  it('não acusa falso positivo quando latitude/longitude voltam como objeto Decimal do Prisma em vez de number puro', () => {
    const hashGenesis = service.gerarHashGenesis({
      empresaId: 'e1',
      cpf: '44444444444',
      cnh: 'DDD444',
    });

    // Como se fosse o DTO na criação: latitude/longitude já como number.
    const eventoNaCriacao = {
      motoristaId: 'm4',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-18T08:00:00.000Z'),
      latitude: -23.55,
      longitude: -46.6333,
      precisaoGpsM: 5,
      odometro: null,
      observacao: null,
      sequencial: 1,
      deviceUuidUsado: 'device-4',
    };
    const hashAtual1 = service.calcularHash(hashGenesis, 1, eventoNaCriacao);

    // Objeto que imita um Prisma.Decimal: mesmo valor numérico, mas
    // serializa como STRING com zeros de padding (igual ao Decimal(10,7)
    // do schema), do jeito que volta de fato numa leitura do banco.
    class DecimalFalso {
      constructor(
        private valor: number,
        private texto: string,
      ) {}
      toString() {
        return this.texto;
      }
      valueOf() {
        return this.texto;
      }
      toJSON() {
        return this.texto;
      }
    }

    const eventoNaVerificacao = {
      ...eventoNaCriacao,
      latitude: new DecimalFalso(-23.55, '-23.5500000') as unknown as number,
      longitude: new DecimalFalso(-46.6333, '-46.6333000') as unknown as number,
      hashAnterior: hashGenesis,
      hashAtual: hashAtual1,
    };

    const resultado = service.verificarCadeia(hashGenesis, [
      eventoNaVerificacao,
    ]);
    expect(resultado.valido).toBe(true);
    expect(resultado.motivo).toBeUndefined();
  });

  it('detecta a remoção de um registro no meio da cadeia (quebra o encadeamento hashAnterior)', () => {
    const hashGenesis = service.gerarHashGenesis({
      empresaId: 'e1',
      cpf: '33333333333',
      cnh: 'CCC333',
    });

    const evento1 = {
      motoristaId: 'm3',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-18T08:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 1,
      deviceUuidUsado: 'device-3',
    };
    const hashAtual1 = service.calcularHash(hashGenesis, 1, evento1);

    const evento2 = {
      motoristaId: 'm3',
      tipoEvento: 'PAUSA_INICIO',
      timestampEvento: new Date('2026-09-18T10:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 2,
      deviceUuidUsado: 'device-3',
    };
    const hashAtual2 = service.calcularHash(hashAtual1, 2, evento2);

    const evento3 = {
      motoristaId: 'm3',
      tipoEvento: 'FIM_JORNADA',
      timestampEvento: new Date('2026-09-18T18:00:00.000Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      odometro: null,
      observacao: null,
      sequencial: 3,
      deviceUuidUsado: 'device-3',
    };
    const hashAtual3 = service.calcularHash(hashAtual2, 3, evento3);

    // Registro 2 (sequencial=2) removido da lista, simulando alguém
    // deletando uma linha direto no banco (se o trigger WORM não existisse).
    const registrosComBuraco = [
      { ...evento1, hashAnterior: hashGenesis, hashAtual: hashAtual1 },
      { ...evento3, hashAnterior: hashAtual2, hashAtual: hashAtual3 },
    ];

    const resultado = service.verificarCadeia(hashGenesis, registrosComBuraco);
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toMatch(/hashAnterior/i);
  });
});
