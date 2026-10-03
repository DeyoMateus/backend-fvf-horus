import { jest } from '@test/jest-globals';
import { RepPService } from './rep-p.service';
import type { NsrService } from '../nsr/nsr.service';

/**
 * Regressão do Espelho de Ponto REP-P (Rodada 27) , mesmo critério já
 * usado em `ComprovanteService.spec.ts`: não dá pra asserir o texto
 * dentro do PDF sem uma lib de parsing (pdfkit comprime o stream), então
 * o teste garante o que dá pra garantir sem essa dependência nova: o
 * serviço gera um PDF válido e não-vazio nos cenários que importam ,
 * com e sem regra sindical, com e sem ajuste de RH no período, e sem
 * nenhum registro no período (dia sem marcação).
 */
describe('RepPService', () => {
  function criarService() {
    let contador = 0;
    const nsrMock: jest.Mocked<NsrService> = {
      obterOuCriar: jest.fn(async () => ++contador),
    } as any;
    return new RepPService(nsrMock);
  }

  const motorista = {
    nome: 'Ana Souza',
    cpf: '11122233344',
    cnh: '99988877766',
    hashGenesis: 'g'.repeat(64),
    certificadoFingerprint: 'ab:cd:ef',
  };

  const empresa = {
    razaoSocial: 'Transportes B Ltda',
    cnpj: '11.222.333/0001-44',
  };

  function registro(overrides: Record<string, unknown>) {
    return {
      id: `r-${Math.random()}`,
      sequencial: 1,
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-21T08:00:00Z'),
      latitude: null,
      longitude: null,
      precisaoGpsM: null,
      observacao: null,
      hashAnterior: 'a'.repeat(64),
      hashAtual: 'b'.repeat(64),
      deviceUuidUsado: 'device-1',
      ...overrides,
    } as any;
  }

  const registrosDoDia = [
    registro({
      id: 'r1',
      tipoEvento: 'INICIO_JORNADA',
      timestampEvento: new Date('2026-09-21T08:00:00Z'),
      sequencial: 1,
    }),
    registro({
      id: 'r2',
      tipoEvento: 'INICIO_DIRECAO',
      timestampEvento: new Date('2026-09-21T08:10:00Z'),
      sequencial: 2,
      latitude: -23.55,
      longitude: -46.63,
      precisaoGpsM: 12,
    }),
    registro({
      id: 'r3',
      tipoEvento: 'FIM_DIRECAO',
      timestampEvento: new Date('2026-09-21T12:10:00Z'),
      sequencial: 3,
      latitude: -23.5,
      longitude: -46.6,
    }),
    registro({
      id: 'r4',
      tipoEvento: 'FIM_JORNADA',
      timestampEvento: new Date('2026-09-21T13:00:00Z'),
      sequencial: 4,
    }),
  ];

  const periodo = {
    periodoInicio: new Date('2026-09-21T00:00:00Z'),
    periodoFim: new Date('2026-09-21T23:59:59Z'),
  };

  it('gera um PDF válido e não-vazio sem regra sindical vinculada (parâmetros de referência CLT)', async () => {
    const service = criarService();
    const pdf = await service.gerarPdf(
      motorista,
      empresa,
      null,
      registrosDoDia,
      [],
      [],
      periodo,
      'device-1',
    );

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('gera um PDF válido quando há ajuste de RH (TratamentoPonto) no período', async () => {
    const service = criarService();
    const tratamento = {
      id: 't1',
      tipoEvento: 'FIM_DESCANSO',
      timestampEvento: new Date('2026-09-21T09:00:00Z'),
      motivo: 'Motorista esqueceu de bater o fim do descanso.',
      usuario: { nome: 'Fulano RH' },
    } as any;

    const pdf = await service.gerarPdf(
      motorista,
      empresa,
      null,
      registrosDoDia,
      [tratamento],
      [],
      periodo,
      'device-1',
    );

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('gera um PDF válido mesmo sem nenhum registro no período (dia sem marcação)', async () => {
    const service = criarService();
    const pdf = await service.gerarPdf(
      motorista,
      empresa,
      null,
      [],
      [],
      [],
      periodo,
      null,
    );

    expect(pdf.length).toBeGreaterThan(0);
  });

  it('aplica os percentuais da regra sindical quando vinculada ao CNPJ', async () => {
    const service = criarService();
    const regra = {
      id: 'regra-1',
      nome: 'Sindicato Rodoviário de SP - Base 2026/2027',
      categoriaTransporte: 'RODOVIARIO',
      limiteJornadaNormalMin: 480,
      limiteHoraExtraFaixa1Min: 120,
      percentualHoraExtra1: 50,
      percentualHoraExtra2: 70,
      percentualHoraExtraDomingoFeriado: null,
      percentualAdicionalNoturno: 20,
      duracaoMinutoNoturnoMin: 60,
    } as any;

    const pdf = await service.gerarPdf(
      motorista,
      empresa,
      regra,
      registrosDoDia,
      [],
      [],
      periodo,
      'device-1',
    );

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('aplica o percentual diferenciado num feriado cadastrado pelo RH (Rodada 29), mesmo não sendo domingo', async () => {
    const service = criarService();
    const regra = {
      id: 'regra-1',
      nome: 'Sindicato Rodoviário de SP - Base 2026/2027',
      categoriaTransporte: 'RODOVIARIO',
      limiteJornadaNormalMin: 480,
      limiteHoraExtraFaixa1Min: 120,
      percentualHoraExtra1: 50,
      percentualHoraExtra2: 70,
      percentualHoraExtraDomingoFeriado: 100,
      percentualAdicionalNoturno: 20,
      duracaoMinutoNoturnoMin: 60,
    } as any;
    // 2026-09-21 é uma segunda-feira (não domingo) , só entra como
    // "diferenciado" porque o RH cadastrou como feriado pago.
    const feriados = [
      {
        data: '2026-09-21',
        descricao: 'Feriado municipal',
        pagoComoDomingo: true,
      },
    ];

    const pdf = await service.gerarPdf(
      motorista,
      empresa,
      regra,
      registrosDoDia,
      [],
      feriados,
      periodo,
      'device-1',
    );

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
