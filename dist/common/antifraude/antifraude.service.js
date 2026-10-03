"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntifraudeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ordenacao_temporal_util_1 = require("../ordenacao-temporal.util");
const VELOCIDADE_MAXIMA_KMH = 150;
const DISTANCIA_MINIMA_PARA_AVALIAR_VELOCIDADE_M = 300;
const DESVIO_RELOGIO_FUTURO_MAXIMO_MIN = 10;
const LIMITE_ATRASO_SINCRONIZACAO_ATENCAO_MIN = 8 * 60;
const LIMITE_ATRASO_SINCRONIZACAO_CRITICO_MIN = 20 * 60;
const JORNADA_MINIMA_PLAUSIVEL_MIN = 20;
const DIRECAO_MINIMA_PLAUSIVEL_MIN = 1;
let AntifraudeService = class AntifraudeService {
    avaliar(historico, registroRecemCriado, horaRecebimentoServidor, flagsIntegridadeDispositivo, tiposExistentes) {
        const alertas = [];
        const velocidade = this.avaliarVelocidadeImpossivel(historico, registroRecemCriado);
        if (velocidade)
            alertas.push(velocidade);
        const relogio = this.avaliarRelogioDispositivo(registroRecemCriado, horaRecebimentoServidor);
        if (relogio)
            alertas.push(relogio);
        const sincronizacaoTardia = this.avaliarSincronizacaoTardiaSuspeita(registroRecemCriado, horaRecebimentoServidor);
        if (sincronizacaoTardia)
            alertas.push(sincronizacaoTardia);
        const ritmo = this.avaliarRitmoBatidasSuspeito(historico, registroRecemCriado);
        if (ritmo)
            alertas.push(ritmo);
        if (flagsIntegridadeDispositivo?.length) {
            alertas.push(this.alertaIntegridadeDispositivo(registroRecemCriado, flagsIntegridadeDispositivo));
        }
        return alertas.filter((a) => !tiposExistentes.has(a.tipo));
    }
    avaliarVelocidadeImpossivel(historico, atual) {
        if (atual.latitude == null || atual.longitude == null)
            return null;
        const anterior = historico
            .filter((r) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(r, atual) < 0 &&
            r.latitude != null &&
            r.longitude != null)
            .sort((a, b) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(b, a))[0];
        if (!anterior)
            return null;
        const minutos = this.minutosEntre(anterior.timestampEvento, atual.timestampEvento);
        if (minutos <= 0)
            return null;
        const distanciaM = this.distanciaHaversineMetros(Number(anterior.latitude), Number(anterior.longitude), Number(atual.latitude), Number(atual.longitude));
        if (distanciaM < DISTANCIA_MINIMA_PARA_AVALIAR_VELOCIDADE_M)
            return null;
        const velocidadeKmh = distanciaM / 1000 / (minutos / 60);
        if (velocidadeKmh <= VELOCIDADE_MAXIMA_KMH)
            return null;
        return {
            tipo: client_1.TipoAlertaJornada.VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS,
            severidade: client_1.SeveridadeAlerta.CRITICO,
            mensagem: `Distância de ${(distanciaM / 1000).toFixed(1)}km percorrida em ${this.formatarHoras(minutos)} entre dois ` +
                `registros implica velocidade média de ~${Math.round(velocidadeKmh)}km/h , fisicamente improvável para um ` +
                `caminhão. Sinal de GPS falsificado ou registro batido fora do local real.`,
            janelaInicio: anterior.timestampEvento,
            janelaFim: atual.timestampEvento,
            minutosAcumulados: Math.round(minutos),
            detalhes: {
                distanciaMetros: Math.round(distanciaM),
                velocidadeKmh: Math.round(velocidadeKmh),
                registroAnteriorId: anterior.id,
                registroAtualId: atual.id,
            },
        };
    }
    avaliarRelogioDispositivo(atual, horaRecebimentoServidor) {
        const minutosNoFuturo = this.minutosEntre(horaRecebimentoServidor, atual.timestampEvento);
        if (minutosNoFuturo <= DESVIO_RELOGIO_FUTURO_MAXIMO_MIN)
            return null;
        return {
            tipo: client_1.TipoAlertaJornada.RELOGIO_DISPOSITIVO_SUSPEITO,
            severidade: client_1.SeveridadeAlerta.CRITICO,
            mensagem: `O horário informado pelo aparelho (${atual.timestampEvento.toLocaleString('pt-BR')}) está ` +
                `${this.formatarHoras(minutosNoFuturo)} no futuro em relação ao horário em que o servidor recebeu o registro , ` +
                `só é possível com o relógio do aparelho adiantado de propósito.`,
            janelaInicio: horaRecebimentoServidor,
            janelaFim: atual.timestampEvento,
            minutosAcumulados: Math.round(minutosNoFuturo),
            detalhes: {
                registroId: atual.id,
                horaRecebimentoServidor: horaRecebimentoServidor.toISOString(),
            },
        };
    }
    avaliarSincronizacaoTardiaSuspeita(atual, horaRecebimentoServidor) {
        const minutosDeAtraso = this.minutosEntre(atual.timestampEvento, horaRecebimentoServidor);
        if (minutosDeAtraso < LIMITE_ATRASO_SINCRONIZACAO_ATENCAO_MIN)
            return null;
        const critico = minutosDeAtraso >= LIMITE_ATRASO_SINCRONIZACAO_CRITICO_MIN;
        const semRastroDeGps = atual.latitude == null || atual.longitude == null;
        return {
            tipo: client_1.TipoAlertaJornada.SINCRONIZACAO_TARDIA_SUSPEITA,
            severidade: critico ? client_1.SeveridadeAlerta.CRITICO : client_1.SeveridadeAlerta.ATENCAO,
            mensagem: `Este evento (${atual.timestampEvento.toLocaleString('pt-BR')}) só chegou ao servidor ` +
                `${this.formatarHoras(minutosDeAtraso)} depois do horário que alega , bem mais do que uma sincronização ` +
                `normal após período sem sinal. Pode ser legítimo (motorista ficou horas sem cobertura), mas é também o ` +
                `mesmo padrão de atrasar o relógio do aparelho antes de bater o ponto.` +
                (semRastroDeGps
                    ? ' Sem coordenada de GPS registrada neste evento para conferir o local alegado.'
                    : ''),
            janelaInicio: atual.timestampEvento,
            janelaFim: horaRecebimentoServidor,
            minutosAcumulados: Math.round(minutosDeAtraso),
            detalhes: {
                registroId: atual.id,
                horaRecebimentoServidor: horaRecebimentoServidor.toISOString(),
                semRastroDeGps,
            },
        };
    }
    avaliarRitmoBatidasSuspeito(historico, atual) {
        if (atual.tipoEvento === 'FIM_JORNADA') {
            const inicioJornada = [...historico]
                .filter((r) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(r, atual) < 0)
                .sort((a, b) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(b, a))
                .find((r) => r.tipoEvento === 'INICIO_JORNADA');
            if (!inicioJornada)
                return null;
            const minutos = this.minutosEntre(inicioJornada.timestampEvento, atual.timestampEvento);
            if (minutos < 0 || minutos >= JORNADA_MINIMA_PLAUSIVEL_MIN)
                return null;
            return {
                tipo: client_1.TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
                severidade: client_1.SeveridadeAlerta.CRITICO,
                mensagem: `Jornada inteira (início ao fim) durou apenas ${this.formatarHoras(minutos)} , tempo real implausível pra um ` +
                    `dia de trabalho. Sinal de que os eventos foram todos batidos em sequência rápida agora.`,
                janelaInicio: inicioJornada.timestampEvento,
                janelaFim: atual.timestampEvento,
                minutosAcumulados: Math.round(minutos),
                detalhes: {
                    registroInicioId: inicioJornada.id,
                    registroFimId: atual.id,
                },
            };
        }
        if (atual.tipoEvento === 'FIM_DIRECAO') {
            const inicioDirecao = [...historico]
                .filter((r) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(r, atual) < 0)
                .sort((a, b) => (0, ordenacao_temporal_util_1.compararPorTimestampEvento)(b, a))
                .find((r) => r.tipoEvento === 'INICIO_DIRECAO' || r.tipoEvento === 'FIM_DIRECAO');
            if (!inicioDirecao || inicioDirecao.tipoEvento !== 'INICIO_DIRECAO')
                return null;
            const minutos = this.minutosEntre(inicioDirecao.timestampEvento, atual.timestampEvento);
            if (minutos < 0 || minutos >= DIRECAO_MINIMA_PLAUSIVEL_MIN)
                return null;
            return {
                tipo: client_1.TipoAlertaJornada.SEQUENCIA_JORNADA_MUITO_RAPIDA,
                severidade: client_1.SeveridadeAlerta.ATENCAO,
                mensagem: `Trecho de direção (início ao fim) durou apenas ${Math.round(minutos * 60)}s , tempo real implausível ` +
                    `pra qualquer deslocamento real.`,
                janelaInicio: inicioDirecao.timestampEvento,
                janelaFim: atual.timestampEvento,
                minutosAcumulados: Math.round(minutos),
                detalhes: {
                    registroInicioId: inicioDirecao.id,
                    registroFimId: atual.id,
                },
            };
        }
        return null;
    }
    alertaIntegridadeDispositivo(atual, flags) {
        return {
            tipo: client_1.TipoAlertaJornada.INTEGRIDADE_DISPOSITIVO_SUSPEITA,
            severidade: client_1.SeveridadeAlerta.ATENCAO,
            mensagem: `O aparelho reportou sinais de integridade comprometida neste registro: ${flags.join(', ')}.`,
            janelaInicio: atual.timestampEvento,
            janelaFim: atual.timestampEvento,
            minutosAcumulados: 0,
            detalhes: {
                flags,
                registroId: atual.id,
                deviceUuidUsado: atual.deviceUuidUsado,
            },
        };
    }
    formatarHoras(minutos) {
        const totalMin = Math.max(0, Math.round(minutos));
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    minutosEntre(a, b) {
        return (b.getTime() - a.getTime()) / 60000;
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
};
exports.AntifraudeService = AntifraudeService;
exports.AntifraudeService = AntifraudeService = __decorate([
    (0, common_1.Injectable)()
], AntifraudeService);
//# sourceMappingURL=antifraude.service.js.map