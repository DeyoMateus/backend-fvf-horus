"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIMITE_LINHAS_PDF = void 0;
exports.gerarPdfMeusDados = gerarPdfMeusDados;
const relatorio_pdf_1 = require("../common/pdf/relatorio-pdf");
const fuso_contexto_1 = require("../common/fuso/fuso-contexto");
exports.LIMITE_LINHAS_PDF = {
    registros: 3000,
    amostras: 500,
    demais: 500,
};
const ROTULO_EVENTO = {
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
const ROTULO_TIPO_PEDIDO = {
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
const ROTULO_STATUS_PEDIDO = {
    ABERTA: 'Aberto',
    EM_ANALISE: 'Em análise',
    ATENDIDA: 'Atendido',
    NEGADA_COM_JUSTIFICATIVA: 'Negado com justificativa',
};
const ROTULO_DOCUMENTO = {
    POLITICA_PRIVACIDADE: 'Política de Privacidade',
    TERMO_GPS: 'Termo de uso de localização (GPS)',
    TERMO_DADOS_PESSOAIS: 'Termo de tratamento de dados pessoais',
};
const ROTULO_STATUS_AJUSTE = {
    PENDENTE: 'Pendente',
    APROVADA: 'Aprovada',
    APROVADO: 'Aprovado',
    REJEITADA: 'Rejeitada',
    REJEITADO: 'Rejeitado',
};
function texto(v) {
    if (v === null || v === undefined || v === '')
        return '-';
    return String(v);
}
function data(v) {
    if (!v)
        return '-';
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? '-' : (0, fuso_contexto_1.instanteDoCliente)(d);
}
function dataEvento(v, fuso) {
    if (!v)
        return '-';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime()))
        return '-';
    return (0, fuso_contexto_1.instanteDoEvento)(d, typeof fuso === 'number' ? fuso : null);
}
function coord(v) {
    if (v === null || v === undefined)
        return '-';
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(5) : '-';
}
function rotulo(mapa, v) {
    const k = texto(v);
    return mapa[k] ?? k.replace(/_/g, ' ').toLowerCase();
}
function primeira(v) {
    return texto(v).replace(/\s+/g, ' ');
}
function gerarPdfMeusDados(d) {
    const r = new relatorio_pdf_1.RelatorioPdf({
        titulo: 'Cópia dos dados pessoais - FVF Hórus',
        assunto: 'LGPD art. 18, II e V',
        rodape: 'Cópia dos dados pessoais',
    });
    const { doc } = r;
    const secao = r.secao.bind(r);
    const vazio = r.vazio.bind(r);
    const camposChaveValor = r.camposChaveValor.bind(r);
    const tabela = (colunas, linhas) => r.tabela(colunas, linhas);
    const garantirEspaco = r.garantirEspaco.bind(r);
    const listaLimitada = (itens, max) => relatorio_pdf_1.RelatorioPdf.limitar(itens, max, 'A cópia completa em formato estruturado (JSON) está disponível no aplicativo.');
    r.cabecalho({
        titulo: 'Cópia dos dados pessoais do titular',
        subtitulo: 'Lei Geral de Proteção de Dados (Lei 13.709/2018), art. 18, incisos II e V',
        campos: [['Gerado em', data(d.geradoEm)]],
        aviso: d.aviso,
    });
    const c = d.cadastro;
    secao('1. Dados de identificação');
    if (!c) {
        vazio('Cadastro não encontrado.');
    }
    else {
        const emp = (c.empresa ?? {});
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
    secao('2. Resumo do que é tratado');
    tabela([
        { titulo: 'Categoria de dados', largura: 3 },
        { titulo: 'Quantidade', largura: 1 },
    ], [
        ['Registros de jornada (pontos)', String(d.registrosDeJornada.length)],
        ['Amostras de localização', String(d.amostrasDeLocalizacao.length)],
        ['Ajustes de ponto', String(d.ajustesDePonto.length)],
        ['Solicitações de ajuste', String(d.solicitacoesDeAjuste.length)],
        ['Alertas de jornada', String(d.alertas.length)],
        ['Ciências de privacidade', String(d.cienciasDePrivacidade.length)],
        ['Pedidos do titular', String(d.pedidosDoTitular.length)],
    ]);
    {
        const { itens, nota } = listaLimitada(d.registrosDeJornada, exports.LIMITE_LINHAS_PDF.registros);
        secao('3. Registros de jornada', 'Pontos registrados pelo aplicativo, do mais recente ao mais antigo. Horário no fuso em que você estava.');
        if (!itens.length)
            vazio('Nenhum registro.');
        else {
            tabela([
                { titulo: 'Data e hora', largura: 3 },
                { titulo: 'Evento', largura: 3.2 },
                { titulo: 'Latitude', largura: 1.5 },
                { titulo: 'Longitude', largura: 1.5 },
                { titulo: 'Precisão (m)', largura: 1.2 },
                { titulo: 'Observação', largura: 2.6 },
            ], itens.map((r) => [
                dataEvento(r.timestampEvento, r.fusoOffsetMin),
                rotulo(ROTULO_EVENTO, r.tipoEvento),
                coord(r.latitude),
                coord(r.longitude),
                r.precisaoGpsM == null ? '-' : String(Math.round(Number(r.precisaoGpsM))),
                primeira(r.observacao),
            ]));
            if (nota) {
                doc.moveDown(0.3);
                vazio(nota);
            }
        }
    }
    {
        const { itens, nota } = listaLimitada(d.amostrasDeLocalizacao, exports.LIMITE_LINHAS_PDF.amostras);
        secao('4. Amostras de localização', 'Posições capturadas pelo aplicativo durante a jornada.');
        if (!itens.length)
            vazio('Nenhuma amostra de localização.');
        else {
            tabela([
                { titulo: 'Capturada em', largura: 3 },
                { titulo: 'Latitude', largura: 2 },
                { titulo: 'Longitude', largura: 2 },
                { titulo: 'Precisão (m)', largura: 1.5 },
            ], itens.map((a) => [
                data(a.capturadoEm),
                coord(a.latitude),
                coord(a.longitude),
                a.precisaoGpsM == null ? '-' : String(Math.round(Number(a.precisaoGpsM))),
            ]));
            if (nota) {
                doc.moveDown(0.3);
                vazio(nota);
            }
        }
    }
    {
        const { itens, nota } = listaLimitada(d.ajustesDePonto, exports.LIMITE_LINHAS_PDF.demais);
        secao('5. Ajustes de ponto lançados pela empresa', 'Correções feitas pela transportadora na sua jornada, com o motivo informado.');
        if (!itens.length)
            vazio('Nenhum ajuste.');
        else {
            tabela([
                { titulo: 'Ponto ajustado', largura: 3 },
                { titulo: 'Evento', largura: 3 },
                { titulo: 'Motivo', largura: 4 },
                { titulo: 'Lançado em', largura: 3 },
            ], itens.map((t) => [
                dataEvento(t.timestampEvento, t.fusoOffsetMin),
                rotulo(ROTULO_EVENTO, t.tipoEvento),
                primeira(t.motivo),
                data(t.createdAt),
            ]));
            if (nota) {
                doc.moveDown(0.3);
                vazio(nota);
            }
        }
    }
    {
        const { itens, nota } = listaLimitada(d.solicitacoesDeAjuste, exports.LIMITE_LINHAS_PDF.demais);
        secao('6. Solicitações de ajuste feitas por você');
        if (!itens.length)
            vazio('Nenhuma solicitação.');
        else {
            tabela([
                { titulo: 'Ponto solicitado', largura: 3 },
                { titulo: 'Evento', largura: 3 },
                { titulo: 'Situação', largura: 1.8 },
                { titulo: 'Resposta da empresa', largura: 3.6 },
                { titulo: 'Pedido em', largura: 3 },
            ], itens.map((s) => [
                dataEvento(s.timestampEvento, s.fusoOffsetMin),
                rotulo(ROTULO_EVENTO, s.tipoEvento),
                rotulo(ROTULO_STATUS_AJUSTE, s.status),
                primeira(s.motivoDecisao),
                data(s.createdAt),
            ]));
            if (nota) {
                doc.moveDown(0.3);
                vazio(nota);
            }
        }
    }
    {
        const { itens, nota } = listaLimitada(d.alertas, exports.LIMITE_LINHAS_PDF.demais);
        secao('7. Alertas de jornada');
        if (!itens.length)
            vazio('Nenhum alerta.');
        else {
            tabela([
                { titulo: 'Data e hora', largura: 3 },
                { titulo: 'Gravidade', largura: 1.6 },
                { titulo: 'Mensagem', largura: 7 },
            ], itens.map((a) => [
                data(a.createdAt),
                rotulo({ INFO: 'Informativo', ATENCAO: 'Atenção', CRITICO: 'Crítico' }, a.severidade),
                primeira(a.mensagem),
            ]));
            if (nota) {
                doc.moveDown(0.3);
                vazio(nota);
            }
        }
    }
    secao('8. Ciências de privacidade registradas');
    if (!d.cienciasDePrivacidade.length)
        vazio('Nenhuma ciência registrada.');
    else {
        tabela([
            { titulo: 'Documento', largura: 5 },
            { titulo: 'Versão', largura: 2 },
            { titulo: 'Data da ciência', largura: 3 },
        ], d.cienciasDePrivacidade.map((a) => [
            rotulo(ROTULO_DOCUMENTO, a.tipoDocumento),
            texto(a.versao),
            data(a.aceitoEm),
        ]));
    }
    secao('9. Pedidos feitos como titular de dados');
    if (!d.pedidosDoTitular.length)
        vazio('Nenhum pedido.');
    else {
        tabela([
            { titulo: 'Tipo', largura: 3 },
            { titulo: 'Situação', largura: 1.8 },
            { titulo: 'Pedido em', largura: 2.6 },
            { titulo: 'Prazo', largura: 2.6 },
            { titulo: 'Resposta', largura: 4 },
        ], d.pedidosDoTitular.map((p) => [
            rotulo(ROTULO_TIPO_PEDIDO, p.tipo),
            rotulo(ROTULO_STATUS_PEDIDO, p.status),
            data(p.createdAt),
            data(p.prazoEm),
            primeira(p.resposta),
        ]));
    }
    garantirEspaco(80);
    doc.moveDown(1.2);
    r.nota('Este documento reúne os dados pessoais que o FVF Hórus trata sobre você, extraídos do sistema na data indicada acima. ' +
        'Para corrigir, eliminar ou questionar qualquer informação, use a opção "Fazer um pedido" na tela de Privacidade do aplicativo ' +
        'ou fale com o encarregado de dados da sua transportadora.');
    return r.finalizar();
}
//# sourceMappingURL=privacidade-pdf.util.js.map