import PDFDocument from 'pdfkit';

/**
 * Rodada 232: modelo visual ÚNICO dos PDFs gerados pelo FVF Hórus.
 *
 * Nasceu do PDF "Cópia dos dados pessoais" (privacidade-pdf.util.ts, rodada
 * 218) e passou a valer para todos os demais (comprovante, holerite,
 * espelho REP-P, dossiê de cobrança, capa dos espelhos em lote). Mesmo
 * layout, cores e espaçamentos em todos:
 *
 *  - A4, margem 48;
 *  - cabeçalho: marca "FVF HÓRUS" pequena e espaçada, título 20 negrito,
 *    subtítulo cinza e, abaixo, pares "rótulo: valor" e um aviso justificado;
 *  - seções numeradas ou não: título 12 negrito com uma régua escura embaixo
 *    e, opcionalmente, uma linha de apoio cinza;
 *  - tabelas: faixa de cabeçalho escura com texto branco, linhas zebradas
 *    claras e filete cinza entre as linhas, repetindo o cabeçalho em cada página;
 *  - rodapé em todas as páginas: "FVF Hórus - <documento> - Página X de Y".
 *
 * Qualquer ajuste de aparência deve ser feito AQUI, para os documentos
 * continuarem iguais entre si.
 */

export const COR_TEXTO = '#111827';
export const COR_SUAVE = '#6b7280';
export const COR_LINHA = '#d1d5db';
export const COR_CABECALHO = '#1f2937';
export const COR_FAIXA = '#f3f4f6';
export const COR_DESTAQUE_ALERTA = '#b91c1c';

export const MARGEM_PDF = 48;

export interface ColunaPdf {
  titulo: string;
  /** Largura relativa (proporcional às demais colunas). */
  largura: number;
  alinhamento?: 'left' | 'right' | 'center';
}

export interface OpcoesRelatorioPdf {
  /** Título do documento nos metadados do arquivo. */
  titulo: string;
  assunto?: string;
  /** Texto do rodapé, antes de "Página X de Y" (ex.: "Cópia dos dados pessoais"). */
  rodape: string;
  autor?: string;
}

export interface CabecalhoPdf {
  titulo: string;
  subtitulo?: string;
  /** Pares "rótulo: valor" logo abaixo do título. */
  campos?: Array<[string, string]>;
  /** Parágrafo justificado, em cinza, abaixo dos campos. */
  aviso?: string;
}

export class RelatorioPdf {
  readonly doc: PDFKit.PDFDocument;
  readonly esquerda: number;
  readonly largura: number;
  private readonly chunks: Buffer[] = [];
  private readonly pronto: Promise<Buffer>;
  private readonly textoRodape: string;

