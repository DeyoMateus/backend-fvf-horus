import PDFDocument from 'pdfkit';
import {
  instanteDoCliente,
  instanteDoEvento,
} from '../common/fuso/fuso-contexto';

/**
 * Rodada 218: a cópia dos dados do titular (LGPD art. 18, II e V) em PDF
 * formal, em vez de JSON cru. O JSON continua disponível na rota
 * `meus-dados` (portabilidade em formato estruturado); o PDF é o formato
 * legível para o motorista guardar, imprimir ou mostrar a terceiros.
 */

type Linha = Record<string, unknown>;

export interface DadosExportadosMotorista {
  geradoEm: string;
  aviso: string;
  cadastro: Linha | null;
  registrosDeJornada: Linha[];
  amostrasDeLocalizacao: Linha[];
  ajustesDePonto: Linha[];
  solicitacoesDeAjuste: Linha[];
  alertas: Linha[];
  cienciasDePrivacidade: Linha[];
  pedidosDoTitular: Linha[];
}

/** O PDF lista no máximo isto por tabela; o total real aparece no cabeçalho da seção. */
export const LIMITE_LINHAS_PDF = {
  registros: 3000,
  amostras: 500,
  demais: 500,
};

const ROTULO_EVENTO: Record<string, string> = {
  INICIO_JORNADA: 'Início de jornada',
  INICIO_DESCANSO: 'Início de descanso',
  FIM_DESCANSO: 'Fim de descanso',
  INICIO_DIRECAO: 'Início de direção',
  FIM_DIRECAO: 'Fim de direção',
  ESPERA_CARGA_DESCARGA: 'Início de espera (carga/descarga)',
  FIM_ESPERA_CARGA_DESCARGA: 'Fim de espera (carga/descarga)',
  FIM_DESCARREGAMENTO: 'Fim de descarregamento',
  FIM_JORNADA: 'Fim de jornada',
  OUTRO: 'Outro',
};

const ROTULO_TIPO_PEDIDO: Record<string, string> = {
  CONFIRMACAO_TRATAMENTO: 'Confirmação de tratamento',
  ACESSO: 'Acesso aos dados',
  CORRECAO: 'Correção de dados',
  ANONIMIZACAO_ELIMINACAO: 'Anonimização ou eliminação',
  PORTABILIDADE: 'Portabilidade',
  INFORMACAO_COMPARTILHAMENTO: 'Informação sobre compartilhamento',
  REVOGACAO_CONSENTIMENTO: 'Revogação de consentimento',
  REVISAO_DECISAO_AUTOMATIZADA: 'Revisão de decisão automatizada',
  OPOSICAO: 'Oposição ao tratamento',
};

const ROTULO_STATUS_PEDIDO: Record<string, string> = {
  ABERTA: 'Aberto',
  EM_ANALISE: 'Em análise',
  ATENDIDA: 'Atendido',
  NEGADA_COM_JUSTIFICATIVA: 'Negado com justificativa',
};

const ROTULO_DOCUMENTO: Record<string, string> = {
  POLITICA_PRIVACIDADE: 'Política de Privacidade',
  TERMO_GPS: 'Termo de uso de localização (GPS)',
  TERMO_DADOS_PESSOAIS: 'Termo de tratamento de dados pessoais',
};

const ROTULO_STATUS_AJUSTE: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  APROVADO: 'Aprovado',
  REJEITADA: 'Rejeitada',
  REJEITADO: 'Rejeitado',
};

function texto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
}

function data(v: unknown): string {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? '-' : instanteDoCliente(d);
}

function dataEvento(v: unknown, fuso: unknown): string {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return '-';
  return instanteDoEvento(d, typeof fuso === 'number' ? fuso : null);
}

function coord(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(5) : '-';
}

function rotulo(mapa: Record<string, string>, v: unknown): string {
  const k = texto(v);
  return mapa[k] ?? k.replace(/_/g, ' ').toLowerCase();
}

function primeira(v: unknown): string {
  return texto(v).replace(/\s+/g, ' ');
}

interface Coluna {
  titulo: string;
  largura: number;
}

const COR_TEXTO = '#111827';
const COR_SUAVE = '#6b7280';
const COR_LINHA = '#d1d5db';
const COR_CABECALHO = '#1f2937';
const COR_FAIXA = '#f3f4f6';

