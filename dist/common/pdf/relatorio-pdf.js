"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelatorioPdf = exports.MARGEM_PDF = exports.COR_DESTAQUE_ALERTA = exports.COR_FAIXA = exports.COR_CABECALHO = exports.COR_LINHA = exports.COR_SUAVE = exports.COR_TEXTO = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
exports.COR_TEXTO = '#111827';
exports.COR_SUAVE = '#6b7280';
exports.COR_LINHA = '#d1d5db';
exports.COR_CABECALHO = '#1f2937';
exports.COR_FAIXA = '#f3f4f6';
exports.COR_DESTAQUE_ALERTA = '#b91c1c';
exports.MARGEM_PDF = 48;
class RelatorioPdf {
    doc;
    esquerda;
    largura;
    chunks = [];
    pronto;
    textoRodape;
    constructor(opcoes) {
        this.doc = new pdfkit_1.default({
            margin: exports.MARGEM_PDF,
            size: 'A4',
            bufferPages: true,
            info: {
                Title: opcoes.titulo,
                Author: opcoes.autor ?? 'FVF Hórus',
                Subject: opcoes.assunto ?? opcoes.titulo,
            },
        });
        this.textoRodape = opcoes.rodape;
        this.doc.on('data', (c) => this.chunks.push(c));
        this.pronto = new Promise((resolve, reject) => {
            this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
            this.doc.on('error', reject);
        });
        this.esquerda = this.doc.page.margins.left;
        this.largura =
            this.doc.page.width - this.esquerda - this.doc.page.margins.right;
    }
    limiteY() {
        return this.doc.page.height - this.doc.page.margins.bottom - 20;
    }
    garantirEspaco(altura) {
        if (this.doc.y + altura > this.limiteY())
            this.doc.addPage();
    }
    cabecalho(c) {
        const { doc, esquerda, largura } = this;
        doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(exports.COR_SUAVE)
            .text('FVF HÓRUS', esquerda, doc.y, { characterSpacing: 2 });
        doc.moveDown(0.3);
        doc
            .font('Helvetica-Bold')
            .fontSize(20)
            .fillColor(exports.COR_CABECALHO)
            .text(c.titulo, { width: largura });
        if (c.subtitulo) {
            doc
                .font('Helvetica')
                .fontSize(10)
                .fillColor(exports.COR_SUAVE)
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
                .fillColor(exports.COR_SUAVE)
                .text(c.aviso, esquerda, doc.y, { width: largura, align: 'justify' });
        }
    }
    secao(titulo, subtitulo) {
        const { doc, esquerda, largura } = this;
        this.garantirEspaco(60);
        doc.moveDown(0.8);
        const y = doc.y;
        doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .fillColor(exports.COR_CABECALHO)
            .text(titulo, esquerda, y, { width: largura });
        const yLinha = doc.y + 2;
        doc
            .moveTo(esquerda, yLinha)
            .lineTo(esquerda + largura, yLinha)
            .lineWidth(1)
            .strokeColor(exports.COR_CABECALHO)
            .stroke();
        doc.y = yLinha + 6;
        if (subtitulo) {
            doc
                .font('Helvetica')
                .fontSize(8.5)
                .fillColor(exports.COR_SUAVE)
                .text(subtitulo, esquerda, doc.y, { width: largura });
            doc.moveDown(0.4);
        }
    }
    subsecao(titulo, apoio) {
        const { doc, esquerda, largura } = this;
        this.garantirEspaco(40);
        doc.moveDown(0.4);
        doc
            .font('Helvetica-Bold')
            .fontSize(10.5)
            .fillColor(exports.COR_CABECALHO)
            .text(titulo, esquerda, doc.y, { width: largura });
        if (apoio) {
            doc
                .font('Helvetica')
                .fontSize(8.5)
                .fillColor(exports.COR_SUAVE)
                .text(apoio, esquerda, doc.y, { width: largura });
        }
        doc.moveDown(0.2);
    }
    nota(texto, opcoes) {
        const { doc, esquerda, largura } = this;
        doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor(exports.COR_SUAVE)
            .text(texto, esquerda, doc.y, {
            width: largura,
            align: opcoes?.justificar === false ? 'left' : 'justify',
        });
    }
    paragrafo(texto) {
        const { doc, esquerda, largura } = this;
        doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(exports.COR_TEXTO)
            .text(texto, esquerda, doc.y, { width: largura });
    }
    vazio(msg) {
        const { doc, esquerda, largura } = this;
        doc
            .font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor(exports.COR_SUAVE)
            .text(msg, esquerda, doc.y, { width: largura });
    }
    separador() {
        const { doc, esquerda, largura } = this;
        this.garantirEspaco(12);
        doc.moveDown(0.3);
        doc
            .moveTo(esquerda, doc.y)
            .lineTo(esquerda + largura, doc.y)
            .lineWidth(0.4)
            .strokeColor(exports.COR_LINHA)
            .stroke();
        doc.moveDown(0.4);
    }
    camposChaveValor(pares, larguraRotulo = 130) {
        const { doc, esquerda, largura } = this;
        for (const [rot, val] of pares) {
            this.garantirEspaco(18);
            const y = doc.y;
            doc
                .font('Helvetica-Bold')
                .fontSize(9)
                .fillColor(exports.COR_SUAVE)
                .text(rot, esquerda, y, { width: larguraRotulo });
            const yFim1 = doc.y;
            doc
                .font('Helvetica')
                .fontSize(10)
                .fillColor(exports.COR_TEXTO)
                .text(val, esquerda + larguraRotulo, y, {
                width: largura - larguraRotulo,
            });
            doc.y = Math.max(yFim1, doc.y) + 3;
        }
    }
    tabela(colunas, linhas, opcoes) {
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
            doc.rect(esquerda, y, largura, 16).fill(exports.COR_CABECALHO);
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
            const alturas = cels.map((c, i) => doc.heightOfString(c, { width: ws[i] - pad * 2 }));
            const h = Math.max(...alturas) + 6;
            if (doc.y + h > this.limiteY()) {
                doc.addPage();
                cabecalho();
            }
            const y = doc.y;
            if (idx % 2 === 1)
                doc.rect(esquerda, y, largura, h).fill(exports.COR_FAIXA);
            if (total) {
                doc
                    .moveTo(esquerda, y)
                    .lineTo(esquerda + largura, y)
                    .lineWidth(1)
                    .strokeColor(exports.COR_CABECALHO)
                    .stroke();
            }
            doc.font(total ? 'Helvetica-Bold' : 'Helvetica').fontSize(fonte);
            let x = esquerda;
            cels.forEach((c, i) => {
                const link = opcoes?.links?.[idx]?.[i];
                doc.fillColor(link ? '#1a56db' : exports.COR_TEXTO);
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
                .strokeColor(exports.COR_LINHA)
                .stroke();
            doc.y = y + h;
        });
    }
    static limitar(itens, max, complemento = '') {
        if (itens.length <= max)
            return { itens, nota: null };
        return {
            itens: itens.slice(0, max),
            nota: `Exibidos os ${max} mais recentes de ${itens.length}.${complemento ? ` ${complemento}` : ''}`,
        };
    }
    finalizar() {
        const { doc, esquerda, largura } = this;
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const y = doc.page.height - doc.page.margins.bottom + 8;
            doc.page.margins.bottom = 0;
            doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(exports.COR_SUAVE)
                .text(`FVF Hórus - ${this.textoRodape} - Página ${i + 1} de ${range.count}`, esquerda, y, { width: largura, align: 'center', lineBreak: false });
        }
        doc.end();
        return this.pronto;
    }
}
exports.RelatorioPdf = RelatorioPdf;
//# sourceMappingURL=relatorio-pdf.js.map