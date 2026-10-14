"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarPdfHolerite = gerarPdfHolerite;
exports.gerarPdfFechamentoLote = gerarPdfFechamentoLote;
const relatorio_pdf_1 = require("../common/pdf/relatorio-pdf");
const fuso_contexto_1 = require("../common/fuso/fuso-contexto");
const fuso_brasil_util_1 = require("../common/fuso/fuso-brasil.util");
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
function horaDoEvento(evento, fusoEmpresaOffsetMin) {
    const offset = evento.fusoOffsetMin ?? fusoEmpresaOffsetMin;
    const texto = (0, fuso_brasil_util_1.formatarDataHoraBrt)(evento.timestampEvento, offset);
    return offset === fusoEmpresaOffsetMin
        ? texto
        : `${texto} (${(0, fuso_brasil_util_1.rotuloFuso)(offset)})`;
}
function desenharSecaoMotorista(rel, motorista, empresa, resultado) {
    const doc = rel.doc;
    rel.secao('Identificação');
    const pares = [
        ['Empregador', empresa.razaoSocial],
        ['CNPJ', empresa.cnpj],
        ['Motorista', motorista.nome],
        ['CPF', motorista.cpf],
        ['CNH', motorista.cnh],
        [
            'Período',
            `${resultado.periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${resultado.periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
        ],
        ['Gerado em', (0, fuso_contexto_1.agoraDoCliente)()],
    ];
    if (resultado.regraSindicalAplicada) {
        pares.push([
            'Convenção coletiva aplicada',
            resultado.regraSindicalAplicada.nome,
        ]);
    }
    rel.camposChaveValor(pares, 150);
    const colunas = [
        {
            titulo: 'Dia',
            largura: 70,
            valor: (d) => formatarDiaBr(d.dia),
        },
    ];
    const horas = (titulo, largura, campo) => colunas.push({
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
    if (resultado.opcoes.adicionalNoturno)
        horas('Hora noturna', 75, 'noturnoMin');
    colunas.push({
        titulo: 'Obs.',
        largura: 80,
        valor: (d) => (d.teveFechamentoGestor ? 'Fechado p/ gestor' : ''),
    });
    rel.secao('Apuração por dia');
    const linhas = resultado.dias.map((d) => colunas.map((c) => c.valor(d)));
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
    if (resultado.dias.length === 0) {
        rel.vazio('Nenhum ponto registrado (ou ajustado pelo gestor) no período.');
        doc.moveDown(0.3);
    }
    rel.tabela(colunas, [...linhas, totalLinha], {
        tamanhoFonte: 8.5,
        ultimaLinhaTotal: true,
    });
    doc.moveDown(0.8);
    rel.nota('Dias marcados como "Fechado p/ gestor" incluem ajuste lançado pela empresa (ponto que o motorista ' +
        'esqueceu de bater), com evidência anexada e notificação enviada ao app do motorista , ver histórico ' +
        'de ajustes dele para o motivo e os comprovantes. Este documento é gerado a partir do ledger imutável ' +
        'do motorista (registros de ponto) combinado com os ajustes registrados pelo gestor no período.');
    desenharBlocoAssinaturas(rel, motorista.nome, empresa.razaoSocial);
    doc.addPage();
    rel.secao('Registros detalhados do período', 'Os eventos abaixo estão agrupados por jornada , do "Início de jornada" até o "Fim de jornada" ' +
        'correspondente batido pelo motorista (uma jornada pode ter mais de um dia, e o mesmo dia pode ter ' +
        'mais de uma jornada). Mesmos eventos que compõem os totais da folha anterior.');
    if (resultado.eventos.length === 0) {
        rel.vazio('Nenhum evento registrado (nem ajustado pelo gestor) no período.');
    }
    const fusoEmpresaOffsetMin = resultado.fusoEmpresaOffsetMin ?? fuso_brasil_util_1.OFFSET_PADRAO_MIN;
    const colunasDetalhe = [
        { titulo: 'Data/Hora', largura: 85 },
        { titulo: 'Evento (status da ação)', largura: 130 },
        { titulo: 'Origem', largura: 50 },
        { titulo: 'Localização', largura: 90 },
        { titulo: 'Motivo/Observação', largura: 160 },
    ];
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
            ? horaDoEvento(fimJornada, fusoEmpresaOffsetMin)
            : 'em aberto no fim do período';
        const sufixoDuracao = duracaoMin !== null ? `  •  duração ${formatarHoras(duracaoMin)}` : '';
        blocos.push({
            titulo: `${horaDoEvento(inicio, fusoEmpresaOffsetMin)} até ${tituloFim}${sufixoDuracao}`,
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
        rel.garantirEspaco(80);
        rel.subsecao(titulo);
        const linhasEv = [];
        const links = [];
        for (const evento of eventos) {
            const temLocalizacao = evento.latitude != null && evento.longitude != null;
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
        desenharBlocoDeEventos('Eventos fora de uma jornada identificada (sem "Início de jornada" correspondente no período)', avulsos);
    }
    blocos.forEach((bloco, indice) => {
        desenharBlocoDeEventos(`Jornada ${indice + 1} , ${bloco.titulo}`, bloco.eventos);
    });
}
function desenharBlocoAssinaturas(rel, nomeMotorista, nomeEmpresa) {
    const doc = rel.doc;
    const xInicial = rel.esquerda;
    const alturaBloco = 90;
    rel.garantirEspaco(alturaBloco);
    doc.moveDown(2.5);
    const larguraColuna = rel.largura / 2;
    const larguraLinha = larguraColuna - 30;
    const y = doc.y;
    doc.lineWidth(0.8).strokeColor(relatorio_pdf_1.COR_TEXTO);
    doc.moveTo(xInicial, y).lineTo(xInicial + larguraLinha, y).stroke();
    doc
        .moveTo(xInicial + larguraColuna, y)
        .lineTo(xInicial + larguraColuna + larguraLinha, y)
        .stroke();
    let yLinha = y + 4;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(relatorio_pdf_1.COR_TEXTO);
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
    yLinha = yLinha + alturaMaxNome;
    doc.font('Helvetica').fontSize(8).fillColor(relatorio_pdf_1.COR_SUAVE);
    doc.text('Assinatura do motorista', xInicial, yLinha, {
        width: larguraLinha,
        align: 'center',
    });
    doc.text('Assinatura da empresa contratante', xInicial + larguraColuna, yLinha, { width: larguraLinha, align: 'center' });
    doc.y = yLinha + 12;
}
async function gerarPdfHolerite(motorista, empresa, resultado) {
    const rel = new relatorio_pdf_1.RelatorioPdf({
        titulo: 'Apuração de jornada (espelho de ponto)',
        rodape: 'Folha de ponto',
    });
    rel.cabecalho({
        titulo: 'Apuração de jornada (espelho de ponto)',
        aviso: 'Este documento organiza e categoriza a jornada (direção, espera, normal/extra, noturno) pra apoiar o ' +
            'fechamento da folha , não é o cálculo completo da folha de pagamento (salário, DSR, verbas) nem o ' +
            'holerite pronto.',
    });
    desenharSecaoMotorista(rel, motorista, empresa, resultado);
    return rel.finalizar();
}
async function gerarPdfFechamentoLote(itens, periodoInicio, periodoFim) {
    const rel = new relatorio_pdf_1.RelatorioPdf({
        titulo: 'Fechamento de jornada da frota',
        rodape: 'Fechamento de jornada da frota',
    });
    rel.cabecalho({
        titulo: 'Fechamento de jornada da frota',
        campos: [
            [
                'Período',
                `${periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
            ],
            ['Motoristas', `${itens.length} motorista(s)`],
            ['Gerado em', (0, fuso_contexto_1.agoraDoCliente)()],
        ],
        aviso: 'Resumo por motorista, seguido do detalhamento diário completo de cada um. Somente horas , nenhum ' +
            'valor monetário é calculado ou exibido; o pagamento é decisão da empresa/RH fora desta plataforma.',
    });
    rel.secao('Resumo por motorista');
    const colunasResumo = [
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
    const linhas = [];
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
//# sourceMappingURL=holerite-pdf.util.js.map