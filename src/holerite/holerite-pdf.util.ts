import PDFDocument from 'pdfkit';
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
 * Desenha o conteúdo de UM motorista (cabeçalho + tabela por dia +
 * total + nota de rodapé) na posição atual do `doc` , extraído de
 * `gerarPdfHolerite` (Rodada 26) pra ser reaproveitado tanto no PDF
 * individual quanto no PDF de fechamento em lote (Rodada 36), sem
 * duplicar a lógica de desenho da tabela.
 */
function desenharSecaoMotorista(
  doc: PDFKit.PDFDocument,
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>,
  empresa: EmpresaDoComprovante,
  resultado: ResultadoHolerite,
): void {
  doc.fontSize(10).fillColor('#374151');
  doc.font('Helvetica-Bold').text(`Empregador: ${empresa.razaoSocial}`);
  doc.font('Helvetica').text(`CNPJ: ${empresa.cnpj}`);
  doc.moveDown(0.5);
  doc.text(`Motorista: ${motorista.nome}`);
  doc.text(`CPF: ${motorista.cpf}   CNH: ${motorista.cnh}`);
  doc.text(
    // Rodada 97 , BUG CORRIGIDO: periodoInicio/periodoFim nascem de um
    // <input type="date"> (ex.: "2026-09-01"), que vira meia-noite UTC ,
    // não um instante real, e sim o próprio dia escolhido representado em
    // UTC. Formatar com toLocaleDateString('pt-BR') SEM timeZone convertia
    // pro fuso do processo (America/Sao_Paulo, UTC-3), voltando a data
    // impressa 1 dia (ex.: 01/09 virava 31/08) , o relatório parecia
    // ignorar o período filtrado e mostrar "outro aproximado". Forçar
    // timeZone: 'UTC' aqui imprime exatamente o dia que foi pedido.
    `Período: ${resultado.periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${resultado.periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
  );
  doc.text(
    `Gerado em: ${agoraDoCliente()}`,
  );
  if (resultado.regraSindicalAplicada) {
    doc.text(
      `Convenção coletiva aplicada: ${resultado.regraSindicalAplicada.nome}`,
    );
  }
  doc.moveDown();

  // Cabeçalho da tabela , só as colunas habilitadas pelo gestor nesta geração.
  const colunas: Array<{
    titulo: string;
    largura: number;
    valor: (d: ResultadoHolerite['dias'][number]) => string;
  }> = [{ titulo: 'Dia', largura: 70, valor: (d) => formatarDiaBr(d.dia) }];
  if (resultado.opcoes.direcaoEspera) {
    colunas.push({
      titulo: 'Direção',
      largura: 65,
      valor: (d) => formatarHoras(d.direcaoMin),
    });
    colunas.push({
      titulo: 'Espera',
      largura: 65,
      valor: (d) => formatarHoras(d.esperaMin),
    });
  }
  if (resultado.opcoes.normalExtra) {
    colunas.push({
      titulo: 'H. normal',
      largura: 65,
      valor: (d) => formatarHoras(d.normalMin),
    });
    colunas.push({
      titulo: 'H. extra',
      largura: 65,
      valor: (d) => formatarHoras(d.extraMin),
    });
  }
  if (resultado.opcoes.adicionalNoturno) {
    colunas.push({
      titulo: 'Hora noturna',
      largura: 75,
      valor: (d) => formatarHoras(d.noturnoMin),
    });
  }
  colunas.push({
    titulo: 'Obs.',
    largura: 60,
    valor: (d) => (d.teveFechamentoGestor ? 'Fechado p/ gestor' : ''),
  });

  // Rodada 79: `doc.x` do pdfkit NÃO volta pra margem esquerda depois de um
  // `.text(str, x, y, { width, continued: false })` com x/y absolutos , ele
  // fica parado no x que foi passado pra ÚLTIMA célula desenhada. Reler
  // `doc.x` a cada linha (como era antes) fazia a tabela inteira "andar"
  // pra direita a cada linha, até sair da página (por isso só a 1ª linha
  // aparecia, torta, e as outras sumiam). Fixando a coluna inicial UMA vez
  // (antes de desenhar a 1ª linha) resolve, porque toda linha volta a
  // começar no mesmo x.
  const xInicial = doc.x;

  // Rodada 79 (2ª parte): depois de fixar o x, ainda restava um segundo bug
  // de posicionamento , `doc.y` só avança automaticamente pela altura do
  // TEXTO DA ÚLTIMA célula desenhada (não da linha inteira). Como a última
  // coluna (Obs.) fica vazia na maioria dos dias, o avanço de y ficava
  // praticamente zero e as linhas se sobrepunham (só "respirava" nos dias
  // com "Fechado p/ gestor" preenchido). Corrigido calculando a altura
  // necessária pra linha INTEIRA (maior célula, considerando quebras de
  // linha) e avançando `doc.y` por esse valor de forma explícita.
  const desenharLinha = (celulas: string[], negrito: boolean) => {
    doc
      .font(negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8)
      .fillColor('#111827');
    let x = xInicial;
    const y = doc.y;
    let alturaLinha = 0;
    for (let i = 0; i < celulas.length; i++) {
      doc.text(celulas[i], x, y, {
        width: colunas[i].largura,
        continued: false,
      });
      alturaLinha = Math.max(
        alturaLinha,
        doc.heightOfString(celulas[i], { width: colunas[i].largura }),
      );
      x += colunas[i].largura;
    }
    doc.y = y + alturaLinha;
    doc.moveDown(0.3);
  };

  desenharLinha(
    colunas.map((c) => c.titulo),
    true,
  );
  doc
    .moveTo(xInicial, doc.y)
    .lineTo(xInicial + colunas.reduce((s, c) => s + c.largura, 0), doc.y)
    .strokeColor('#9ca3af')
    .stroke();
  doc.moveDown(0.2);

  if (resultado.dias.length === 0) {
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text('Nenhum ponto registrado (ou ajustado pelo gestor) no período.');
  }

  for (const dia of resultado.dias) {
    desenharLinha(
      colunas.map((c) => c.valor(dia)),
      false,
    );
  }

  doc.moveDown();
  doc
    .moveTo(xInicial, doc.y)
    .lineTo(xInicial + colunas.reduce((s, c) => s + c.largura, 0), doc.y)
    .strokeColor('#9ca3af')
    .stroke();
  doc.moveDown(0.3);

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
  desenharLinha(totalLinha, true);

  doc.moveDown();
  // Rodada 80 , pedido do usuário: esse parágrafo tava saindo como um
  // "balão" estreito, em vez de ocupar a linha toda. Igual ao bug das
  // linhas da tabela (ver `desenharLinha` acima): depois de desenhar a
  // última célula da linha de Total, `doc.x` fica parado onde aquela
  // célula começou (bem à direita), não na margem , e como este
  // `.text()` não passava x/width explícitos, ele herdava esse x e
  // só tinha o pedacinho de página restante até a margem direita pra
  // quebrar linha. Agora desenha explicitamente da margem esquerda até
  // a direita, ocupando a largura inteira da página.
  const larguraTotalPagina =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .font('Helvetica') // a linha de Total (acima) deixa a fonte em negrito , reseta aqui.
    .fontSize(8)
    .fillColor('#6b7280')
    .text(
      'Dias marcados como "Fechado p/ gestor" incluem ajuste lançado pela empresa (ponto que o motorista ' +
        'esqueceu de bater), com evidência anexada e notificação enviada ao app do motorista , ver histórico ' +
        'de ajustes dele para o motivo e os comprovantes. Este documento é gerado a partir do ledger imutável ' +
        'do motorista (registros de ponto) combinado com os ajustes registrados pelo gestor no período.',
      xInicial,
      doc.y,
      { width: larguraTotalPagina, align: 'justify' },
    );

  // Rodada 84 , pedido do usuário: "coloque a assinatura na pagina
  // numero um que trás os totais". Antes ficava no fim de tudo (depois
  // do log detalhado); agora desenha logo em seguida do resumo, ainda
  // na mesma página 1 (a função já pula de página sozinha se não
  // sobrar espaço , ver `desenharBlocoAssinaturas`).
  desenharBlocoAssinaturas(doc, motorista.nome, empresa.razaoSocial);

  // Rodada 81 , pedido do usuário: "a primeira folha pode trazer os
  // totais dos dias, mas as seguintes deve trazer exatamente quando o
  // motorista bateu ponto abertura e fechamento e status da ação".
  // Força nova página pra esse log detalhado SEMPRE começar numa folha
  // à parte do resumo diário, mesmo quando o resumo deste motorista
  // coube inteiro numa página curta.
  doc.addPage();

  // Rodada 98 , pedido do usuário: "coloque uma tabela de localização
  // para cada lugar que o motorista bateu o ponto". Nova coluna
  // "Localização" entre Origem e Motivo/Observação; larguras das outras
  // colunas reduzidas pra caber na mesma folha A4 (soma continua 515pt =
  // largura útil da página com as margens de 40pt do documento).
  const colunasDetalhe: Array<{ titulo: string; largura: number }> = [
    { titulo: 'Data/Hora', largura: 85 },
    { titulo: 'Evento (status da ação)', largura: 130 },
    { titulo: 'Origem', largura: 50 },
    { titulo: 'Localização', largura: 90 },
    { titulo: 'Motivo/Observação', largura: 160 },
  ];
  const xInicialDetalhe = doc.page.margins.left;
  const yMaximoUtil = doc.page.height - doc.page.margins.bottom;

  interface CelulaDetalhe {
    texto: string;
    link?: string;
  }

  const desenharLinhaDetalhe = (
    celulas: Array<string | CelulaDetalhe>,
    negrito: boolean,
  ) => {
    let x = xInicialDetalhe;
    const y = doc.y;
    let alturaLinha = 0;
    for (let i = 0; i < celulas.length; i++) {
      const celula =
        typeof celulas[i] === 'string'
          ? { texto: celulas[i] as string }
          : (celulas[i] as CelulaDetalhe);
      doc
        .font(negrito ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor(celula.link ? '#1a56db' : '#111827');
      doc.text(celula.texto, x, y, {
        width: colunasDetalhe[i].largura,
        continued: false,
        link: celula.link,
        underline: Boolean(celula.link),
      });
      alturaLinha = Math.max(
        alturaLinha,
        doc.heightOfString(celula.texto, { width: colunasDetalhe[i].largura }),
      );
      x += colunasDetalhe[i].largura;
    }
    doc.y = y + alturaLinha;
    doc.moveDown(0.3);
  };

  const desenharCabecalhoColunas = () => {
    doc.x = xInicialDetalhe;
    desenharLinhaDetalhe(
      colunasDetalhe.map((c) => c.titulo),
      true,
    );
    doc
      .moveTo(xInicialDetalhe, doc.y)
      .lineTo(
        xInicialDetalhe + colunasDetalhe.reduce((s, c) => s + c.largura, 0),
        doc.y,
      )
      .strokeColor('#9ca3af')
      .stroke();
    doc.moveDown(0.2);
  };

  // Paginação manual: mesma razão do resto do arquivo (linhas com x/y
  // absolutos não quebram página sozinhas) , checa se cabe antes de
  // desenhar e recomeça o cabeçalho de colunas na página nova.
  const quebrarPaginaSeNecessario = (alturaNecessaria: number) => {
    if (doc.y + alturaNecessaria > yMaximoUtil) {
      doc.addPage();
      desenharCabecalhoColunas();
    }
  };

  doc
    .fontSize(12)
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .text('Registros detalhados do período', xInicialDetalhe, doc.y);
  doc
    .fontSize(8)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text(
      // Rodada 85 , pedido do usuário: usar como referência uma folha de
      // ponto impressa (grade diária) pra deixar os pontos "mais
      // ordenados e claros", agrupados POR JORNADA , não por
      // dia-calendário. Motivo (ver `rodada-70-jornadas-multiplas-
      // mesmo-dia.md`): o motorista pode abrir e fechar mais de uma
      // jornada no mesmo dia, e uma jornada pode cruzar a meia-noite ,
      // agrupar por dia esconderia ou embaralharia exatamente a
      // informação que o usuário pediu pra deixar clara.
      'Os eventos abaixo estão agrupados por jornada , do "Início de jornada" até o "Fim de jornada" ' +
        'correspondente batido pelo motorista (uma jornada pode ter mais de um dia, e o mesmo dia pode ter ' +
        'mais de uma jornada). Mesmos eventos que compõem os totais da folha anterior.',
      xInicialDetalhe,
      doc.y,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      },
    );
  doc.moveDown(0.5);
  desenharCabecalhoColunas();

  if (resultado.eventos.length === 0) {
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text(
        'Nenhum evento registrado (nem ajustado pelo gestor) no período.',
        xInicialDetalhe,
        doc.y,
      );
  }

  const fusoEmpresaOffsetMin =
    resultado.fusoEmpresaOffsetMin ?? OFFSET_PADRAO_MIN;

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
    quebrarPaginaSeNecessario(18 + 24); // título do bloco + pelo menos 1 linha, senão não faz sentido começar colado no rodapé
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#1f2937')
      .text(titulo, xInicialDetalhe, doc.y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
    doc.moveDown(0.2);
    for (const evento of eventos) {
      quebrarPaginaSeNecessario(24); // generoso o bastante pra "Motivo/Observação" quebrar em 2-3 linhas
      const temLocalizacao =
        evento.latitude != null && evento.longitude != null;
      desenharLinhaDetalhe(
        [
          horaDoEvento(evento, fusoEmpresaOffsetMin),
          ROTULO_EVENTO_DETALHADO[evento.tipoEvento] ?? evento.tipoEvento,
          evento.origemGestor ? 'RH' : 'Motorista',
          temLocalizacao
            ? {
                texto: 'Ver no mapa',
                link: `https://www.google.com/maps/search/?api=1&query=${evento.latitude},${evento.longitude}`,
              }
            : ',',
          evento.detalhe ?? '',
        ],
        false,
      );
    }
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
 * Rodada 83 , pedido do usuário: "no final dos fechamentos deve ter um
 * espaço para o motorista e a empresa contratante assinar". Duas
 * linhas lado a lado (metade da página cada), nome impresso embaixo de
 * cada uma , motorista à esquerda, empresa à direita.
 *
 * Rodada 84 , pedido do usuário: "coloque a assinatura na pagina
 * numero um que trás os totais". Chamada logo depois do resumo diário
 * (ainda na página 1, antes do log detalhado entrar em cena), não mais
 * no fim de tudo , pula de página sozinha só se não sobrar espaço na
 * página atual (ver checagem de `alturaBloco` abaixo).
 */
function desenharBlocoAssinaturas(
  doc: PDFKit.PDFDocument,
  nomeMotorista: string,
  nomeEmpresa: string,
): void {
  const xInicial = doc.page.margins.left;
  const larguraTotal =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const alturaBloco = 70; // espaço da linha de assinatura + nome + margem de respiro

  // Se não sobra espaço suficiente na página atual, começa numa nova ,
  // uma assinatura colada no rodapé da página, sem respiro, não serve
  // pra assinar de verdade (impresso em papel, é o que mais importa aqui).
  const yMaximoUtil = doc.page.height - doc.page.margins.bottom;
  if (doc.y + alturaBloco > yMaximoUtil) {
    doc.addPage();
  }
  doc.moveDown(2);

  const larguraColuna = larguraTotal / 2;
  const larguraLinha = larguraColuna - 30; // recuo pra não encostar no meio nem na margem
  const y = doc.y;

  // Linha do motorista (esquerda) e da empresa contratante (direita).
  doc.strokeColor('#374151');
  doc
    .moveTo(xInicial, y)
    .lineTo(xInicial + larguraLinha, y)
    .stroke();
  doc
    .moveTo(xInicial + larguraColuna, y)
    .lineTo(xInicial + larguraColuna + larguraLinha, y)
    .stroke();

  doc.moveDown(0.3);
  // Mesmo cuidado do resto do arquivo (ver comentário de `desenharLinha`
  // acima sobre o `doc.y` do pdfkit): captura a y ANTES de desenhar a
  // primeira célula da linha , se pegasse `doc.y` DEPOIS, a segunda
  // célula (empresa) começaria abaixo da primeira (motorista) em vez de
  // ao lado, porque `doc.y` já teria avançado pela altura da primeira.
  let yLinha = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
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
  doc.y = yLinha + alturaMaxNome;

  yLinha = doc.y;
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
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
}

/**
 * PDF de apuração de jornada (espelho de ponto categorizado por dia) ,
 * mesma linguagem visual do comprovante de registro (ComprovanteService),
 * mas com uma tabela por dia em vez de lista de eventos, e só com as
 * colunas que o gestor escolheu incluir (opções da Rodada 26). NÃO
 * calcula folha de pagamento completa nem entrega holerite pronto , ver
 * disclaimer impresso no próprio PDF e no FAQ do produto (Rodada 27).
 */
export async function gerarPdfHolerite(
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>,
  empresa: EmpresaDoComprovante,
  resultado: ResultadoHolerite,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finalizado = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).text('FVF Hórus , Apuração de jornada (espelho de ponto)', {
    align: 'center',
  });
  doc.moveDown(0.2);
  doc
    .fontSize(8)
    .fillColor('#6b7280')
    .text(
      'Este documento organiza e categoriza a jornada (direção, espera, normal/extra, noturno) pra apoiar o \n' +
        'fechamento da folha , não é o cálculo completo da folha de pagamento (salário, DSR, verbas) nem o \n' +
        'holerite pronto.',
      { align: 'center' },
    );
  doc.moveDown();

  desenharSecaoMotorista(doc, motorista, empresa, resultado);

  doc.end();
  return finalizado;
}

