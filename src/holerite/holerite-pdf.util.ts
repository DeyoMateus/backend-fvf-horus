import {
  COR_SUAVE,
  COR_TEXTO,
  RelatorioPdf,
  type ColunaPdf,
} from '../common/pdf/relatorio-pdf';
import { agoraDoCliente } from '../common/fuso/fuso-contexto';
import type { Motorista } from '@prisma/client';
import type { EmpresaDoComprovante } from '../common/comprovante/comprovante.service';
import type {
  EventoDetalhadoHolerite,
  ResultadoHolerite,
} from './holerite.service';
import {
  OFFSET_PADRAO_MIN,
  formatarDataHoraBrt,
  rotuloFuso,
} from '../common/fuso/fuso-brasil.util';

/** `d.dia` vem como "AAAA-MM-DD" (chave interna, usada pra ordenar , ver
 * `holerite.service.ts`); exibir isso direto pro usuário sai em ordem
 * AAAA-MM-DD (achado como "data invertida" pelo usuário, Rodada 80).
 * Formata só na hora de desenhar, sem mexer na chave interna. */
function formatarDiaBr(diaIso: string): string {
  const [ano, mes, dia] = diaIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarHoras(minutos: number): string {
  const h = Math.floor(Math.abs(minutos) / 60);
  const m = Math.round(Math.abs(minutos) % 60);
  return `${minutos < 0 ? '-' : ''}${h}h${String(m).padStart(2, '0')}`;
}

/** Rótulo em pt-BR de cada TipoEvento , mesma tradução usada no REP-P
 * (ver `ROTULO_EVENTO` em `rep-p.service.ts`), duplicada aqui de
 * propósito em vez de importada: são módulos independentes, cada um
 * documentando a própria lista (mesmo padrão do resto do projeto ,
 * ver comentário de `calcularIntervalosIndefinido` em
 * `holerite.service.ts` sobre nunca reaproveitar entre módulos que
 * não precisam ficar acoplados). */
const ROTULO_EVENTO_DETALHADO: Record<string, string> = {
  INICIO_JORNADA: 'Início de jornada',
  INICIO_DESCANSO: 'Início de descanso/intervalo',
  FIM_DESCANSO: 'Fim de descanso/intervalo',
  INICIO_DIRECAO: 'Início de direção',
  FIM_DIRECAO: 'Fim de direção',
  ESPERA_CARGA_DESCARGA: 'Início de espera (carga/descarga)',
  FIM_ESPERA_CARGA_DESCARGA: 'Fim de espera',
  FIM_DESCARREGAMENTO: 'Fim de espera (entrega concluída)',
  FIM_JORNADA: 'Fim de jornada',
  OUTRO: 'Evento diverso',
};

// Rodada 144/146: log de eventos na hora de parede do fuso em que o ponto
// aconteceu. Quando difere do fuso da empresa, ganha o selo "(UTC-4)" para
// o gestor não estranhar a diferença para o relógio dele.
function horaDoEvento(
  evento: { timestampEvento: Date; fusoOffsetMin?: number },
  fusoEmpresaOffsetMin: number,
): string {
  const offset = evento.fusoOffsetMin ?? fusoEmpresaOffsetMin;
  const texto = formatarDataHoraBrt(evento.timestampEvento, offset);
  return offset === fusoEmpresaOffsetMin
    ? texto
    : `${texto} (${rotuloFuso(offset)})`;
}

/**
 * Desenha o conteúdo de UM motorista (identificação + tabela por dia +
 * total + nota + assinaturas + log detalhado por jornada) a partir da
 * posição atual. Reaproveitado pelo PDF individual e pelo fechamento em
 * lote (Rodada 36). Visual no modelo único `RelatorioPdf` (Rodada 232).
 */
function desenharSecaoMotorista(
  rel: RelatorioPdf,
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>,
  empresa: EmpresaDoComprovante,
  resultado: ResultadoHolerite,
): void {
  const doc = rel.doc;
  rel.secao('Identificação');
  const pares: Array<[string, string]> = [
    ['Empregador', empresa.razaoSocial],
    ['CNPJ', empresa.cnpj],
    ['Motorista', motorista.nome],
    ['CPF', motorista.cpf],
    ['CNH', motorista.cnh],
    [
      'Período',
      // Rodada 97: periodoInicio/periodoFim são o próprio dia escolhido em
      // UTC; sem timeZone: 'UTC' a data impressa voltava 1 dia.
      `${resultado.periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${resultado.periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
    ],
    ['Gerado em', agoraDoCliente()],
  ];
  if (resultado.regraSindicalAplicada) {
    pares.push([
      'Convenção coletiva aplicada',
      resultado.regraSindicalAplicada.nome,
    ]);
  }
  rel.camposChaveValor(pares, 150);

  // Colunas da tabela , só as habilitadas pelo gestor nesta geração.
  const colunas: Array<
    ColunaPdf & { valor: (d: ResultadoHolerite['dias'][number]) => string }
  > = [
    {
      titulo: 'Dia',
      largura: 70,
      valor: (d) => formatarDiaBr(d.dia),
    },
  ];
  const horas = (
    titulo: string,
    largura: number,
    campo: 'direcaoMin' | 'esperaMin' | 'normalMin' | 'extraMin' | 'noturnoMin',
  ) =>
    colunas.push({
      titulo,
      largura,
      alinhamento: 'right',
      valor: (d) => formatarHoras(d[campo]),
    });
  if (resultado.opcoes.direcaoEspera) {
    horas('Direção', 65, 'direcaoMin');
    horas('Espera', 65, 'esperaMin');
  }
  if (resultado.opcoes.normalExtra) {
    horas('H. normal', 65, 'normalMin');
    horas('H. extra', 65, 'extraMin');
  }
  if (resultado.opcoes.adicionalNoturno) horas('Hora noturna', 75, 'noturnoMin');
  colunas.push({
    titulo: 'Obs.',
    largura: 80,
    valor: (d) => (d.teveFechamentoGestor ? 'Fechado p/ gestor' : ''),
  });

  rel.secao('Apuração por dia');
  const linhas = resultado.dias.map((d) => colunas.map((c) => c.valor(d)));
  const totalLinha: string[] = ['Total'];
  if (resultado.opcoes.direcaoEspera) {
    totalLinha.push(
      formatarHoras(resultado.totais.direcaoMin),
      formatarHoras(resultado.totais.esperaMin),
    );
  }
  if (resultado.opcoes.normalExtra) {
    totalLinha.push(
      formatarHoras(resultado.totais.normalMin),
      formatarHoras(resultado.totais.extraMin),
    );
  }
  if (resultado.opcoes.adicionalNoturno) {
    totalLinha.push(formatarHoras(resultado.totais.noturnoMin));
  }
  totalLinha.push('');
  if (resultado.dias.length === 0) {
    rel.vazio('Nenhum ponto registrado (ou ajustado pelo gestor) no período.');
    doc.moveDown(0.3);
  }
  rel.tabela(colunas, [...linhas, totalLinha], {
    tamanhoFonte: 8.5,
    ultimaLinhaTotal: true,
  });

  doc.moveDown(0.8);
  rel.nota(
    'Dias marcados como "Fechado p/ gestor" incluem ajuste lançado pela empresa (ponto que o motorista ' +
      'esqueceu de bater), com evidência anexada e notificação enviada ao app do motorista , ver histórico ' +
      'de ajustes dele para o motivo e os comprovantes. Este documento é gerado a partir do ledger imutável ' +
      'do motorista (registros de ponto) combinado com os ajustes registrados pelo gestor no período.',
  );

  // Rodada 84: assinaturas na página 1, junto dos totais.
  desenharBlocoAssinaturas(rel, motorista.nome, empresa.razaoSocial);

  // Rodada 81: o log detalhado sempre começa numa folha à parte.
  doc.addPage();
  rel.secao(
    'Registros detalhados do período',
    // Rodada 85: agrupado por JORNADA, não por dia-calendário.
    'Os eventos abaixo estão agrupados por jornada , do "Início de jornada" até o "Fim de jornada" ' +
      'correspondente batido pelo motorista (uma jornada pode ter mais de um dia, e o mesmo dia pode ter ' +
      'mais de uma jornada). Mesmos eventos que compõem os totais da folha anterior.',
  );

  if (resultado.eventos.length === 0) {
    rel.vazio('Nenhum evento registrado (nem ajustado pelo gestor) no período.');
  }

  const fusoEmpresaOffsetMin =
    resultado.fusoEmpresaOffsetMin ?? OFFSET_PADRAO_MIN;

  // Colunas do log (Rodada 98 incluiu "Localização").
  const colunasDetalhe: ColunaPdf[] = [
    { titulo: 'Data/Hora', largura: 85 },
    { titulo: 'Evento (status da ação)', largura: 130 },
    { titulo: 'Origem', largura: 50 },
    { titulo: 'Localização', largura: 90 },
    { titulo: 'Motivo/Observação', largura: 160 },
  ];

  interface BlocoJornada {
    titulo: string;
    eventos: EventoDetalhadoHolerite[];
  }

  // Corta `resultado.eventos` (já ordenado cronologicamente) em blocos por
  // jornada: cada "Início de jornada" abre um bloco novo, cada "Fim de
  // jornada" fecha o bloco atual. Se a jornada não tiver "Fim de jornada"
  // registrado no período (em aberto), o bloco fecha mesmo assim no fim
  // da lista, marcado como "em aberto". Eventos que aparecerem ANTES do
  // 1º "Início de jornada" do período (raro , ex.: um ajuste do RH
  // lançado fora de qualquer jornada) vão pra um bloco à parte, em vez de
  // inventar uma jornada que não existiu.
  const blocos: BlocoJornada[] = [];
  const avulsos: EventoDetalhadoHolerite[] = [];
  let atual: EventoDetalhadoHolerite[] | null = null;

  const fecharAtual = (fimJornada: EventoDetalhadoHolerite | null) => {
    if (!atual) return;
    const inicio = atual[0];
    const duracaoMin = fimJornada
      ? Math.round(
          (fimJornada.timestampEvento.getTime() -
            inicio.timestampEvento.getTime()) /
            60000,
        )
      : null;
    const tituloFim = fimJornada
      ? horaDoEvento(fimJornada, fusoEmpresaOffsetMin)
      : 'em aberto no fim do período';
    const sufixoDuracao =
      duracaoMin !== null ? `  •  duração ${formatarHoras(duracaoMin)}` : '';
    blocos.push({
      titulo: `${horaDoEvento(inicio, fusoEmpresaOffsetMin)} até ${tituloFim}${sufixoDuracao}`,
      eventos: atual,
    });
    atual = null;
  };

  for (const evento of resultado.eventos) {
    if (evento.tipoEvento === 'INICIO_JORNADA') {
      fecharAtual(null); // jornada anterior nunca fechou , fecha como "em aberto" antes de abrir a nova
      atual = [evento];
      continue;
    }
    if (!atual) {
      avulsos.push(evento);
      continue;
    }
    atual.push(evento);
    if (evento.tipoEvento === 'FIM_JORNADA') {
      fecharAtual(evento);
    }
  }
  fecharAtual(null); // última jornada do período, se não fechou

  const desenharBlocoDeEventos = (
    titulo: string,
    eventos: EventoDetalhadoHolerite[],
  ) => {
    rel.garantirEspaco(80); // título do bloco + cabeçalho + 2 linhas
    rel.subsecao(titulo);
    const linhasEv: string[][] = [];
    const links: Array<Array<string | undefined>> = [];
    for (const evento of eventos) {
      const temLocalizacao =
        evento.latitude != null && evento.longitude != null;
      linhasEv.push([
        horaDoEvento(evento, fusoEmpresaOffsetMin),
        ROTULO_EVENTO_DETALHADO[evento.tipoEvento] ?? evento.tipoEvento,
        evento.origemGestor ? 'RH' : 'Motorista',
        temLocalizacao ? 'Ver no mapa' : ',',
        evento.detalhe ?? '',
      ]);
      links.push([
        undefined,
        undefined,
        undefined,
        temLocalizacao
          ? `https://www.google.com/maps/search/?api=1&query=${evento.latitude},${evento.longitude}`
          : undefined,
        undefined,
      ]);
    }
    rel.tabela(colunasDetalhe, linhasEv, { links });
    doc.moveDown(0.4);
  };

  if (avulsos.length > 0) {
    desenharBlocoDeEventos(
      'Eventos fora de uma jornada identificada (sem "Início de jornada" correspondente no período)',
      avulsos,
    );
  }

  blocos.forEach((bloco, indice) => {
    desenharBlocoDeEventos(
      `Jornada ${indice + 1} , ${bloco.titulo}`,
      bloco.eventos,
    );
  });
}