export function gerarPdfMeusDados(d: DadosExportadosMotorista): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: 48,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: 'Cópia dos dados pessoais - FVF Hórus',
      Author: 'FVF Hórus',
      Subject: 'LGPD art. 18, II e V',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const esquerda = doc.page.margins.left;
  const largura = doc.page.width - esquerda - doc.page.margins.right;
  const limiteY = () => doc.page.height - doc.page.margins.bottom - 20;

  function garantirEspaco(altura: number) {
    if (doc.y + altura > limiteY()) doc.addPage();
  }

  function secao(titulo: string, subtitulo?: string) {
    garantirEspaco(60);
    doc.moveDown(0.8);
    const y = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COR_CABECALHO)
      .text(titulo, esquerda, y, { width: largura });
    const yLinha = doc.y + 2;
    doc
      .moveTo(esquerda, yLinha)
      .lineTo(esquerda + largura, yLinha)
      .lineWidth(1)
      .strokeColor(COR_CABECALHO)
      .stroke();
    doc.y = yLinha + 6;
    if (subtitulo) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COR_SUAVE)
        .text(subtitulo, esquerda, doc.y, { width: largura });
      doc.moveDown(0.4);
    }
  }

  function vazio(msg: string) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(COR_SUAVE)
      .text(msg, esquerda, doc.y, { width: largura });
  }

  function camposChaveValor(pares: Array<[string, string]>) {
    const wRot = 130;
    for (const [rot, val] of pares) {
      garantirEspaco(18);
      const y = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COR_SUAVE)
        .text(rot, esquerda, y, { width: wRot });
      const yFim1 = doc.y;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COR_TEXTO)
        .text(val, esquerda + wRot, y, { width: largura - wRot });
      doc.y = Math.max(yFim1, doc.y) + 3;
    }
  }

  function tabela(colunas: Coluna[], linhas: string[][]) {
    const soma = colunas.reduce((a, c) => a + c.largura, 0);
    const esc = largura / soma;
    const ws = colunas.map((c) => c.largura * esc);
    const pad = 4;

    function cabecalho() {
      garantirEspaco(26);
      let x = esquerda;
      const y = doc.y;
      doc.rect(esquerda, y, largura, 16).fill(COR_CABECALHO);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      colunas.forEach((c, i) => {
        doc.text(c.titulo, x + pad, y + 4, {
          width: ws[i] - pad * 2,
          lineBreak: false,
          ellipsis: true,
        });
        x += ws[i];
      });
      doc.y = y + 16;
    }

    cabecalho();
    linhas.forEach((cels, idx) => {
      doc.font('Helvetica').fontSize(8);
      const alturas = cels.map((c, i) =>
        doc.heightOfString(c, { width: ws[i] - pad * 2 }),
      );
      const h = Math.max(...alturas) + 6;
      if (doc.y + h > limiteY()) {
        doc.addPage();
        cabecalho();
      }
      const y = doc.y;
      if (idx % 2 === 1) doc.rect(esquerda, y, largura, h).fill(COR_FAIXA);
      doc.fillColor(COR_TEXTO).font('Helvetica').fontSize(8);
      let x = esquerda;
      cels.forEach((c, i) => {
        doc.text(c, x + pad, y + 3, { width: ws[i] - pad * 2 });
        x += ws[i];
      });
      doc
        .moveTo(esquerda, y + h)
        .lineTo(esquerda + largura, y + h)
        .lineWidth(0.4)
        .strokeColor(COR_LINHA)
        .stroke();
      doc.y = y + h;
    });
  }

  function listaLimitada<T>(itens: T[], max: number): { itens: T[]; nota: string | null } {
    if (itens.length <= max) return { itens, nota: null };
    return {
      itens: itens.slice(0, max),
      nota: `Exibidos os ${max} mais recentes de ${itens.length}. A cópia completa em formato estruturado (JSON) está disponível no aplicativo.`,
    };
  }

  // ---------- Capa / cabeçalho ----------
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COR_SUAVE)
    .text('FVF HÓRUS', esquerda, doc.y, { characterSpacing: 2 });
  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COR_CABECALHO)
    .text('Cópia dos dados pessoais do titular', { width: largura });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COR_SUAVE)
    .text('Lei Geral de Proteção de Dados (Lei 13.709/2018), art. 18, incisos II e V', {
      width: largura,
    });
  doc.moveDown(0.6);
  camposChaveValor([['Gerado em', data(d.geradoEm)]]);
  doc.moveDown(0.2);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COR_SUAVE)
    .text(d.aviso, esquerda, doc.y, { width: largura, align: 'justify' });

  // ---------- Identificação ----------
  const c = d.cadastro;
  secao('1. Dados de identificação');
  if (!c) {
    vazio('Cadastro não encontrado.');
  } else {
    const emp = (c.empresa ?? {}) as Linha;
    camposChaveValor([
      ['Nome', texto(c.nome)],
      ['CPF', texto(c.cpf)],
      ['CNH', texto(c.cnh)],
      ['Telefone', texto(c.telefone)],
      ['Situação do cadastro', rotulo({ ATIVO: 'Ativo', INATIVO: 'Inativo', SUSPENSO: 'Suspenso' }, c.status)],
      ['Cadastrado em', data(c.createdAt)],
      ['Empregador', texto(emp.razaoSocial)],
      ['CNPJ do empregador', texto(emp.cnpj)],
    ]);
  }

  // ---------- Resumo ----------
  secao('2. Resumo do que é tratado');
  tabela(
    [
      { titulo: 'Categoria de dados', largura: 3 },
      { titulo: 'Quantidade', largura: 1 },
    ],
    [
      ['Registros de jornada (pontos)', String(d.registrosDeJornada.length)],
      ['Amostras de localização', String(d.amostrasDeLocalizacao.length)],
      ['Ajustes de ponto', String(d.ajustesDePonto.length)],
      ['Solicitações de ajuste', String(d.solicitacoesDeAjuste.length)],
      ['Alertas de jornada', String(d.alertas.length)],
      ['Ciências de privacidade', String(d.cienciasDePrivacidade.length)],
      ['Pedidos do titular', String(d.pedidosDoTitular.length)],
    ],
  );

  // ---------- Registros de jornada ----------
  {
    const { itens, nota } = listaLimitada(d.registrosDeJornada, LIMITE_LINHAS_PDF.registros);
    secao(
      '3. Registros de jornada',
      'Pontos registrados pelo aplicativo, do mais recente ao mais antigo. Horário no fuso em que você estava.',
    );
    if (!itens.length) vazio('Nenhum registro.');
    else {
      tabela(
        [
          { titulo: 'Data e hora', largura: 3 },
          { titulo: 'Evento', largura: 3.2 },
          { titulo: 'Latitude', largura: 1.5 },
          { titulo: 'Longitude', largura: 1.5 },
          { titulo: 'Precisão (m)', largura: 1.2 },
          { titulo: 'Observação', largura: 2.6 },
        ],
        itens.map((r) => [
          dataEvento(r.timestampEvento, r.fusoOffsetMin),
          rotulo(ROTULO_EVENTO, r.tipoEvento),
          coord(r.latitude),
          coord(r.longitude),
          r.precisaoGpsM == null ? '-' : String(Math.round(Number(r.precisaoGpsM))),
          primeira(r.observacao),
        ]),
      );
      if (nota) {
        doc.moveDown(0.3);
        vazio(nota);
      }
    }
  }

  // ---------- Localização ----------
  {
    const { itens, nota } = listaLimitada(d.amostrasDeLocalizacao, LIMITE_LINHAS_PDF.amostras);
    secao(
      '4. Amostras de localização',
      'Posições capturadas pelo aplicativo durante a jornada.',
    );
    if (!itens.length) vazio('Nenhuma amostra de localização.');
    else {
      tabela(
        [
          { titulo: 'Capturada em', largura: 3 },
          { titulo: 'Latitude', largura: 2 },
          { titulo: 'Longitude', largura: 2 },
          { titulo: 'Precisão (m)', largura: 1.5 },
        ],
        itens.map((a) => [
          data(a.capturadoEm),
          coord(a.latitude),
          coord(a.longitude),
          a.precisaoGpsM == null ? '-' : String(Math.round(Number(a.precisaoGpsM))),
        ]),
      );
      if (nota) {
        doc.moveDown(0.3);
        vazio(nota);
      }
    }
  }

  // ---------- Ajustes ----------
  {
    const { itens, nota } = listaLimitada(d.ajustesDePonto, LIMITE_LINHAS_PDF.demais);
    secao(
      '5. Ajustes de ponto lançados pela empresa',
      'Correções feitas pela transportadora na sua jornada, com o motivo informado.',
    );
    if (!itens.length) vazio('Nenhum ajuste.');
    else {
      tabela(
        [
          { titulo: 'Ponto ajustado', largura: 3 },
          { titulo: 'Evento', largura: 3 },
          { titulo: 'Motivo', largura: 4 },
          { titulo: 'Lançado em', largura: 3 },
        ],
        itens.map((t) => [
          dataEvento(t.timestampEvento, t.fusoOffsetMin),
          rotulo(ROTULO_EVENTO, t.tipoEvento),
          primeira(t.motivo),
          data(t.createdAt),
        ]),
      );
      if (nota) {
        doc.moveDown(0.3);
        vazio(nota);
      }
    }
  }

  {
    const { itens, nota } = listaLimitada(d.solicitacoesDeAjuste, LIMITE_LINHAS_PDF.demais);
    secao('6. Solicitações de ajuste feitas por você');
    if (!itens.length) vazio('Nenhuma solicitação.');
    else {
      tabela(
        [
          { titulo: 'Ponto solicitado', largura: 3 },
          { titulo: 'Evento', largura: 3 },
          { titulo: 'Situação', largura: 1.8 },
          { titulo: 'Resposta da empresa', largura: 3.6 },
          { titulo: 'Pedido em', largura: 3 },
        ],
        itens.map((s) => [
          dataEvento(s.timestampEvento, s.fusoOffsetMin),
          rotulo(ROTULO_EVENTO, s.tipoEvento),
          rotulo(ROTULO_STATUS_AJUSTE, s.status),
          primeira(s.motivoDecisao),
          data(s.createdAt),
        ]),
      );
      if (nota) {
        doc.moveDown(0.3);
        vazio(nota);
      }
    }
  }

  // ---------- Alertas ----------
  {
    const { itens, nota } = listaLimitada(d.alertas, LIMITE_LINHAS_PDF.demais);
    secao('7. Alertas de jornada');
    if (!itens.length) vazio('Nenhum alerta.');
    else {
      tabela(
        [
          { titulo: 'Data e hora', largura: 3 },
          { titulo: 'Gravidade', largura: 1.6 },
          { titulo: 'Mensagem', largura: 7 },
        ],
        itens.map((a) => [
          data(a.createdAt),
          rotulo({ INFO: 'Informativo', ATENCAO: 'Atenção', CRITICO: 'Crítico' }, a.severidade),
          primeira(a.mensagem),
        ]),
      );
      if (nota) {
        doc.moveDown(0.3);
        vazio(nota);
      }
    }
  }

  // ---------- Privacidade ----------
  secao('8. Ciências de privacidade registradas');
  if (!d.cienciasDePrivacidade.length) vazio('Nenhuma ciência registrada.');
  else {
    tabela(
      [
        { titulo: 'Documento', largura: 5 },
        { titulo: 'Versão', largura: 2 },
        { titulo: 'Data da ciência', largura: 3 },
      ],
      d.cienciasDePrivacidade.map((a) => [
        rotulo(ROTULO_DOCUMENTO, a.tipoDocumento),
        texto(a.versao),
        data(a.aceitoEm),
      ]),
    );
  }

  secao('9. Pedidos feitos como titular de dados');
  if (!d.pedidosDoTitular.length) vazio('Nenhum pedido.');
  else {
    tabela(
      [
        { titulo: 'Tipo', largura: 3 },
        { titulo: 'Situação', largura: 1.8 },
        { titulo: 'Pedido em', largura: 2.6 },
        { titulo: 'Prazo', largura: 2.6 },
        { titulo: 'Resposta', largura: 4 },
      ],
      d.pedidosDoTitular.map((p) => [
        rotulo(ROTULO_TIPO_PEDIDO, p.tipo),
        rotulo(ROTULO_STATUS_PEDIDO, p.status),
        data(p.createdAt),
        data(p.prazoEm),
        primeira(p.resposta),
      ]),
    );
  }

  // ---------- Encerramento ----------
  garantirEspaco(80);
  doc.moveDown(1.2);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COR_SUAVE)
    .text(
      'Este documento reúne os dados pessoais que o FVF Hórus trata sobre você, extraídos do sistema na data indicada acima. ' +
        'Para corrigir, eliminar ou questionar qualquer informação, use a opção "Fazer um pedido" na tela de Privacidade do aplicativo ' +
        'ou fale com o encarregado de dados da sua transportadora.',
      esquerda,
      doc.y,
      { width: largura, align: 'justify' },
    );

  // ---------- Rodapé com paginação ----------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 8;
    doc.page.margins.bottom = 0; // evita nova página ao escrever no rodapé
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COR_SUAVE)
      .text(
        `FVF Hórus - Cópia dos dados pessoais - Página ${i + 1} de ${range.count}`,
        esquerda,
        y,
        { width: largura, align: 'center', lineBreak: false },
      );
  }

  doc.end();
  return pronto;
}
