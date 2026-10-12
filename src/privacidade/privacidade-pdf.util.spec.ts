import { gerarPdfMeusDados, type DadosExportadosMotorista } from './privacidade-pdf.util';

function dadosBase(n = 3): DadosExportadosMotorista {
  const registros = Array.from({ length: n }, (_, i) => ({
    tipoEvento: i % 2 ? 'FIM_DIRECAO' : 'INICIO_DIRECAO',
    timestampEvento: new Date(Date.UTC(2026, 9, 1, 8, i)),
    latitude: -23.55 + i / 1000,
    longitude: -46.63,
    precisaoGpsM: 12.4,
    observacao: i === 0 ? 'Observação com acentuação: ação, coração' : null,
    fusoOffsetMin: -180,
    createdAt: new Date(),
  }));
  return {
    geradoEm: new Date().toISOString(),
    aviso: 'Cópia dos dados pessoais.',
    cadastro: {
      nome: 'João da Silva',
      cpf: '123.456.789-00',
      cnh: '12345678900',
      telefone: '11999999999',
      status: 'ATIVO',
      createdAt: new Date(),
      empresa: { razaoSocial: 'Transportadora Teste Ltda', cnpj: '00.000.000/0001-00' },
    },
    registrosDeJornada: registros,
    amostrasDeLocalizacao: [
      { latitude: -23.5, longitude: -46.6, precisaoGpsM: 8, capturadoEm: new Date() },
    ],
    ajustesDePonto: [
      { tipoEvento: 'FIM_JORNADA', timestampEvento: new Date(), motivo: 'Esqueceu de encerrar', createdAt: new Date() },
    ],
    solicitacoesDeAjuste: [],
    alertas: [{ severidade: 'CRITICO', mensagem: 'Direção contínua excedida', createdAt: new Date() }],
    cienciasDePrivacidade: [
      { tipoDocumento: 'POLITICA_PRIVACIDADE', versao: '2026-10-13', aceitoEm: new Date() },
    ],
    pedidosDoTitular: [
      { tipo: 'ACESSO', status: 'ATENDIDA', createdAt: new Date(), prazoEm: new Date(), resposta: 'Atendido.' },
    ],
  };
}

describe('gerarPdfMeusDados', () => {
  it('gera um PDF válido com dados completos', async () => {
    const pdf = await gerarPdfMeusDados(dadosBase());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it('não quebra com listas vazias e sem cadastro', async () => {
    const d = dadosBase(0);
    d.cadastro = null;
    d.amostrasDeLocalizacao = [];
    d.ajustesDePonto = [];
    d.alertas = [];
    d.cienciasDePrivacidade = [];
    d.pedidosDoTitular = [];
    const pdf = await gerarPdfMeusDados(d);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('pagina volumes grandes e limita as linhas', async () => {
    const pdf = await gerarPdfMeusDados(dadosBase(3500));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 60000);
});
