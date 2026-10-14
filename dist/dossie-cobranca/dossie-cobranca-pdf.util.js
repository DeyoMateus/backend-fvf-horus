"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarPdfDossieCobranca = gerarPdfDossieCobranca;
const relatorio_pdf_1 = require("../common/pdf/relatorio-pdf");
const fuso_contexto_1 = require("../common/fuso/fuso-contexto");
function formatarHoras(minutos) {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return `${h}h${String(m).padStart(2, '0')}`;
}
async function gerarPdfDossieCobranca(itens, empresaNome, periodoInicio, periodoFim) {
    const r = new relatorio_pdf_1.RelatorioPdf({
        titulo: 'Dossiê de Cobrança - Tempo de Espera em Carga/Descarga',
        rodape: 'Dossiê de cobrança',
    });
    r.cabecalho({
        titulo: 'Dossiê de Cobrança',
        subtitulo: 'Tempo de espera em carga/descarga',
        campos: [
            ['Empresa', empresaNome],
            [
                'Período',
                `${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
            ],
            ['Gerado em', (0, fuso_contexto_1.agoraDoCliente)()],
        ],
        aviso: 'Base legal: Lei 13.103/2015 (Lei do Motorista), art. 235-A, §9º , o tempo de espera para carga/descarga ' +
            'que excede 5 (cinco) horas na mesma jornada pode ser cobrado do embarcador/contratante do frete. Este ' +
            'documento reúne as ocorrências detectadas automaticamente pelo motor de limites legais, com data, horários ' +
            'e duração de cada espera. O valor a cobrar (frete/hora acordado) não é calculado aqui , preencher ' +
            'manualmente na conferência com o setor de faturamento.',
    });
    r.doc.moveDown(0.8);
    r.secao('Ocorrências', `${itens.length} ocorrência(s) no período`);
    if (itens.length === 0) {
        r.vazio('Nenhuma ocorrência de espera acima do limiar legal neste período.');
        return r.finalizar();
    }
    for (const item of itens) {
        r.garantirEspaco(110);
        r.subsecao(item.motoristaNome, `CPF: ${item.motoristaCpf}   |   Ocorrência detectada em: ${(0, fuso_contexto_1.instanteDoEvento)(item.criadoEm, item.fusoCriadoEmMin)}`);
        r.camposChaveValor([
            [
                'Janela avaliada',
                `${(0, fuso_contexto_1.instanteDoEvento)(new Date(item.periodoInicio), item.fusoPeriodoInicioMin)} até ${(0, fuso_contexto_1.instanteDoEvento)(new Date(item.periodoFim), item.fusoPeriodoFimMin)}`,
            ],
            ['Total de espera', formatarHoras(item.minutosTotais)],
        ]);
        r.tabela([
            { titulo: 'Início', largura: 4 },
            { titulo: 'Fim', largura: 4 },
            { titulo: 'Duração', largura: 2, alinhamento: 'right' },
        ], item.intervalos.map((intervalo) => {
            const inicio = new Date(intervalo.inicio);
            const fim = new Date(intervalo.fim);
            const duracaoMin = Math.round((fim.getTime() - inicio.getTime()) / 60000);
            return [
                (0, fuso_contexto_1.instanteDoEvento)(inicio, intervalo.fusoInicioMin),
                (0, fuso_contexto_1.instanteDoEvento)(fim, intervalo.fusoFimMin),
                formatarHoras(duracaoMin),
            ];
        }));
        r.doc.moveDown(0.3);
        r.nota(item.observacao, { justificar: false });
        r.doc.moveDown(0.6);
    }
    return r.finalizar();
}
//# sourceMappingURL=dossie-cobranca-pdf.util.js.map