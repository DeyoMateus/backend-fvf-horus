"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepPService = void 0;
const common_1 = require("@nestjs/common");
const pdfkit_1 = __importDefault(require("pdfkit"));
const client_1 = require("@prisma/client");
const nsr_service_1 = require("../nsr/nsr.service");
const ordenacao_temporal_util_1 = require("../ordenacao-temporal.util");
const ROTULO_EVENTO = {
    INICIO_JORNADA: 'Início de Jornada',
    INICIO_DESCANSO: 'Início de Descanso/Intervalo',
    FIM_DESCANSO: 'Fim de Descanso/Intervalo',
    INICIO_DIRECAO: 'Início de Tempo de Direção',
    FIM_DIRECAO: 'Fim de Tempo de Direção',
    ESPERA_CARGA_DESCARGA: 'Início de Tempo de Espera (Carga/Descarga)',
    FIM_ESPERA_CARGA_DESCARGA: 'Fim de Tempo de Espera',
    FIM_DESCARREGAMENTO: 'Fim de Tempo de Espera (Entrega Concluída)',
    FIM_JORNADA: 'Fim de Jornada',
    OUTRO: 'Evento Diverso',
};
const CATEGORIA_LEGAL = {
    INICIO_JORNADA: 'Jornada de Trabalho',
    INICIO_DESCANSO: 'Descanso/Intervalo',
    FIM_DESCANSO: 'Descanso/Intervalo',
    INICIO_DIRECAO: 'Tempo de Direção (Lei 13.103/2015)',
    FIM_DIRECAO: 'Tempo de Direção (Lei 13.103/2015)',
    ESPERA_CARGA_DESCARGA: 'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
    FIM_ESPERA_CARGA_DESCARGA: 'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
    FIM_DESCARREGAMENTO: 'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
    FIM_JORNADA: 'Jornada de Trabalho',
    OUTRO: 'Evento Diverso',
};
const ADICIONAL_NOTURNO_INICIO_HORA = 22;
const ADICIONAL_NOTURNO_FIM_HORA = 5;
const DESCANSO_INTERJORNADA_MINIMO_MIN = 660;
const LIMITE_JORNADA_DIRECAO_ATENCAO_MIN = 480;
let RepPService = class RepPService {
    nsr;
    constructor(nsr) {
        this.nsr = nsr;
    }
    async gerarPdf(motorista, empresa, regraSindical, registrosEntrada, tratamentosEntrada, feriadosNoPeriodo, opcoes, deviceUuidAtual) {
        const registros = [...registrosEntrada].sort(ordenacao_temporal_util_1.compararPorTimestampEvento);
        const tratamentos = [...tratamentosEntrada].sort((a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime());
        const registrosComNsr = await Promise.all(registros.map(async (r) => ({
            ...r,
            nsr: await this.nsr.obterOuCriar(`registro:${r.id}`, 7),
        })));
        const eventos = [
            ...registrosComNsr.map((r) => ({
                origem: 'REGISTRO',
                timestampEvento: r.timestampEvento,
                tipoEvento: r.tipoEvento,
                registro: r,
            })),
        ];
        const feriadosPagosSet = new Set(feriadosNoPeriodo.filter((f) => f.pagoComoDomingo).map((f) => f.data));
        const feriadosPorDia = new Map(feriadosNoPeriodo.map((f) => [f.data, f.descricao]));
        const diasChaves = Array.from(new Set(eventos.map((e) => this.chaveDia(e.timestampEvento)))).sort();
        const resumosPorDia = diasChaves.map((dia) => this.resumirDia(dia, registros, regraSindical, feriadosPagosSet, feriadosPorDia));
        const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        const finalizado = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
        this.escreverCabecalho(doc, motorista, empresa, opcoes, regraSindical, feriadosNoPeriodo);
        this.escreverTabelaEventos(doc, eventos);
        this.escreverResumosDiarios(doc, resumosPorDia);
        if (tratamentos.length > 0) {
            this.escreverAjustesRh(doc, tratamentos);
        }
        this.escreverRodape(doc, motorista, registros, tratamentos, deviceUuidAtual);
        doc.end();
        return finalizado;
    }
    escreverCabecalho(doc, motorista, empresa, opcoes, regraSindical, feriadosNoPeriodo) {
        doc
            .fontSize(15)
            .font('Helvetica-Bold')
            .text('ESPELHO DE PONTO ELETRÔNICO (REP-P)', { align: 'center' });
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#4b5563')
            .text('Lei nº 13.103/2015 ("Lei do Motorista") · Portaria MTP 671/2021', {
            align: 'center',
        });
        doc.moveDown(0.8);
        doc.fontSize(10).fillColor('#111827');
        doc.font('Helvetica-Bold').text(`Empregador: ${empresa.razaoSocial}`);
        doc.font('Helvetica').text(`CNPJ: ${empresa.cnpj}`);
        doc.moveDown(0.3);
        doc.text(`Motorista: ${motorista.nome}`);
        doc.text(`CPF: ${motorista.cpf}   CNH: ${motorista.cnh}`);
        doc.text(`Período: ${opcoes.periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${opcoes.periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
        doc.text(regraSindical
            ? `Convenção coletiva aplicada: ${regraSindical.nome} (${regraSindical.categoriaTransporte})`
            : 'Convenção coletiva aplicada: nenhuma vinculada a este CNPJ , parâmetros de referência CLT/Lei 13.103');
        doc.text(feriadosNoPeriodo.length > 0
            ? `Feriados cadastrados pelo RH e considerados neste período: ${feriadosNoPeriodo
                .map((f) => `${this.formatarDiaBr(f.data)} (${f.descricao}${f.pagoComoDomingo ? '' : ', informativo , sem percentual diferenciado'})`)
                .join('; ')}`
            : 'Feriados cadastrados pelo RH e considerados neste período: nenhum , só domingos recebem o percentual diferenciado, quando configurado na convenção coletiva.', { align: 'justify' });
        doc.moveDown();
    }
    escreverTabelaEventos(doc, eventos) {
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text('Marcações do período');
        doc.moveDown(0.3);
        let diaAtual = null;
        for (const evento of eventos) {
            const dia = this.chaveDia(evento.timestampEvento);
            if (dia !== diaAtual) {
                diaAtual = dia;
                doc.moveDown(0.4);
                doc
                    .fontSize(9)
                    .font('Helvetica-Bold')
                    .fillColor('#1f2937')
                    .text(`, ${this.formatarDiaBr(dia)} ,`);
            }
            const registro = evento.registro;
            const horario = evento.timestampEvento.toLocaleTimeString('pt-BR');
            const gps = registro.latitude != null && registro.longitude != null
                ? `${Number(registro.latitude).toFixed(6)}, ${Number(registro.longitude).toFixed(6)}` +
                    (registro.precisaoGpsM != null
                        ? ` (±${Math.round(registro.precisaoGpsM)}m)`
                        : '')
                : 'GPS indisponível neste evento';
            doc
                .fontSize(8.5)
                .font('Helvetica')
                .fillColor('#111827')
                .text(`${horario}  ,  ${ROTULO_EVENTO[evento.tipoEvento]}`, {
                continued: false,
            });
            doc
                .fontSize(7.5)
                .fillColor('#6b7280')
                .text(`   Localização GPS: ${gps}   |   Categoria legal: ${CATEGORIA_LEGAL[evento.tipoEvento]}   |   NSR: ${registro.nsr}`);
        }
        doc.moveDown();
    }
    escreverResumosDiarios(doc, resumos) {
        doc.addPage();
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text('Resumo diário categorizado');
        doc.moveDown(0.3);
        for (const r of resumos) {
            doc
                .fontSize(9.5)
                .font('Helvetica-Bold')
                .fillColor('#1f2937')
                .text(this.formatarDiaBr(r.dia));
            doc.fontSize(8).font('Helvetica').fillColor('#111827');
            doc.text(`Tempo Total de Direção: ${this.formatarHoras(r.direcaoMin)}`);
            doc.text(`Tempo Total de Espera: ${this.formatarHoras(r.esperaMin)}`);
            doc.text(`Intervalo Intrajornada (1º período de descanso): ${this.formatarHoras(r.intrajornadaMin)}`);
            doc.text(`Pausas de Direção Continuada (demais descansos do dia): ${this.formatarHoras(r.pausasDirecaoContinuadaMin)}`);
            const rotuloDiferenciado = r.ehDomingo && r.ehFeriado
                ? `domingo e feriado (${r.descricaoFeriado})`
                : r.ehFeriado
                    ? `feriado (${r.descricaoFeriado})`
                    : r.ehDomingo
                        ? 'domingo'
                        : null;
            doc.text(`Horas Extras ${r.percentualExtra1}%: ${this.formatarHoras(r.extraFaixa1Min)}` +
                (r.extraFaixa2Min > 0
                    ? `   |   Horas Extras ${r.percentualExtra2}%: ${this.formatarHoras(r.extraFaixa2Min)}`
                    : '') +
                (rotuloDiferenciado
                    ? `   (${rotuloDiferenciado} , percentual diferenciado da CCT aplicado, quando configurado)`
                    : ''));
            doc.text(`Adicional Noturno (${r.percentualNoturno}%): ${this.formatarHoras(r.noturnoMin)}`);
            doc.text(r.descansoInterjornadaMin == null
                ? 'Descanso Interjornada Próximo: não apurável (jornada seguinte ainda não iniciada no período consultado)'
                : `Descanso Interjornada Próximo: ${this.formatarHoras(r.descansoInterjornadaMin)}` +
                    (r.descansoInterjornadaAbaixoDoMinimo
                        ? '  ⚠ abaixo do mínimo legal de 11:00'
                        : ''));
            doc.moveDown(0.6);
        }
    }
    escreverAjustesRh(doc, tratamentos) {
        doc.moveDown();
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#b45309')
            .text('Ajustes de RH aplicados neste período');
        doc
            .fontSize(7.5)
            .font('Helvetica')
            .fillColor('#6b7280')
            .text('Estes horários foram lançados/aprovados pelo RH (fluxo direto do gestor ou solicitação aprovada do ' +
            'motorista) e entram na apuração de horas para pagamento , mas NÃO fazem parte das marcações reais com ' +
            'GPS acima, e um horário corrigido não comprova onde o motorista estava naquele instante. Cada ajuste ' +
            'registra o usuário do RH/gestor responsável e fica ancorado no hash-chain do motorista (prova sobre ' +
            'qual estado da cadeia o ajuste foi lançado).', { align: 'justify' });
        doc.moveDown(0.3);
        for (const t of tratamentos) {
            doc
                .fontSize(8.5)
                .font('Helvetica')
                .fillColor('#111827')
                .text(`${t.timestampEvento.toLocaleString('pt-BR')}  ,  ${ROTULO_EVENTO[t.tipoEvento]}`);
            doc.fontSize(7.5).fillColor('#6b7280').text(`   Motivo: ${t.motivo}`);
            doc
                .fontSize(7.5)
                .fillColor('#6b7280')
                .text(`   Lançado por: ${t.usuario.nome}`);
        }
        doc.moveDown();
    }
    escreverRodape(doc, motorista, registros, tratamentos, deviceUuidAtual) {
        doc.moveDown();
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text('Autenticidade e integridade');
        doc.fontSize(8).font('Helvetica').fillColor('#111827');
        const ultimoRegistro = registros.at(-1);
        doc.text(`Hash gênesis da cadeia do motorista: ${motorista.hashGenesis}`);
        doc.text(ultimoRegistro
            ? `Hash do último evento no período (SHA-256, cadeia encadeada): ${ultimoRegistro.hashAtual}`
            : 'Nenhum evento com GPS no período , cadeia de hash não avaliada.');
        doc.text(`Status de alteração: ${tratamentos.length === 0
            ? 'NENHUMA ALTERAÇÃO RETROATIVA DETECTADA'
            : `${tratamentos.length} AJUSTE(S) DE RH APLICADO(S) NESTE PERÍODO , ver seção "Ajustes de RH" acima. As marcações originais com GPS nunca são sobrescritas (ledger imutável).`}`);
        doc.text(`Dispositivo(s) usado(s) no período: ${Array.from(new Set(registros.map((r) => r.deviceUuidUsado))).join(', ') || 'nenhum'}` +
            (deviceUuidAtual
                ? `   |   Dispositivo vinculado atualmente: ${deviceUuidAtual}`
                : ''));
        doc.text(`Assinatura digital por evento: RSA-SHA256, certificado emitido pela cadeia interna da FVF Hórus ` +
            `(fingerprint do motorista: ${motorista.certificadoFingerprint ?? 'não disponível'}). Os ajustes de RH ` +
            `deste período, quando houver, não são assinados com certificado (não exigido por lei , ver seção ` +
            `"Ajustes de RH") , ficam identificados pelo usuário responsável e ancorados no hash-chain. O ` +
            `certificado do motorista não é ICP-Brasil A1 nesta versão , ver dívidas técnicas do projeto.`, { align: 'justify' });
        doc.text(`Validação de horário: timestampEvento capturado no aparelho no momento do toque (com GPS do próprio ` +
            `celular quando disponível) e conferido contra deriva de relógio pelo motor antifraude , não é uma ` +
            `validação formal por servidor NTP dedicado.`, { align: 'justify' });
        doc.moveDown(0.5);
        doc
            .fontSize(7)
            .fillColor('#6b7280')
            .text('Este relatório organiza e categoriza a jornada registrada , não calcula a folha de pagamento completa ' +
            '(salário, DSR e demais verbas) nem constitui, por si só, garantia de conformidade trabalhista. A ' +
            'adequação depende das regras configuradas, dos processos internos e das normas aplicáveis à empresa.', { align: 'justify' });
    }
    resumirDia(dia, registros, regra, feriadosPagosSet, feriadosPorDia) {
        const inicioDia = new Date(`${dia}T00:00:00.000Z`);
        const fimDia = new Date(`${dia}T23:59:59.999Z`);
        const direcaoMin = this.somarIntervalosNoDia(registros, client_1.TipoEvento.INICIO_DIRECAO, [client_1.TipoEvento.FIM_DIRECAO], inicioDia, fimDia);
        const esperaMin = this.somarIntervalosNoDia(registros, client_1.TipoEvento.ESPERA_CARGA_DESCARGA, [client_1.TipoEvento.FIM_ESPERA_CARGA_DESCARGA, client_1.TipoEvento.FIM_DESCARREGAMENTO], inicioDia, fimDia);
        const pausas = this.construirIntervalosCompletos(registros, client_1.TipoEvento.INICIO_DESCANSO, [client_1.TipoEvento.FIM_DESCANSO])
            .filter((p) => p.fim.getTime() > inicioDia.getTime() &&
            p.inicio.getTime() < fimDia.getTime())
            .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
        const intrajornadaMin = pausas.length > 0
            ? this.minutosEntre(pausas[0].inicio, pausas[0].fim)
            : 0;
        const pausasDirecaoContinuadaMin = pausas
            .slice(1)
            .reduce((acc, p) => acc + this.minutosEntre(p.inicio, p.fim), 0);
        const noturnoMin = this.calcularMinutosNoturnosNoDia(registros, inicioDia);
        const limiteJornadaNormalMin = regra?.limiteJornadaNormalMin ?? 480;
        const limiteFaixa1Min = regra?.limiteHoraExtraFaixa1Min ?? 120;
        const ehDomingo = inicioDia.getUTCDay() === 0;
        const ehFeriado = feriadosPagosSet.has(dia);
        const diferenciado = ehDomingo || ehFeriado;
        const percentualExtra1 = Number((diferenciado ? regra?.percentualHoraExtraDomingoFeriado : undefined) ??
            regra?.percentualHoraExtra1 ??
            50);
        const percentualExtra2 = Number((diferenciado ? regra?.percentualHoraExtraDomingoFeriado : undefined) ??
            regra?.percentualHoraExtra2 ??
            70);
        const percentualNoturno = Number(regra?.percentualAdicionalNoturno ?? 20);
        const totalExtraMin = Math.max(0, Math.round(direcaoMin) - limiteJornadaNormalMin);
        const normalMin = Math.min(Math.round(direcaoMin), limiteJornadaNormalMin);
        const extraFaixa1Min = Math.min(totalExtraMin, limiteFaixa1Min);
        const extraFaixa2Min = Math.max(0, totalExtraMin - limiteFaixa1Min);
        const { descansoInterjornadaMin } = this.calcularDescansoInterjornada(registros, inicioDia, fimDia);
        return {
            dia,
            direcaoMin: Math.round(direcaoMin),
            esperaMin: Math.round(esperaMin),
            intrajornadaMin: Math.round(intrajornadaMin),
            pausasDirecaoContinuadaMin: Math.round(pausasDirecaoContinuadaMin),
            normalMin,
            extraFaixa1Min,
            extraFaixa2Min,
            percentualExtra1,
            percentualExtra2,
            ehDomingo,
            ehFeriado,
            descricaoFeriado: feriadosPorDia.get(dia) ?? null,
            noturnoMin: Math.round(noturnoMin),
            percentualNoturno,
            descansoInterjornadaMin,
            descansoInterjornadaAbaixoDoMinimo: descansoInterjornadaMin != null &&
                descansoInterjornadaMin < DESCANSO_INTERJORNADA_MINIMO_MIN,
        };
    }
    calcularDescansoInterjornada(registros, inicioDia, fimDia) {
        const fimJornadaDoDia = registros
            .filter((r) => r.tipoEvento === client_1.TipoEvento.FIM_JORNADA &&
            r.timestampEvento.getTime() >= inicioDia.getTime() &&
            r.timestampEvento.getTime() <= fimDia.getTime())
            .sort(ordenacao_temporal_util_1.compararPorTimestampEvento)
            .at(-1);
        if (!fimJornadaDoDia)
            return { descansoInterjornadaMin: null };
        const proximoInicioJornada = registros
            .filter((r) => r.tipoEvento === client_1.TipoEvento.INICIO_JORNADA &&
            r.timestampEvento.getTime() >
                fimJornadaDoDia.timestampEvento.getTime())
            .sort(ordenacao_temporal_util_1.compararPorTimestampEvento)[0];
        if (!proximoInicioJornada)
            return { descansoInterjornadaMin: null };
        const inicioJornadaQueTerminouAqui = registros
            .filter((r) => r.tipoEvento === client_1.TipoEvento.INICIO_JORNADA &&
            r.timestampEvento.getTime() <=
                fimJornadaDoDia.timestampEvento.getTime())
            .sort(ordenacao_temporal_util_1.compararPorTimestampEvento)
            .at(-1);
        if (inicioJornadaQueTerminouAqui) {
            const direcaoDaJornadaMin = this.somarIntervalosNoDia(registros, client_1.TipoEvento.INICIO_DIRECAO, [client_1.TipoEvento.FIM_DIRECAO], inicioJornadaQueTerminouAqui.timestampEvento, fimJornadaDoDia.timestampEvento);
            if (direcaoDaJornadaMin < LIMITE_JORNADA_DIRECAO_ATENCAO_MIN) {
                return { descansoInterjornadaMin: null };
            }
        }
        return {
            descansoInterjornadaMin: this.minutosEntre(fimJornadaDoDia.timestampEvento, proximoInicioJornada.timestampEvento),
        };
    }
    somarIntervalosNoDia(registros, tipoInicio, tiposFim, inicioDia, fimDia) {
        const intervalos = this.construirIntervalosCompletos(registros, tipoInicio, tiposFim);
        let total = 0;
        for (const intervalo of intervalos) {
            const inicio = intervalo.inicio.getTime() > inicioDia.getTime()
                ? intervalo.inicio
                : inicioDia;
            const fim = intervalo.fim.getTime() < fimDia.getTime() ? intervalo.fim : fimDia;
            if (fim.getTime() > inicio.getTime())
                total += this.minutosEntre(inicio, fim);
        }
        return total;
    }
    construirIntervalosCompletos(registros, tipoInicio, tiposFim) {
        const valoresFim = new Set(tiposFim);
        const ordenados = [...registros].sort(ordenacao_temporal_util_1.compararPorTimestampEvento);
        const intervalos = [];
        let aberto = null;
        for (const r of ordenados) {
            if (r.tipoEvento === tipoInicio) {
                aberto = r.timestampEvento;
            }
            else if (valoresFim.has(r.tipoEvento) && aberto) {
                intervalos.push({ inicio: aberto, fim: r.timestampEvento });
                aberto = null;
            }
        }
        return intervalos;
    }
    calcularMinutosNoturnosNoDia(registros, inicioDia) {
        const diaBase = inicioDia.getTime();
        const janela1Inicio = diaBase + ADICIONAL_NOTURNO_INICIO_HORA * 3600_000;
        const janela1Fim = diaBase + 24 * 3600_000;
        const janela2Inicio = diaBase;
        const janela2Fim = diaBase + ADICIONAL_NOTURNO_FIM_HORA * 3600_000;
        const sobreposicao = (aIni, aFim, bIni, bFim) => Math.max(0, Math.min(aFim, bFim) - Math.max(aIni, bIni));
        const intervalosDirecao = this.construirIntervalosCompletos(registros, client_1.TipoEvento.INICIO_DIRECAO, [client_1.TipoEvento.FIM_DIRECAO]);
        let total = 0;
        for (const intervalo of intervalosDirecao) {
            const ini = intervalo.inicio.getTime();
            const fim = intervalo.fim.getTime();
            total +=
                sobreposicao(ini, fim, janela1Inicio, janela1Fim) +
                    sobreposicao(ini, fim, janela2Inicio, janela2Fim);
        }
        return total / 60000;
    }
    minutosEntre(inicio, fim) {
        return (fim.getTime() - inicio.getTime()) / 60000;
    }
    chaveDia(data) {
        return data.toISOString().slice(0, 10);
    }
    formatarDiaBr(chaveDia) {
        const [ano, mes, dia] = chaveDia.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    formatarHoras(minutos) {
        const totalMin = Math.max(0, Math.round(minutos));
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
};
exports.RepPService = RepPService;
exports.RepPService = RepPService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nsr_service_1.NsrService])
], RepPService);
//# sourceMappingURL=rep-p.service.js.map