/**
 * Rodada 83/84: espaço para o motorista e a empresa contratante assinarem,
 * logo depois do resumo (página 1). Duas linhas lado a lado, nome impresso
 * embaixo de cada uma.
 */
function desenharBlocoAssinaturas(
  rel: RelatorioPdf,
  nomeMotorista: string,
  nomeEmpresa: string,
): void {
  const doc = rel.doc;
  const xInicial = rel.esquerda;
  const alturaBloco = 90; // linha de assinatura + nome + respiro
  // Assinatura colada no rodapé não serve em papel: sem espaço, vai pra nova página.
  rel.garantirEspaco(alturaBloco);
  doc.moveDown(2.5);

  const larguraColuna = rel.largura / 2;
  const larguraLinha = larguraColuna - 30;
  const y = doc.y;

  doc.lineWidth(0.8).strokeColor(COR_TEXTO);
  doc.moveTo(xInicial, y).lineTo(xInicial + larguraLinha, y).stroke();
  doc
    .moveTo(xInicial + larguraColuna, y)
    .lineTo(xInicial + larguraColuna + larguraLinha, y)
    .stroke();

  // Captura y ANTES de desenhar a 1ª célula, para a 2ª ficar ao lado.
  let yLinha = y + 4;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_TEXTO);
  doc.text(nomeMotorista, xInicial, yLinha, {
    width: larguraLinha,
    align: 'center',
  });
  const alturaNome = doc.heightOfString(nomeMotorista, { width: larguraLinha });
  doc.text(nomeEmpresa, xInicial + larguraColuna, yLinha, {
    width: larguraLinha,
    align: 'center',
  });
  const alturaMaxNome = Math.max(
    alturaNome,
    doc.heightOfString(nomeEmpresa, { width: larguraLinha }),
  );

  yLinha = yLinha + alturaMaxNome;
  doc.font('Helvetica').fontSize(8).fillColor(COR_SUAVE);
  doc.text('Assinatura do motorista', xInicial, yLinha, {
    width: larguraLinha,
    align: 'center',
  });
  doc.text(
    'Assinatura da empresa contratante',
    xInicial + larguraColuna,
    yLinha,
    { width: larguraLinha, align: 'center' },
  );
  doc.y = yLinha + 12;
}

