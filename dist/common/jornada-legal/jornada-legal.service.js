"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JornadaLegalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ordenacao_temporal_util_1 = require("../ordenacao-temporal.util");
const LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN = 300;
const LIMITE_DIRECAO_CONTINUA_CRITICO_MIN = 330;
const LIMITE_JORNADA_DIRECAO_ATENCAO_MIN = 480;
const LIMITE_JORNADA_DIRECAO_CRITICO_MIN = 600;
const LIMITE_ESPERA_INFO_MIN = 180;
const LIMITE_ESPERA_ATENCAO_MIN = 285;
const LIMITE_ESPERA_CRITICO_MIN = 300;
const PAUSA_QUALIFICADA_MIN = 30;
const OCIOSIDADE_TEMPO_MINIMO_MIN = 20;
const OCIOSIDADE_DISTANCIA_MAXIMA_M = 500;
const LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN = 15;
const LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN = 30;
const DESCANSO_INTERJORNADA_MINIMO_MIN = 660;
const EVENTOS_ABERTURA_TEMPO_INDEFINIDO = new Set([
    client_1.TipoEvento.INICIO_JORNADA,
    client_1.TipoEvento.FIM_DIRECAO,
    client_1.TipoEvento.FIM_DESCANSO,
    client_1.TipoEvento.FIM_ESPERA_CARGA_DESCARGA,
    client_1.TipoEvento.FIM_DESCARREGAMENTO,
]);
let JornadaLegalService = class JornadaLegalService {
    avaliar(registros, registroRecemCriado, alertasExistentesTipos, agoraOverride) {
        const agora = agoraOverride ?? registroRecemCriado.timestampEvento;
        const jornada = this.recortarJornadaCorrente(registros, agora);
        if (jornada.length === 0)
            return [];
        const janelaInicio = jornada[0].timestampEvento;
        const alertas = [];
        const { direcaoContinuaMin, totalDirecaoMin, corteContinuo } = this.calcularAcumuladosDirecao(jornada, agora);
        if (direcaoContinuaMin >= LIMITE_DIRECAO_CONTINUA_CRITICO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA,
                severidade: client_1.SeveridadeAlerta.CRITICO,
                mensagem: `Direção contínua de ${this.formatarHoras(direcaoContinuaMin)} sem pausa qualificada (limite legal: 05:30).`,
                janelaInicio: corteContinuo,
                janelaFim: agora,
                minutosAcumulados: Math.round(direcaoContinuaMin),
            });
        }
        else if (direcaoContinuaMin >= LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.DIRECAO_CONTINUA_PROXIMA_LIMITE) &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.DIRECAO_CONTINUA_EXCEDIDA)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.DIRECAO_CONTINUA_PROXIMA_LIMITE,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem: `Direção contínua de ${this.formatarHoras(direcaoContinuaMin)} , aproximando do limite legal de 05:30 sem pausa.`,
                janelaInicio: corteContinuo,
                janelaFim: agora,
                minutosAcumulados: Math.round(direcaoContinuaMin),
            });
        }
        if (totalDirecaoMin >= LIMITE_JORNADA_DIRECAO_CRITICO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA,
                severidade: client_1.SeveridadeAlerta.CRITICO,
                mensagem: `Jornada de direção de ${this.formatarHoras(totalDirecaoMin)} no dia , excedeu o limite de 8h regulares + 2h extras (10:00).`,
                janelaInicio,
                janelaFim: agora,
                minutosAcumulados: Math.round(totalDirecaoMin),
            });
        }
        else if (totalDirecaoMin >= LIMITE_JORNADA_DIRECAO_ATENCAO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.JORNADA_DIRECAO_PROXIMA_LIMITE) &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.JORNADA_DIRECAO_EXCEDIDA)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.JORNADA_DIRECAO_PROXIMA_LIMITE,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem: `Jornada de direção de ${this.formatarHoras(totalDirecaoMin)} no dia , aproximando do limite de 8h regulares (08:00).`,
                janelaInicio,
                janelaFim: agora,
                minutosAcumulados: Math.round(totalDirecaoMin),
            });
        }
        const esperaIntervalos = this.construirIntervalos(jornada, 'ESPERA_CARGA_DESCARGA', ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'], agora);
        const totalEsperaMin = this.somarMinutos(esperaIntervalos);
        if (totalEsperaMin >= LIMITE_ESPERA_CRITICO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
                severidade: client_1.SeveridadeAlerta.CRITICO,
                mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} , atingiu o limiar legal de 05:00. Dossiê de cobrança disponível.`,
                janelaInicio,
                janelaFim: agora,
                minutosAcumulados: Math.round(totalEsperaMin),
                detalhes: {
                    dossieDeCobranca: {
                        motoristaId: registroRecemCriado.motoristaId,
                        periodoInicio: janelaInicio.toISOString(),
                        periodoFim: agora.toISOString(),
                        minutosTotais: Math.round(totalEsperaMin),
                        intervalos: esperaIntervalos.map((i) => ({
                            inicio: i.inicio.toISOString(),
                            fim: i.fim.toISOString(),
                        })),
                        registroGeradorId: registroRecemCriado.id,
                        observacao: 'Valor de referência do frete não configurado , preencher manualmente na conferência.',
                    },
                },
            });
        }
        else if (totalEsperaMin >= LIMITE_ESPERA_ATENCAO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.ESPERA_PROXIMA_LIMITE) &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.ESPERA_PROXIMA_LIMITE,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} , próximo do limiar legal de 05:00.`,
                janelaInicio,
                janelaFim: agora,
                minutosAcumulados: Math.round(totalEsperaMin),
            });
        }
        else if (totalEsperaMin >= LIMITE_ESPERA_INFO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.ESPERA_PROXIMA_LIMITE) &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO)) {
            alertas.push({
                tipo: client_1.TipoAlertaJornada.ESPERA_PROXIMA_LIMITE,
                severidade: client_1.SeveridadeAlerta.INFO,
                mensagem: `Tempo de espera em carga/descarga de ${this.formatarHoras(totalEsperaMin)} já acumulado nesta jornada.`,
                janelaInicio,
                janelaFim: agora,
                minutosAcumulados: Math.round(totalEsperaMin),
            });
        }
        const ociosidade = this.avaliarOciosidadeDirecao(jornada, registroRecemCriado, alertasExistentesTipos);
        if (ociosidade)
            alertas.push(ociosidade);
        const tempoIndefinido = this.avaliarTempoIndefinido(jornada, agora, alertasExistentesTipos);
        if (tempoIndefinido)
            alertas.push(tempoIndefinido);
        const descansoInterjornada = this.avaliarDescansoInterjornada(registros, registroRecemCriado, alertasExistentesTipos);
        if (descansoInterjornada)
            alertas.push(descansoInterjornada);
        return alertas;
    }
    calcularProximoLimiar(registros, agora) {
        const jornada = this.recortarJornadaCorrente(registros, agora);
        if (jornada.length === 0)
            return null;
        const ultimoEvento = jornada[jornada.length - 1].tipoEvento;
        const candidatosMin = [];
        if (ultimoEvento === client_1.TipoEvento.INICIO_DIRECAO) {
            const { direcaoContinuaMin, totalDirecaoMin } = this.calcularAcumuladosDirecao(jornada, agora);
            for (const limite of [
                LIMITE_DIRECAO_CONTINUA_ATENCAO_MIN,
                LIMITE_DIRECAO_CONTINUA_CRITICO_MIN,
            ]) {
                if (direcaoContinuaMin < limite)
                    candidatosMin.push(limite - direcaoContinuaMin);
            }
            for (const limite of [
                LIMITE_JORNADA_DIRECAO_ATENCAO_MIN,
                LIMITE_JORNADA_DIRECAO_CRITICO_MIN,
            ]) {
                if (totalDirecaoMin < limite)
                    candidatosMin.push(limite - totalDirecaoMin);
            }
        }
        else if (ultimoEvento === client_1.TipoEvento.ESPERA_CARGA_DESCARGA) {
            const totalEsperaMin = this.somarMinutos(this.construirIntervalos(jornada, 'ESPERA_CARGA_DESCARGA', ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'], agora));
            for (const limite of [
                LIMITE_ESPERA_INFO_MIN,
                LIMITE_ESPERA_ATENCAO_MIN,
                LIMITE_ESPERA_CRITICO_MIN,
            ]) {
                if (totalEsperaMin < limite)
                    candidatosMin.push(limite - totalEsperaMin);
            }
        }
        else if (EVENTOS_ABERTURA_TEMPO_INDEFINIDO.has(ultimoEvento)) {
            const desde = jornada[jornada.length - 1].timestampEvento;
            const minutosIndefinido = this.minutosEntre(desde, agora);
            for (const limite of [
                LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN,
                LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN,
            ]) {
                if (minutosIndefinido < limite)
                    candidatosMin.push(limite - minutosIndefinido);
            }
        }
        if (candidatosMin.length === 0)
            return null;
        const minMin = Math.min(...candidatosMin);
        return { emMs: Math.max(0, Math.round(minMin * 60000)) };
    }
    avaliarOciosidadeDirecao(jornada, registroRecemCriado, alertasExistentesTipos) {
        if (registroRecemCriado.tipoEvento !== client_1.TipoEvento.FIM_DIRECAO)
            return null;
        if (alertasExistentesTipos.has(client_1.TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA))
            return null;
        const conferencias = jornada
            .filter((r) => r.tipoEvento === client_1.TipoEvento.FIM_DIRECAO &&
            r.latitude != null &&
            r.longitude != null &&
            r.timestampEvento.getTime() <=
                registroRecemCriado.timestampEvento.getTime())
            .sort(ordenacao_temporal_util_1.compararPorTimestampEvento);
        if (conferencias.length < 2)
            return null;
        const atual = conferencias[conferencias.length - 1];
        const anterior = conferencias[conferencias.length - 2];
        const minutosEntreConferencias = this.minutosEntre(anterior.timestampEvento, atual.timestampEvento);
        if (minutosEntreConferencias < OCIOSIDADE_TEMPO_MINIMO_MIN)
            return null;
        const distanciaM = this.distanciaHaversineMetros(Number(anterior.latitude), Number(anterior.longitude), Number(atual.latitude), Number(atual.longitude));
        if (distanciaM > OCIOSIDADE_DISTANCIA_MAXIMA_M)
            return null;
        return {
            tipo: client_1.TipoAlertaJornada.OCIOSIDADE_DIRECAO_SUSPEITA,
            severidade: client_1.SeveridadeAlerta.ATENCAO,
            mensagem: `Deslocamento de apenas ${Math.round(distanciaM)}m em ${this.formatarHoras(minutosEntreConferencias)} entre duas ` +
                `conferências de GPS marcadas como "em direção" , vale conferir se o veículo estava realmente em movimento.`,
            janelaInicio: anterior.timestampEvento,
            janelaFim: atual.timestampEvento,
            minutosAcumulados: Math.round(minutosEntreConferencias),
            detalhes: {
                distanciaMetros: Math.round(distanciaM),
                registroAnteriorId: anterior.id,
                registroAtualId: atual.id,
            },
        };
    }
    distanciaHaversineMetros(lat1, lon1, lat2, lon2) {
        const RAIO_TERRA_M = 6371000;
        const toRad = (graus) => (graus * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    calcularAcumuladosDirecao(jornada, agora) {
        const janelaInicio = jornada[0].timestampEvento;
        const direcaoIntervalos = this.construirIntervalos(jornada, 'INICIO_DIRECAO', ['FIM_DIRECAO'], agora);
        const totalDirecaoMin = this.somarMinutos(direcaoIntervalos);
        const pausasQualificadas = this.construirIntervalos(jornada, 'INICIO_DESCANSO', ['FIM_DESCANSO'], agora)
            .filter((p) => this.minutosEntre(p.inicio, p.fim) >= PAUSA_QUALIFICADA_MIN)
            .sort((a, b) => b.fim.getTime() - a.fim.getTime());
        const corteContinuo = pausasQualificadas[0]?.fim ?? janelaInicio;
        const direcaoContinuaMin = this.somarMinutos(direcaoIntervalos
            .filter((i) => i.fim.getTime() > corteContinuo.getTime())
            .map((i) => ({
            inicio: i.inicio.getTime() > corteContinuo.getTime()
                ? i.inicio
                : corteContinuo,
            fim: i.fim,
        })));
        return { direcaoContinuaMin, totalDirecaoMin, corteContinuo };
    }
    avaliarDescansoInterjornada(registros, registroRecemCriado, alertasExistentesTipos) {
        if (registroRecemCriado.tipoEvento !== client_1.TipoEvento.INICIO_JORNADA)
            return null;
        if (alertasExistentesTipos.has(client_1.TipoAlertaJornada.DESCANSO_INTERJORNADA_INSUFICIENTE))
            return null;
        const ordenados = [...registros].sort(ordenacao_temporal_util_1.compararPorTimestampEvento);
        const idxAtual = ordenados.findIndex((r) => r.id === registroRecemCriado.id);
        if (idxAtual <= 0)
            return null;
        const anterior = ordenados[idxAtual - 1];
        if (anterior.tipoEvento !== client_1.TipoEvento.FIM_JORNADA)
            return null;
        const descansoMin = this.minutosEntre(anterior.timestampEvento, registroRecemCriado.timestampEvento);
        if (descansoMin >= DESCANSO_INTERJORNADA_MINIMO_MIN)
            return null;
        const idxInicioJornadaAnterior = ordenados
            .slice(0, idxAtual - 1 + 1)
            .map((r) => r.tipoEvento)
            .lastIndexOf(client_1.TipoEvento.INICIO_JORNADA);
        if (idxInicioJornadaAnterior !== -1) {
            const jornadaAnterior = ordenados.slice(idxInicioJornadaAnterior, idxAtual);
            const { totalDirecaoMin: direcaoJornadaAnteriorMin } = this.calcularAcumuladosDirecao(jornadaAnterior, anterior.timestampEvento);
            if (direcaoJornadaAnteriorMin < LIMITE_JORNADA_DIRECAO_ATENCAO_MIN) {
                return null;
            }
        }
        const faltamMin = DESCANSO_INTERJORNADA_MINIMO_MIN - descansoMin;
        return {
            tipo: client_1.TipoAlertaJornada.DESCANSO_INTERJORNADA_INSUFICIENTE,
            severidade: client_1.SeveridadeAlerta.CRITICO,
            mensagem: `Nova jornada iniciada após apenas ${this.formatarHoras(descansoMin)} de descanso desde o fim da jornada ` +
                `anterior (que já tinha cumprido a jornada legal de direção) , abaixo do mínimo legal de 11:00 ` +
                `(faltam ${this.formatarHoras(faltamMin)}).`,
            janelaInicio: anterior.timestampEvento,
            janelaFim: registroRecemCriado.timestampEvento,
            minutosAcumulados: Math.round(descansoMin),
        };
    }
    recortarJornadaCorrente(registros, agora) {
        const ordenados = [...registros]
            .filter((r) => r.timestampEvento.getTime() <= agora.getTime())
            .sort(ordenacao_temporal_util_1.compararPorTimestampEvento);
        const ultimoInicioIdx = ordenados
            .map((r) => r.tipoEvento)
            .lastIndexOf(client_1.TipoEvento.INICIO_JORNADA);
        return ultimoInicioIdx === -1
            ? ordenados
            : ordenados.slice(ultimoInicioIdx);
    }
    construirIntervalos(registros, tipoInicio, tiposFim, agora) {
        const valoresFim = new Set(tiposFim.map((t) => client_1.TipoEvento[t]));
        const intervalos = [];
        let aberto = null;
        for (const r of registros) {
            if (r.tipoEvento === client_1.TipoEvento[tipoInicio]) {
                aberto = r.timestampEvento;
            }
            else if (valoresFim.has(r.tipoEvento) && aberto) {
                intervalos.push({ inicio: aberto, fim: r.timestampEvento });
                aberto = null;
            }
        }
        if (aberto)
            intervalos.push({ inicio: aberto, fim: agora });
        return intervalos;
    }
    avaliarTempoIndefinido(jornada, agora, alertasExistentesTipos) {
        const ultimoRegistro = jornada[jornada.length - 1];
        if (!EVENTOS_ABERTURA_TEMPO_INDEFINIDO.has(ultimoRegistro.tipoEvento))
            return null;
        const minutosIndefinido = this.minutosEntre(ultimoRegistro.timestampEvento, agora);
        if (minutosIndefinido >= LIMITE_TEMPO_INDEFINIDO_CRITICO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO)) {
            return {
                tipo: client_1.TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO,
                severidade: client_1.SeveridadeAlerta.CRITICO,
                mensagem: `Jornada aberta há ${this.formatarHoras(minutosIndefinido)} sem nenhuma etapa escolhida (direção, descanso ou espera) , esse tempo está contando como indefinido, não como trabalhado. Escolha uma ação no app.`,
                janelaInicio: ultimoRegistro.timestampEvento,
                janelaFim: agora,
                minutosAcumulados: Math.round(minutosIndefinido),
            };
        }
        if (minutosIndefinido >= LIMITE_TEMPO_INDEFINIDO_ATENCAO_MIN &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.TEMPO_INDEFINIDO_PROXIMO_LIMITE) &&
            !alertasExistentesTipos.has(client_1.TipoAlertaJornada.TEMPO_INDEFINIDO_PROLONGADO)) {
            return {
                tipo: client_1.TipoAlertaJornada.TEMPO_INDEFINIDO_PROXIMO_LIMITE,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem: `Jornada aberta há ${this.formatarHoras(minutosIndefinido)} sem nenhuma etapa escolhida (direção, descanso ou espera) , esse tempo está contando como indefinido. Escolha uma ação no app.`,
                janelaInicio: ultimoRegistro.timestampEvento,
                janelaFim: agora,
                minutosAcumulados: Math.round(minutosIndefinido),
            };
        }
        return null;
    }
    minutosEntre(inicio, fim) {
        return (fim.getTime() - inicio.getTime()) / 60000;
    }
    formatarHoras(minutos) {
        const totalMin = Math.max(0, Math.round(minutos));
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    somarMinutos(intervalos) {
        return intervalos.reduce((acc, i) => acc + this.minutosEntre(i.inicio, i.fim), 0);
    }
};
exports.JornadaLegalService = JornadaLegalService;
exports.JornadaLegalService = JornadaLegalService = __decorate([
    (0, common_1.Injectable)()
], JornadaLegalService);
//# sourceMappingURL=jornada-legal.service.js.map