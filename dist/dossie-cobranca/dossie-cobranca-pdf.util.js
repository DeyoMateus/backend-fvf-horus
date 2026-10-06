"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarPdfDossieCobranca = gerarPdfDossieCobranca;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fuso_contexto_1 = require("../common/fuso/fuso-contexto");
function formatarHoras(minutos) {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return `${h}h${String(m).padStart(2, '0')}`;
}
async function gerarPdfDossieCobranca(itens, empresaNome, periodoInicio, periodoFim) {
    const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const finalizado = new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
    doc
        .fontSize(16)
        .text('Dossiê de Cobrança , Tempo de Espera em Carga/Descarga', {
        align: 'center',
    });
    doc.moveDown(0.2);
    doc
        .fontSize(9)
        .fillColor('#374151')
        .text(`${empresaNome}   |   Período: ${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}   |   Gerado em: ${(0, fuso_contexto_1.agoraDoCliente)()}`, { align: 'center' });
    doc.moveDown();
    doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Base legal: Lei 13.103/2015 (Lei do Motorista), art. 235-A, §9º , o tempo de espera para carga/descarga ' +
        'que excede 5 (cinco) horas na mesma jornada pode ser cobrado do embarcador/contratante do frete. Este ' +
        'documento reúne as ocorrências detectadas automaticamente pelo motor de limites legais, com data, horários ' +
        'e duração de cada espera. O valor a cobrar (frete/hora acordado) não é calculado aqui , preencher ' +
        'manualmente na conferência com o setor de faturamento.', { align: 'left' });
    doc.moveDown();
    if (itens.length === 0) {
        doc
            .fontSize(10)
            .fillColor('#6b7280')
            .text('Nenhuma ocorrência de espera acima do limiar legal neste período.');
        doc.end();
        return finalizado;
    }
    for (const item of itens) {
        doc
            .fontSize(11)
            .fillColor('#111827')
            .font('Helvetica-Bold')
            .text(item.motoristaNome);
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#374151')
            .text(`CPF: ${item.motoristaCpf}   |   Ocorrência detectada em: ${(0, fuso_contexto_1.instanteDoEvento)(item.criadoEm, item.fusoCriadoEmMin)}`);
        doc.text(`Janela avaliada: ${(0, fuso_contexto_1.instanteDoEvento)(new Date(item.periodoInicio), item.fusoPeriodoInicioMin)} até ${(0, fuso_contexto_1.instanteDoEvento)(new Date(item.periodoFim), item.fusoPeriodoFimMin)}`);
        doc
            .font('Helvetica-Bold')
            .text(`Total de espera: ${formatarHoras(item.minutosTotais)}`);
        doc.font('Helvetica').moveDown(0.2);
        doc.fontSize(9).text('Intervalos de espera:');
        for (const intervalo of item.intervalos) {
            const inicio = new Date(intervalo.inicio);
            const fim = new Date(intervalo.fim);
            const duracaoMin = Math.round((fim.getTime() - inicio.getTime()) / 60000);
            doc.text(`  • ${(0, fuso_contexto_1.instanteDoEvento)(inicio, intervalo.fusoInicioMin)} → ${(0, fuso_contexto_1.instanteDoEvento)(fim, intervalo.fusoFimMin)} (${formatarHoras(duracaoMin)})`);
        }
        doc.fontSize(8).fillColor('#6b7280').text(item.observacao);
        doc.fillColor('#111827');
        doc.moveDown(0.6);
        doc
            .moveTo(doc.x, doc.y)
            .lineTo(doc.x + 515, doc.y)
            .strokeColor('#e5e7eb')
            .stroke();
        doc.moveDown(0.6);
    }
    doc.end();
    return finalizado;
}
//# sourceMappingURL=dossie-cobranca-pdf.util.js.map