/**
 * PDF de apuração de jornada (espelho de ponto categorizado por dia). Só
 * com as colunas que o gestor escolheu incluir (opções da Rodada 26). NÃO
 * calcula folha de pagamento completa nem entrega holerite pronto , ver
 * disclaimer impresso no próprio PDF e no FAQ do produto (Rodada 27).
 */
export async function gerarPdfHolerite(
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>,
  empresa: EmpresaDoComprovante,
  resultado: ResultadoHolerite,
): Promise<Buffer> {
  const rel = new RelatorioPdf({
    titulo: 'Apuração de jornada (espelho de ponto)',
    rodape: 'Folha de ponto',
  });
  rel.cabecalho({
    titulo: 'Apuração de jornada (espelho de ponto)',
    aviso:
      'Este documento organiza e categoriza a jornada (direção, espera, normal/extra, noturno) pra apoiar o ' +
      'fechamento da folha , não é o cálculo completo da folha de pagamento (salário, DSR, verbas) nem o ' +
      'holerite pronto.',
  });

  desenharSecaoMotorista(rel, motorista, empresa, resultado);
  return rel.finalizar();
}

export interface ItemFechamentoLote {
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>;
  empresa: EmpresaDoComprovante;
  resultado: ResultadoHolerite;
}

/**
 * Fechamento em lote (Rodada 36) , capa-resumo (motorista x totais de horas)
 * seguida de uma seção completa por motorista, cada uma em página nova.
 */
