"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarSequenciaAjuste = validarSequenciaAjuste;
const PROXIMOS_POR_ULTIMO = {
    INICIO_JORNADA: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'OUTRO',
        'FIM_JORNADA',
    ],
    FIM_DIRECAO: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'OUTRO',
        'FIM_JORNADA',
    ],
    FIM_DESCANSO: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'OUTRO',
        'FIM_JORNADA',
    ],
    FIM_ESPERA_CARGA_DESCARGA: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'OUTRO',
        'FIM_JORNADA',
    ],
    FIM_DESCARREGAMENTO: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'OUTRO',
        'FIM_JORNADA',
    ],
    INICIO_DIRECAO: ['FIM_DIRECAO'],
    INICIO_DESCANSO: ['FIM_DESCANSO'],
    ESPERA_CARGA_DESCARGA: ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'],
    FIM_JORNADA: ['INICIO_JORNADA'],
    OUTRO: [
        'INICIO_DIRECAO',
        'INICIO_DESCANSO',
        'ESPERA_CARGA_DESCARGA',
        'FIM_JORNADA',
    ],
};
const ABRE_TRECHO = [
    'INICIO_DIRECAO',
    'INICIO_DESCANSO',
    'ESPERA_CARGA_DESCARGA',
];
const ROTULO = {
    INICIO_JORNADA: 'Início de jornada',
    FIM_JORNADA: 'Fim de jornada',
    INICIO_DIRECAO: 'Início de direção',
    FIM_DIRECAO: 'Fim de direção',
    INICIO_DESCANSO: 'Início de descanso',
    FIM_DESCANSO: 'Fim de descanso',
    ESPERA_CARGA_DESCARGA: 'Início de espera (carga/descarga)',
    FIM_ESPERA_CARGA_DESCARGA: 'Fim de espera (carga/descarga)',
    FIM_DESCARREGAMENTO: 'Fim de descarregamento',
    OUTRO: 'Aguardando documentação',
};
function validarSequenciaAjuste(tipo, anteriores, posteriores) {
    const ultimo = anteriores.length
        ? anteriores[anteriores.length - 1].tipoEvento
        : null;
    const proximo = posteriores.length ? posteriores[0].tipoEvento : null;
    const permitidos = ultimo === null ? ['INICIO_JORNADA'] : PROXIMOS_POR_ULTIMO[ultimo];
    if (!permitidos.includes(tipo)) {
        const lista = permitidos.map((t) => `"${ROTULO[t]}"`).join(', ');
        if (ultimo === null || ultimo === 'FIM_JORNADA') {
            return {
                ok: false,
                permitidos,
                mensagem: `Não há jornada aberta neste horário. Quando o motorista não tem nenhum registro, lance a jornada inteira em ordem, começando por "Início de jornada" (permitido agora: ${lista}).`,
            };
        }
        return {
            ok: false,
            permitidos,
            mensagem: `Neste horário o último registro do motorista é "${ROTULO[ultimo]}", então "${ROTULO[tipo]}" não encaixa na jornada. Permitido agora: ${lista}.`,
        };
    }
    if (proximo !== null &&
        proximo !== 'INICIO_JORNADA' &&
        !ABRE_TRECHO.includes(tipo) &&
        !PROXIMOS_POR_ULTIMO[tipo].includes(proximo)) {
        return {
            ok: false,
            permitidos,
            mensagem: `Depois deste horário o motorista já tem "${ROTULO[proximo]}" registrado, que não encaixa depois de "${ROTULO[tipo]}". Revise o horário do ajuste.`,
        };
    }
    return { ok: true, permitidos };
}
//# sourceMappingURL=validacao-sequencia-ajuste.js.map