"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUSOS_EMPRESA_PERMITIDOS = exports.OFFSET_MAX_BRASIL = exports.OFFSET_MIN_BRASIL = exports.DIA_MS = exports.OFFSET_BRT_MS = exports.OFFSET_PADRAO_MIN = void 0;
exports.offsetPadraoDaEmpresa = offsetPadraoDaEmpresa;
exports.offsetValido = offsetValido;
exports.offsetEstimadoPorLongitude = offsetEstimadoPorLongitude;
exports.resolverFusoDoRegistro = resolverFusoDoRegistro;
exports.paraParedeBrt = paraParedeBrt;
exports.chaveDiaBrt = chaveDiaBrt;
exports.inicioDoDiaBrt = inicioDoDiaBrt;
exports.proximaMeiaNoiteBrt = proximaMeiaNoiteBrt;
exports.ehDataSoCalendario = ehDataSoCalendario;
exports.inicioDePeriodoBrt = inicioDePeriodoBrt;
exports.fimDePeriodoBrt = fimDePeriodoBrt;
exports.rotuloFuso = rotuloFuso;
exports.formatarDataHoraBrt = formatarDataHoraBrt;
exports.marcarHorario = marcarHorario;
exports.renderizarHorarios = renderizarHorarios;
exports.construirLinhaDoTempoFuso = construirLinhaDoTempoFuso;
exports.offsetNoInstante = offsetNoInstante;
exports.dividirPorDiaCivil = dividirPorDiaCivil;
exports.minutosNoturnosEntre = minutosNoturnosEntre;
exports.OFFSET_PADRAO_MIN = -180;
exports.OFFSET_BRT_MS = 3 * 60 * 60 * 1000;
exports.DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
exports.OFFSET_MIN_BRASIL = -300;
exports.OFFSET_MAX_BRASIL = -120;
const OFFSET_POR_FUSO_IANA = {
    'America/Noronha': -120,
    'America/Sao_Paulo': -180,
    'America/Bahia': -180,
    'America/Fortaleza': -180,
    'America/Recife': -180,
    'America/Belem': -180,
    'America/Maceio': -180,
    'America/Araguaina': -180,
    'America/Santarem': -180,
    'America/Cuiaba': -240,
    'America/Campo_Grande': -240,
    'America/Manaus': -240,
    'America/Porto_Velho': -240,
    'America/Boa_Vista': -240,
    'America/Rio_Branco': -300,
    'America/Eirunepe': -300,
};
exports.FUSOS_EMPRESA_PERMITIDOS = Object.keys(OFFSET_POR_FUSO_IANA);
function offsetPadraoDaEmpresa(fusoHorario) {
    if (!fusoHorario)
        return exports.OFFSET_PADRAO_MIN;
    return OFFSET_POR_FUSO_IANA[fusoHorario] ?? exports.OFFSET_PADRAO_MIN;
}
function offsetValido(valor) {
    return (typeof valor === 'number' &&
        Number.isInteger(valor) &&
        valor % 60 === 0 &&
        valor >= exports.OFFSET_MIN_BRASIL &&
        valor <= exports.OFFSET_MAX_BRASIL);
}
function offsetEstimadoPorLongitude(longitude) {
    const min = Math.round(longitude / 15) * 60;
    return Math.min(exports.OFFSET_MAX_BRASIL, Math.max(exports.OFFSET_MIN_BRASIL, min));
}
function resolverFusoDoRegistro(informado, latitude, longitude) {
    const aparelho = offsetValido(informado) ? informado : null;
    if (aparelho === null) {
        return {
            offsetMin: null,
            divergenteDoGps: false,
            informadoPeloAparelho: null,
        };
    }
    if (longitude === null ||
        longitude === undefined ||
        Number.isNaN(longitude)) {
        return {
            offsetMin: aparelho,
            divergenteDoGps: false,
            informadoPeloAparelho: null,
        };
    }
    const estimado = offsetEstimadoPorLongitude(longitude);
    if (Math.abs(aparelho - estimado) >= 120) {
        return {
            offsetMin: estimado,
            divergenteDoGps: true,
            informadoPeloAparelho: aparelho,
        };
    }
    return {
        offsetMin: aparelho,
        divergenteDoGps: false,
        informadoPeloAparelho: null,
    };
}
function paraParedeBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return new Date(data.getTime() + offsetMin * 60_000);
}
function chaveDiaBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return paraParedeBrt(data, offsetMin).toISOString().slice(0, 10);
}
function inicioDoDiaBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    const p = paraParedeBrt(data, offsetMin);
    return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()) -
        offsetMin * 60_000);
}
function proximaMeiaNoiteBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return new Date(inicioDoDiaBrt(data, offsetMin).getTime() + exports.DIA_MS);
}
function ehDataSoCalendario(data) {
    return (data.getUTCHours() === 0 &&
        data.getUTCMinutes() === 0 &&
        data.getUTCSeconds() === 0 &&
        data.getUTCMilliseconds() === 0);
}
function inicioDePeriodoBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return ehDataSoCalendario(data)
        ? new Date(data.getTime() - offsetMin * 60_000)
        : data;
}
function fimDePeriodoBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return ehDataSoCalendario(data)
        ? new Date(data.getTime() - offsetMin * 60_000 + exports.DIA_MS - 1)
        : data;
}
function rotuloFuso(offsetMin) {
    const h = offsetMin / 60;
    return `UTC${h >= 0 ? '+' : '-'}${Math.abs(h)}`;
}
function formatarDataHoraBrt(data, offsetMin = exports.OFFSET_PADRAO_MIN) {
    const p = paraParedeBrt(data, offsetMin);
    const dia = String(p.getUTCDate()).padStart(2, '0');
    const mes = String(p.getUTCMonth() + 1).padStart(2, '0');
    const ano = p.getUTCFullYear();
    const hora = String(p.getUTCHours()).padStart(2, '0');
    const minuto = String(p.getUTCMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}
function marcarHorario(data) {
    const d = typeof data === 'string' ? new Date(data) : data;
    return `[[t:${d.toISOString()}]]`;
}
const REGEX_MARCADOR_HORARIO = /\[\[t:(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]\]/g;
function renderizarHorarios(texto, offsetMin = exports.OFFSET_PADRAO_MIN) {
    return texto.replace(REGEX_MARCADOR_HORARIO, (_m, iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? iso : formatarDataHoraBrt(d, offsetMin);
    });
}
function construirLinhaDoTempoFuso(registros, amostras, padraoMin = exports.OFFSET_PADRAO_MIN) {
    const regs = [...registros]
        .sort((a, b) => a.t - b.t)
        .map((r) => ({ t: r.t, off: r.offsetMin ?? padraoMin }));
    if (regs.length === 0)
        return [];
    const amostrasOrdenadas = [...amostras].sort((a, b) => a.t - b.t);
    const linha = [
        { desde: Number.NEGATIVE_INFINITY, offsetMin: regs[0].off },
    ];
    for (let i = 1; i < regs.length; i++) {
        const anterior = regs[i - 1];
        const atual = regs[i];
        if (atual.off === linha[linha.length - 1].offsetMin)
            continue;
        const troca = amostrasOrdenadas.find((a) => a.t > anterior.t &&
            a.t < atual.t &&
            offsetEstimadoPorLongitude(a.longitude) === atual.off);
        linha.push({ desde: troca ? troca.t : atual.t, offsetMin: atual.off });
    }
    return linha;
}
function offsetNoInstante(linha, t, padraoMin = exports.OFFSET_PADRAO_MIN) {
    if (linha.length === 0)
        return padraoMin;
    let atual = linha[0].offsetMin;
    for (const ponto of linha) {
        if (ponto.desde <= t)
            atual = ponto.offsetMin;
        else
            break;
    }
    return atual;
}
function dividirPorDiaCivil(inicio, fim, linha, padraoMin = exports.OFFSET_PADRAO_MIN) {
    const pedacos = [];
    let cursor = inicio;
    while (cursor < fim) {
        const offsetMin = offsetNoInstante(linha, cursor.getTime(), padraoMin);
        let limite = proximaMeiaNoiteBrt(cursor, offsetMin);
        const proxTroca = linha.find((p) => p.desde > cursor.getTime());
        if (proxTroca && proxTroca.desde < limite.getTime()) {
            limite = new Date(proxTroca.desde);
        }
        const fimDoPedaco = limite < fim ? limite : fim;
        pedacos.push({ inicio: cursor, fim: fimDoPedaco, offsetMin });
        cursor = fimDoPedaco;
    }
    return pedacos;
}
function minutosNoturnosEntre(inicio, fim, offsetMin, inicioNoturnoHora = 22, fimNoturnoHora = 5) {
    const ini = inicio.getTime();
    const f = fim.getTime();
    const sobreposicao = (aIni, aFim, bIni, bFim) => Math.max(0, Math.min(aFim, bFim) - Math.max(aIni, bIni));
    let total = 0;
    let diaBase = inicioDoDiaBrt(inicio, offsetMin).getTime();
    while (diaBase < f) {
        total += sobreposicao(ini, f, diaBase, diaBase + fimNoturnoHora * HORA_MS);
        total += sobreposicao(ini, f, diaBase + inicioNoturnoHora * HORA_MS, diaBase + 24 * HORA_MS);
        diaBase += exports.DIA_MS;
    }
    return total / 60_000;
}
//# sourceMappingURL=fuso-brasil.util.js.map