export async function gerarPdfFechamentoLote(
  itens: ItemFechamentoLote[],
  periodoInicio: Date,
  periodoFim: Date,
): Promise<Buffer> {
  const rel = new RelatorioPdf({
    titulo: 'Fechamento de jornada da frota',
    rodape: 'Fechamento de jornada da frota',
  });
  rel.cabecalho({
    titulo: 'Fechamento de jornada da frota',
    campos: [
      [
        'Período',
        // Rodada 97: ver desenharSecaoMotorista.
        `${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
      ],
      ['Motoristas', `${itens.length} motorista(s)`],
      ['Gerado em', agoraDoCliente()],
    ],
    aviso:
      'Resumo por motorista, seguido do detalhamento diário completo de cada um. Somente horas , nenhum ' +
      'valor monetário é calculado ou exibido; o pagamento é decisão da empresa/RH fora desta plataforma.',
  });

  rel.secao('Resumo por motorista');
  const colunasResumo: ColunaPdf[] = [
    { titulo: 'Motorista', largura: 160 },
    { titulo: 'Direção', largura: 65, alinhamento: 'right' },
    { titulo: 'Espera', largura: 65, alinhamento: 'right' },
    { titulo: 'H. normal', largura: 65, alinhamento: 'right' },
    { titulo: 'H. extra', largura: 65, alinhamento: 'right' },
    { titulo: 'Hora noturna', largura: 75, alinhamento: 'right' },
  ];
  const totalGeral = {
    direcaoMin: 0,
    esperaMin: 0,
    normalMin: 0,
    extraMin: 0,
    noturnoMin: 0,
  };
  if (itens.length === 0) {
    rel.vazio('Nenhum motorista encontrado para este fechamento.');
    rel.doc.moveDown(0.3);
  }
  const linhas: string[][] = [];
  for (const item of itens) {
    const t = item.resultado.totais;
    linhas.push([
      item.motorista.nome,
      formatarHoras(t.direcaoMin),
      formatarHoras(t.esperaMin),
      formatarHoras(t.normalMin),
      formatarHoras(t.extraMin),
      formatarHoras(t.noturnoMin),
    ]);
    totalGeral.direcaoMin += t.direcaoMin;
    totalGeral.esperaMin += t.esperaMin;
    totalGeral.normalMin += t.normalMin;
    totalGeral.extraMin += t.extraMin;
    totalGeral.noturnoMin += t.noturnoMin;
  }
  linhas.push([
    'Total da frota',
    formatarHoras(totalGeral.direcaoMin),
    formatarHoras(totalGeral.esperaMin),
    formatarHoras(totalGeral.normalMin),
    formatarHoras(totalGeral.extraMin),
    formatarHoras(totalGeral.noturnoMin),
  ]);
  rel.tabela(colunasResumo, linhas, {
    tamanhoFonte: 8.5,
    ultimaLinhaTotal: true,
  });

  for (const item of itens) {
    rel.doc.addPage();
    desenharSecaoMotorista(rel, item.motorista, item.empresa, item.resultado);
  }

  return rel.finalizar();
}
