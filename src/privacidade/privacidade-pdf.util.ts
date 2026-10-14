import { RelatorioPdf, type ColunaPdf } from '../common/pdf/relatorio-pdf';
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

export function gerarPdfMeusDados(d: DadosExportadosMotorista): Promise<Buffer> {
  const r = new RelatorioPdf({
    titulo: 'Cópia dos dados pessoais - FVF Hórus',
    assunto: 'LGPD art. 18, II e V',
    rodape: 'Cópia dos dados pessoais',
  });
  const { doc } = r;
  const secao = r.secao.bind(r);
  const vazio = r.vazio.bind(r);
  const camposChaveValor = r.camposChaveValor.bind(r);
  const tabela = (colunas: ColunaPdf[], linhas: string[][]) =>
    r.tabela(colunas, linhas);
  const garantirEspaco = r.garantirEspaco.bind(r);
  const listaLimitada = <T,>(itens: T[], max: number) =>
    RelatorioPdf.limitar(
      itens,
      max,
      'A cópia completa em formato estruturado (JSON) está disponível no aplicativo.',
    );

  // ---------- Capa / cabeçalho ----------
  r.cabecalho({
    titulo: 'Cópia dos dados pessoais do titular',
    subtitulo:
      'Lei Geral de Proteção de Dados (Lei 13.709/2018), art. 18, incisos II e V',
    campos: [['Gerado em', data(d.geradoEm)]],
    aviso: d.aviso,
  });

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
  r.nota(
    'Este documento reúne os dados pessoais que o FVF Hórus trata sobre você, extraídos do sistema na data indicada acima. ' +
      'Para corrigir, eliminar ou questionar qualquer informação, use a opção "Fazer um pedido" na tela de Privacidade do aplicativo ' +
      'ou fale com o encarregado de dados da sua transportadora.',
  );

  return r.finalizar();
}