export interface ItemFechamentoLote {
  motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>;
  empresa: EmpresaDoComprovante;
  resultado: ResultadoHolerite;
}

/**
 * Fechamento em lote (Rodada 36) , um PDF só com uma capa-resumo
 * (tabela motorista × totais de horas do período, pra bater o olho
 * rápido em toda a frota) seguida de uma seção completa por motorista
 * (mesmo conteúdo do PDF individual, `desenharSecaoMotorista`), cada
 * um numa página nova. Pensado pra "fechar o mês" da frota inteira
 * de uma vez, sem depender de baixar um PDF por motorista.
 */
export async function gerarPdfFechamentoLote(
  itens: ItemFechamentoLote[],
  periodoInicio: Date,
  periodoFim: Date,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finalizado = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc
    .fontSize(16)
    .text('FVF Hórus , Fechamento de jornada da frota', { align: 'center' });
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor('#374151')
    .text(
      // Rodada 97 , mesmo bug/correção de desenharSecaoMotorista acima: ver comentário lá.
      `Período: ${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}   |   ` +
        `${itens.length} motorista(s)   |   Gerado em: ${agoraDoCliente()}`,
      { align: 'center' },
    );
  doc.moveDown();
  doc
    .fontSize(8)
    .fillColor('#6b7280')
    .text(
      'Resumo por motorista, seguido do detalhamento diário completo de cada um. Somente horas , nenhum ' +
        'valor monetário é calculado ou exibido; o pagamento é decisão da empresa/RH fora desta plataforma.',
      { align: 'center' },
    );
  doc.moveDown();

  const colunasResumo: Array<{ titulo: string; largura: number }> = [
    { titulo: 'Motorista', largura: 160 },
    { titulo: 'Direção', largura: 65 },
    { titulo: 'Espera', largura: 65 },
    { titulo: 'H. normal', largura: 65 },
    { titulo: 'H. extra', largura: 65 },
    { titulo: 'Hora noturna', largura: 75 },
  ];
  // Mesmo bug (e mesmo fix) de `desenharLinha` em `desenharSecaoMotorista`
  // (Rodada 79): x fixo numa constante (não relido de `doc.x`, que fica
  // torto depois da última célula) + altura da linha calculada pela
  // maior célula (não fica dependente da última coluna estar vazia).
  const xInicialResumo = doc.x;
  const desenharLinhaResumo = (celulas: string[], negrito: boolean) => {
    doc
      .font(negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8)
      .fillColor('#111827');
    let x = xInicialResumo;
    const y = doc.y;
    let alturaLinha = 0;
    for (let i = 0; i < celulas.length; i++) {
      doc.text(celulas[i], x, y, {
        width: colunasResumo[i].largura,
        continued: false,
      });
      alturaLinha = Math.max(
        alturaLinha,
        doc.heightOfString(celulas[i], { width: colunasResumo[i].largura }),
      );
      x += colunasResumo[i].largura;
    }
    doc.y = y + alturaLinha;
    doc.moveDown(0.3);
  };
  desenharLinhaResumo(
    colunasResumo.map((c) => c.titulo),
    true,
  );
  doc
    .moveTo(xInicialResumo, doc.y)
    .lineTo(
      xInicialResumo + colunasResumo.reduce((s, c) => s + c.largura, 0),
      doc.y,
    )
    .strokeColor('#9ca3af')
    .stroke();
  doc.moveDown(0.2);

  const totalGeral = {
    direcaoMin: 0,
    esperaMin: 0,
    normalMin: 0,
    extraMin: 0,
    noturnoMin: 0,
  };
  if (itens.length === 0) {
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text('Nenhum motorista encontrado para este fechamento.');
  }
  for (const item of itens) {
    desenharLinhaResumo(
      [
        item.motorista.nome,
        formatarHoras(item.resultado.totais.direcaoMin),
        formatarHoras(item.resultado.totais.esperaMin),
        formatarHoras(item.resultado.totais.normalMin),
        formatarHoras(item.resultado.totais.extraMin),
        formatarHoras(item.resultado.totais.noturnoMin),
      ],
      false,
    );
    totalGeral.direcaoMin += item.resultado.totais.direcaoMin;
    totalGeral.esperaMin += item.resultado.totais.esperaMin;
    totalGeral.normalMin += item.resultado.totais.normalMin;
    totalGeral.extraMin += item.resultado.totais.extraMin;
    totalGeral.noturnoMin += item.resultado.totais.noturnoMin;
  }
  doc
    .moveTo(xInicialResumo, doc.y)
    .lineTo(
      xInicialResumo + colunasResumo.reduce((s, c) => s + c.largura, 0),
      doc.y,
    )
    .strokeColor('#9ca3af')
    .stroke();
  doc.moveDown(0.2);
  desenharLinhaResumo(
    [
      'Total da frota',
      formatarHoras(totalGeral.direcaoMin),
      formatarHoras(totalGeral.esperaMin),
      formatarHoras(totalGeral.normalMin),
      formatarHoras(totalGeral.extraMin),
      formatarHoras(totalGeral.noturnoMin),
    ],
    true,
  );

  for (const item of itens) {
    doc.addPage();
    desenharSecaoMotorista(doc, item.motorista, item.empresa, item.resultado);
  }

  doc.end();
  return finalizado;
}
