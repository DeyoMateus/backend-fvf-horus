"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarPdfHolerite = gerarPdfHolerite;
exports.gerarPdfFechamentoLote = gerarPdfFechamentoLote;
const pdfkit_1 = __importDefault(require("pdfkit"));
function formatarDiaBr(diaIso) {
    const [ano, mes, dia] = diaIso.split('-');
    return `${dia}/${mes}/${ano}`;
}
function formatarHoras(minutos) {
    const h = Math.floor(Math.abs(minutos) / 60);
    const m = Math.round(Math.abs(minutos) % 60);
    return `${minutos < 0 ? '-' : ''}${h}h${String(m).padStart(2, '0')}`;
}
const ROTULO_EVENTO_DETALHADO = {
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
function formatarDataHoraBr(data) {
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    const hora = String(data.getUTCHours()).padStart(2, '0');
    const minuto = String(data.getUTCMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}
function desenharSecaoMotorista(doc, motorista, empresa, resultado) {
    doc.fontSize(10).fillColor('#374151');
    doc.font('Helvetica-Bold').text(`Empregador: ${empresa.razaoSocial}`);
    doc.font('Helvetica').text(`CNPJ: ${empresa.cnpj}`);
    doc.moveDown(0.5);
    doc.text(`Motorista: ${motorista.nome}`);
    doc.text(`CPF: ${motorista.cpf}   CNH: ${motorista.cnh}`);
    doc.text(`Período: ${resultado.periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${resultado.periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    if (resultado.regraSindicalAplicada) {
        doc.text(`Convenção coletiva aplicada: ${resultado.regraSindicalAplicada.nome}`);
    }
    doc.moveDown();
    const colunas = [{ titulo: 'Dia', largura: 70, valor: (d) => formatarDiaBr(d.dia) }];
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
    const xInicial = doc.x;
    const desenharLinha = (celulas, negrito) => {
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
            alturaLinha = Math.max(alturaLinha, doc.heightOfString(celulas[i], { width: colunas[i].largura }));
            x += colunas[i].largura;
        }
        doc.y = y + alturaLinha;
        doc.moveDown(0.3);
    };
    desenharLinha(colunas.map((c) => c.titulo), true);
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
        desenharLinha(colunas.map((c) => c.valor(dia)), false);
    }
    doc.moveDown();
    doc
        .moveTo(xInicial, doc.y)
        .lineTo(xInicial + colunas.reduce((s, c) => s + c.largura, 0), doc.y)
        .strokeColor('#9ca3af')
        .stroke();
    doc.moveDown(0.3);
    const totalLinha = ['Total'];
    if (resultado.opcoes.direcaoEspera) {
        totalLinha.push(formatarHoras(resultado.totais.direcaoMin), formatarHoras(resultado.totais.esperaMin));
    }
    if (resultado.opcoes.normalExtra) {
        totalLinha.push(formatarHoras(resultado.totais.normalMin), formatarHoras(resultado.totais.extraMin));
    }
    if (resultado.opcoes.adicionalNoturno) {
        totalLinha.push(formatarHoras(resultado.totais.noturnoMin));
    }
    totalLinha.push('');
    desenharLinha(totalLinha, true);
    doc.moveDown();
    const larguraTotalPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Dias marcados como "Fechado p/ gestor" incluem ajuste lançado pela empresa (ponto que o motorista ' +
        'esqueceu de bater), com evidência anexada e notificação enviada ao app do motorista , ver histórico ' +
        'de ajustes dele para o motivo e os comprovantes. Este documento é gerado a partir do ledger imutável ' +
        'do motorista (registros de ponto) combinado com os ajustes registrados pelo gestor no período.', xInicial, doc.y, { width: larguraTotalPagina, align: 'justify' });
    desenharBlocoAssinaturas(doc, motorista.nome, empresa.razaoSocial);
    doc.addPage();
    const colunasDetalhe = [
        { titulo: 'Data/Hora', largura: 85 },
        { titulo: 'Evento (status da ação)', largura: 130 },
        { titulo: 'Origem', largura: 50 },
        { titulo: 'Localização', largura: 90 },
        { titulo: 'Motivo/Observação', largura: 160 },
    ];
    const xInicialDetalhe = doc.page.margins.left;
    const yMaximoUtil = doc.page.height - doc.page.margins.bottom;
    const desenharLinhaDetalhe = (celulas, negrito) => {
        let x = xInicialDetalhe;
        const y = doc.y;
        let alturaLinha = 0;
        for (let i = 0; i < celulas.length; i++) {
            const celula = typeof celulas[i] === 'string'
                ? { texto: celulas[i] }
                : celulas[i];
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
            alturaLinha = Math.max(alturaLinha, doc.heightOfString(celula.texto, { width: colunasDetalhe[i].largura }));
            x += colunasDetalhe[i].largura;
        }
        doc.y = y + alturaLinha;
        doc.moveDown(0.3);
    };
    const desenharCabecalhoColunas = () => {
        doc.x = xInicialDetalhe;
        desenharLinhaDetalhe(colunasDetalhe.map((c) => c.titulo), true);
        doc
            .moveTo(xInicialDetalhe, doc.y)
            .lineTo(xInicialDetalhe + colunasDetalhe.reduce((s, c) => s + c.largura, 0), doc.y)
            .strokeColor('#9ca3af')
            .stroke();
        doc.moveDown(0.2);
    };
    const quebrarPaginaSeNecessario = (alturaNecessaria) => {
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
        .text('Os eventos abaixo estão agrupados por jornada , do "Início de jornada" até o "Fim de jornada" ' +
        'correspondente batido pelo motorista (uma jornada pode ter mais de um dia, e o mesmo dia pode ter ' +
        'mais de uma jornada). Mesmos eventos que compõem os totais da folha anterior.', xInicialDetalhe, doc.y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
    doc.moveDown(0.5);
    desenharCabecalhoColunas();
    if (resultado.eventos.length === 0) {
        doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text('Nenhum evento registrado (nem ajustado pelo gestor) no período.', xInicialDetalhe, doc.y);
    }
    const blocos = [];
    const avulsos = [];
    let atual = null;
    const fecharAtual = (fimJornada) => {
        if (!atual)
            return;
        const inicio = atual[0];
        const duracaoMin = fimJornada
            ? Math.round((fimJornada.timestampEvento.getTime() -
                inicio.timestampEvento.getTime()) /
                60000)
            : null;
        const tituloFim = fimJornada
            ? formatarDataHoraBr(fimJornada.timestampEvento)
            : 'em aberto no fim do período';
        const sufixoDuracao = duracaoMin !== null ? `  •  duração ${formatarHoras(duracaoMin)}` : '';
        blocos.push({
            titulo: `${formatarDataHoraBr(inicio.timestampEvento)} até ${tituloFim}${sufixoDuracao}`,
            eventos: atual,
        });
        atual = null;
    };
    for (const evento of resultado.eventos) {
        if (evento.tipoEvento === 'INICIO_JORNADA') {
            fecharAtual(null);
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
    fecharAtual(null);
    const desenharBlocoDeEventos = (titulo, eventos) => {
        quebrarPaginaSeNecessario(18 + 24);
        doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#1f2937')
            .text(titulo, xInicialDetalhe, doc.y, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
        doc.moveDown(0.2);
        for (const evento of eventos) {
            quebrarPaginaSeNecessario(24);
            const temLocalizacao = evento.latitude != null && evento.longitude != null;
            desenharLinhaDetalhe([
                formatarDataHoraBr(evento.timestampEvento),
                ROTULO_EVENTO_DETALHADO[evento.tipoEvento] ?? evento.tipoEvento,
                evento.origemGestor ? 'RH' : 'Motorista',
                temLocalizacao
                    ? {
                        texto: 'Ver no mapa',
                        link: `https://www.google.com/maps/search/?api=1&query=${evento.latitude},${evento.longitude}`,
                    }
                    : ',',
                evento.detalhe ?? '',
            ], false);
        }
        doc.moveDown(0.4);
    };
    if (avulsos.length > 0) {
        desenharBlocoDeEventos('Eventos fora de uma jornada identificada (sem "Início de jornada" correspondente no período)', avulsos);
    }
    blocos.forEach((bloco, indice) => {
        desenharBlocoDeEventos(`Jornada ${indice + 1} , ${bloco.titulo}`, bloco.eventos);
    });
}
function desenharBlocoAssinaturas(doc, nomeMotorista, nomeEmpresa) {
    const xInicial = doc.page.margins.left;
    const larguraTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const alturaBloco = 70;
    const yMaximoUtil = doc.page.height - doc.page.margins.bottom;
    if (doc.y + alturaBloco > yMaximoUtil) {
        doc.addPage();
    }
    doc.moveDown(2);
    const larguraColuna = larguraTotal / 2;
    const larguraLinha = larguraColuna - 30;
    const y = doc.y;
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
    const alturaMaxNome = Math.max(alturaNome, doc.heightOfString(nomeEmpresa, { width: larguraLinha }));
    doc.y = yLinha + alturaMaxNome;
    yLinha = doc.y;
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
    doc.text('Assinatura do motorista', xInicial, yLinha, {
        width: larguraLinha,
        align: 'center',
    });
    doc.text('Assinatura da empresa contratante', xInicial + larguraColuna, yLinha, { width: larguraLinha, align: 'center' });
}
async function gerarPdfHolerite(motorista, empresa, resultado) {
    const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const finalizado = new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
    doc
        .fontSize(16)
        .text('FVF Hórus , Apuração de jornada (espelho de ponto)', {
        align: 'center',
    });
    doc.moveDown(0.2);
    doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Este documento organiza e categoriza a jornada (direção, espera, normal/extra, noturno) pra apoiar o \n' +
        'fechamento da folha , não é o cálculo completo da folha de pagamento (salário, DSR, verbas) nem o \n' +
        'holerite pronto.', { align: 'center' });
    doc.moveDown();
    desenharSecaoMotorista(doc, motorista, empresa, resultado);
    doc.end();
    return finalizado;
}
async function gerarPdfFechamentoLote(itens, periodoInicio, periodoFim) {
    const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const finalizado = new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
    doc
        .fontSize(16)
        .text('FVF Hórus , Fechamento de jornada da frota', { align: 'center' });
    doc.moveDown(0.2);
    doc
        .fontSize(9)
        .fillColor('#374151')
        .text(`Período: ${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}   |   ` +
        `${itens.length} motorista(s)   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown();
    doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Resumo por motorista, seguido do detalhamento diário completo de cada um. Somente horas , nenhum ' +
        'valor monetário é calculado ou exibido; o pagamento é decisão da empresa/RH fora desta plataforma.', { align: 'center' });
    doc.moveDown();
    const colunasResumo = [
        { titulo: 'Motorista', largura: 160 },
        { titulo: 'Direção', largura: 65 },
        { titulo: 'Espera', largura: 65 },
        { titulo: 'H. normal', largura: 65 },
        { titulo: 'H. extra', largura: 65 },
        { titulo: 'Hora noturna', largura: 75 },
    ];
    const xInicialResumo = doc.x;
    const desenharLinhaResumo = (celulas, negrito) => {
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
            alturaLinha = Math.max(alturaLinha, doc.heightOfString(celulas[i], { width: colunasResumo[i].largura }));
            x += colunasResumo[i].largura;
        }
        doc.y = y + alturaLinha;
        doc.moveDown(0.3);
    };
    desenharLinhaResumo(colunasResumo.map((c) => c.titulo), true);
    doc
        .moveTo(xInicialResumo, doc.y)
        .lineTo(xInicialResumo + colunasResumo.reduce((s, c) => s + c.largura, 0), doc.y)
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
        desenharLinhaResumo([
            item.motorista.nome,
            formatarHoras(item.resultado.totais.direcaoMin),
            formatarHoras(item.resultado.totais.esperaMin),
            formatarHoras(item.resultado.totais.normalMin),
            formatarHoras(item.resultado.totais.extraMin),
            formatarHoras(item.resultado.totais.noturnoMin),
        ], false);
        totalGeral.direcaoMin += item.resultado.totais.direcaoMin;
        totalGeral.esperaMin += item.resultado.totais.esperaMin;
        totalGeral.normalMin += item.resultado.totais.normalMin;
        totalGeral.extraMin += item.resultado.totais.extraMin;
        totalGeral.noturnoMin += item.resultado.totais.noturnoMin;
    }
    doc
        .moveTo(xInicialResumo, doc.y)
        .lineTo(xInicialResumo + colunasResumo.reduce((s, c) => s + c.largura, 0), doc.y)
        .strokeColor('#9ca3af')
        .stroke();
    doc.moveDown(0.2);
    desenharLinhaResumo([
        'Total da frota',
        formatarHoras(totalGeral.direcaoMin),
        formatarHoras(totalGeral.esperaMin),
        formatarHoras(totalGeral.normalMin),
        formatarHoras(totalGeral.extraMin),
        formatarHoras(totalGeral.noturnoMin),
    ], true);
    for (const item of itens) {
        doc.addPage();
        desenharSecaoMotorista(doc, item.motorista, item.empresa, item.resultado);
    }
    doc.end();
    return finalizado;
}
//# sourceMappingURL=holerite-pdf.util.js.map