  constructor(opcoes: OpcoesRelatorioPdf) {
    this.doc = new PDFDocument({
      margin: MARGEM_PDF,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: opcoes.titulo,
        Author: opcoes.autor ?? 'FVF Hórus',
        Subject: opcoes.assunto ?? opcoes.titulo,
      },
    });
    this.textoRodape = opcoes.rodape;
    this.doc.on('data', (c: Buffer) => this.chunks.push(c));
    this.pronto = new Promise<Buffer>((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });
    this.esquerda = this.doc.page.margins.left;
    this.largura =
      this.doc.page.width - this.esquerda - this.doc.page.margins.right;
  }

  /** Limite vertical útil da página atual (deixa folga para o rodapé). */
  limiteY(): number {
    return this.doc.page.height - this.doc.page.margins.bottom - 20;
  }

  garantirEspaco(altura: number): void {
    if (this.doc.y + altura > this.limiteY()) this.doc.addPage();
  }

  /** Marca, título, subtítulo, campos e aviso do início do documento. */
  cabecalho(c: CabecalhoPdf): void {
    const { doc, esquerda, largura } = this;
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
      .text(c.titulo, { width: largura });
    if (c.subtitulo) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COR_SUAVE)
        .text(c.subtitulo, { width: largura });
    }
    if (c.campos?.length) {
      doc.moveDown(0.6);
      this.camposChaveValor(c.campos);
    }
    if (c.aviso) {
      doc.moveDown(0.2);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COR_SUAVE)
        .text(c.aviso, esquerda, doc.y, { width: largura, align: 'justify' });
    }
  }

  /** Título 12 negrito com régua escura embaixo e linha de apoio opcional. */
  secao(titulo: string, subtitulo?: string): void {
    const { doc, esquerda, largura } = this;
    this.garantirEspaco(60);
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

  /** Subtítulo dentro de uma seção (ex.: o nome do motorista em um documento por motorista). */
  subsecao(titulo: string, apoio?: string): void {
    const { doc, esquerda, largura } = this;
    this.garantirEspaco(40);
    doc.moveDown(0.4);
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(COR_CABECALHO)
      .text(titulo, esquerda, doc.y, { width: largura });
    if (apoio) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COR_SUAVE)
        .text(apoio, esquerda, doc.y, { width: largura });
    }
    doc.moveDown(0.2);
  }

  /** Texto corrido em cinza (observações, bases legais, avisos). */
  nota(texto: string, opcoes?: { justificar?: boolean }): void {
    const { doc, esquerda, largura } = this;
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COR_SUAVE)
      .text(texto, esquerda, doc.y, {
        width: largura,
        align: opcoes?.justificar === false ? 'left' : 'justify',
      });
  }

  /** Texto corrido normal, 10 pt. */
  paragrafo(texto: string): void {
    const { doc, esquerda, largura } = this;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COR_TEXTO)
      .text(texto, esquerda, doc.y, { width: largura });
  }

  /** Mensagem de "nenhum registro" (itálico cinza). */
  vazio(msg: string): void {
    const { doc, esquerda, largura } = this;
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(COR_SUAVE)
      .text(msg, esquerda, doc.y, { width: largura });
  }

  /** Filete cinza horizontal entre blocos. */
  separador(): void {
    const { doc, esquerda, largura } = this;
    this.garantirEspaco(12);
    doc.moveDown(0.3);
    doc
      .moveTo(esquerda, doc.y)
      .lineTo(esquerda + largura, doc.y)
      .lineWidth(0.4)
      .strokeColor(COR_LINHA)
      .stroke();
    doc.moveDown(0.4);
  }

  camposChaveValor(
    pares: Array<[string, string]>,
    larguraRotulo = 130,
  ): void {
    const { doc, esquerda, largura } = this;
    for (const [rot, val] of pares) {
      this.garantirEspaco(18);
      const y = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COR_SUAVE)
        .text(rot, esquerda, y, { width: larguraRotulo });
      const yFim1 = doc.y;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(COR_TEXTO)
        .text(val, esquerda + larguraRotulo, y, {
          width: largura - larguraRotulo,
        });
      doc.y = Math.max(yFim1, doc.y) + 3;
    }
  }

  /**
   * Tabela com faixa de cabeçalho escura e linhas zebradas. O cabeçalho é
   * repetido ao quebrar de página.
   */
  tabela(
    colunas: ColunaPdf[],
    linhas: string[][],
    opcoes?: {
      tamanhoFonte?: number;
      /** Destaca a última linha (totais): negrito e filete escuro acima. */
      ultimaLinhaTotal?: boolean;
      /** Links por célula (mesmo formato de `linhas`); célula com link fica azul e sublinhada. */
      links?: Array<Array<string | undefined>>;
    },
  ): void {
    const { doc, esquerda, largura } = this;
    const fonte = opcoes?.tamanhoFonte ?? 8;
    const soma = colunas.reduce((a, c) => a + c.largura, 0);
    const esc = largura / soma;
    const ws = colunas.map((c) => c.largura * esc);
    const pad = 4;

    const cabecalho = () => {
      this.garantirEspaco(26);
      let x = esquerda;
      const y = doc.y;
      doc.rect(esquerda, y, largura, 16).fill(COR_CABECALHO);
      doc.font('Helvetica-Bold').fontSize(fonte).fillColor('#ffffff');
      colunas.forEach((c, i) => {
        doc.text(c.titulo, x + pad, y + 4, {
          width: ws[i] - pad * 2,
          lineBreak: false,
          ellipsis: true,
          align: c.alinhamento ?? 'left',
        });
        x += ws[i];
      });
      doc.y = y + 16;
    };

    cabecalho();
    linhas.forEach((cels, idx) => {
      const total = Boolean(opcoes?.ultimaLinhaTotal) && idx === linhas.length - 1;
      doc.font(total ? 'Helvetica-Bold' : 'Helvetica').fontSize(fonte);
      const alturas = cels.map((c, i) =>
        doc.heightOfString(c, { width: ws[i] - pad * 2 }),
      );
      const h = Math.max(...alturas) + 6;
      if (doc.y + h > this.limiteY()) {
        doc.addPage();
        cabecalho();
      }
      const y = doc.y;
      if (idx % 2 === 1) doc.rect(esquerda, y, largura, h).fill(COR_FAIXA);
      if (total) {
        doc
          .moveTo(esquerda, y)
          .lineTo(esquerda + largura, y)
          .lineWidth(1)
          .strokeColor(COR_CABECALHO)
          .stroke();
      }
      doc.font(total ? 'Helvetica-Bold' : 'Helvetica').fontSize(fonte);
      let x = esquerda;
      cels.forEach((c, i) => {
        const link = opcoes?.links?.[idx]?.[i];
        doc.fillColor(link ? '#1a56db' : COR_TEXTO);
        doc.text(c, x + pad, y + 3, {
          width: ws[i] - pad * 2,
          align: colunas[i].alinhamento ?? 'left',
          ...(link ? { link, underline: true } : {}),
        });
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

  /** Corta a lista ao limite e devolve a nota "Exibidos os N mais recentes de M". */
  static limitar<T>(
    itens: T[],
    max: number,
    complemento = '',
  ): { itens: T[]; nota: string | null } {
    if (itens.length <= max) return { itens, nota: null };
    return {
      itens: itens.slice(0, max),
      nota: `Exibidos os ${max} mais recentes de ${itens.length}.${complemento ? ` ${complemento}` : ''}`,
    };
  }

  /** Escreve o rodapé com paginação em todas as páginas e fecha o PDF. */
  finalizar(): Promise<Buffer> {
    const { doc, esquerda, largura } = this;
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
          `FVF Hórus - ${this.textoRodape} - Página ${i + 1} de ${range.count}`,
          esquerda,
          y,
          { width: largura, align: 'center', lineBreak: false },
        );
    }
    doc.end();
    return this.pronto;
  }
}
