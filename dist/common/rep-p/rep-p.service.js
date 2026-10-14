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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepPService = void 0;
const common_1 = require("@nestjs/common");
const fuso_contexto_1 = require("../fuso/fuso-contexto");
const relatorio_pdf_1 = require("../pdf/relatorio-pdf");
const client_1 = require("@prisma/client");
const nsr_service_1 = require("../nsr/nsr.service");
const ordenacao_temporal_util_1 = require("../ordenacao-temporal.util");
const fuso_brasil_util_1 = require("../fuso/fuso-brasil.util");
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
        const offsetEmpresaMin = (0, fuso_brasil_util_1.offsetPadraoDaEmpresa)(empresa.fusoHorario);
        const linhaFuso = (0, fuso_brasil_util_1.construirLinhaDoTempoFuso)(registros.map((r) => ({
            t: r.timestampEvento.getTime(),
            offsetMin: r.fusoOffsetMin ?? null,
        })), [], offsetEmpresaMin);
        const offsetPorDia = new Map();
        for (const e of eventos) {
            const off = e.registro?.fusoOffsetMin ?? offsetEmpresaMin;
            const chave = this.chaveDia(e.timestampEvento, off);
            if (!offsetPorDia.has(chave))
                offsetPorDia.set(chave, off);
        }
        const diasChaves = Array.from(offsetPorDia.keys()).sort();
        const resumosPorDia = diasChaves.map((dia) => this.resumirDia(dia, registros, regraSindical, feriadosPagosSet, feriadosPorDia, offsetPorDia.get(dia) ?? offsetEmpresaMin, linhaFuso));
        const r = new relatorio_pdf_1.RelatorioPdf({
            titulo: 'Espelho de Ponto Eletrônico (REP-P) - FVF Hórus',
            assunto: 'Lei nº 13.103/2015 e Portaria MTP 671/2021',
            rodape: 'Espelho de ponto eletrônico (REP-P)',
        });
        this.escreverCabecalho(r, motorista, empresa, opcoes, regraSindical, feriadosNoPeriodo);
        this.escreverTabelaEventos(r, eventos, offsetEmpresaMin);
        this.escreverResumosDiarios(r, resumosPorDia);
        if (tratamentos.length > 0) {
            this.escreverAjustesRh(r, tratamentos, linhaFuso, offsetEmpresaMin);
        }
        this.escreverRodape(r, motorista, registros, tratamentos, deviceUuidAtual);
        return r.finalizar();
    }
    escreverCabecalho(r, motorista, empresa, opcoes, regraSindical, feriadosNoPeriodo) {
        r.cabecalho({
            titulo: 'Espelho de Ponto Eletrônico (REP-P)',
            subtitulo: 'Lei nº 13.103/2015 ("Lei do Motorista") · Portaria MTP 671/2021',
            campos: [
                ['Empregador', empresa.razaoSocial],
                ['CNPJ', empresa.cnpj],
                ['Motorista', motorista.nome],
                ['CPF', motorista.cpf],
                ['CNH', motorista.cnh],
                [
                    'Período',
                    `${opcoes.periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${opcoes.periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`,
                ],
                ['Gerado em', (0, fuso_contexto_1.agoraDoCliente)()],
                [
                    'Convenção coletiva aplicada',
                    regraSindical
                        ? `${regraSindical.nome} (${regraSindical.categoriaTransporte})`
                        : 'nenhuma vinculada a este CNPJ , parâmetros de referência CLT/Lei 13.103',
                ],
                [
                    'Feriados cadastrados pelo RH e considerados neste período',
                    feriadosNoPeriodo.length > 0
                        ? feriadosNoPeriodo
                            .map((f) => `${this.formatarDiaBr(f.data)} (${f.descricao}${f.pagoComoDomingo ? '' : ', informativo , sem percentual diferenciado'})`)
                            .join('; ')
                        : 'nenhum , só domingos recebem o percentual diferenciado, quando configurado na convenção coletiva.',
                ],
            ],
        });
    }
    escreverTabelaEventos(r, eventos, offsetEmpresaMin) {
        r.secao('Marcações do período');
        const colunas = [
            { titulo: 'Horário', largura: 13 },
            { titulo: 'Evento', largura: 24 },
            { titulo: 'Localização GPS', largura: 26 },
            { titulo: 'Categoria legal', largura: 28 },
            { titulo: 'NSR', largura: 9, alinhamento: 'right' },
        ];
        let diaAtual = null;
        let linhas = [];
        const descarregar = () => {
            if (diaAtual === null)
                return;
            r.garantirEspaco(90);
            r.subsecao(this.formatarDiaBr(diaAtual));
            r.tabela(colunas, linhas);
            linhas = [];
        };
        for (const evento of eventos) {
            const offsetEvento = evento.registro?.fusoOffsetMin ?? offsetEmpresaMin;
            const dia = this.chaveDia(evento.timestampEvento, offsetEvento);
            if (dia !== diaAtual) {
                descarregar();
                diaAtual = dia;
            }
            const registro = evento.registro;
            const horarioBase = (0, fuso_brasil_util_1.paraParedeBrt)(evento.timestampEvento, offsetEvento)
                .toISOString()
                .slice(11, 19);
            const horario = offsetEvento === offsetEmpresaMin
                ? horarioBase
                : `${horarioBase} (${(0, fuso_brasil_util_1.rotuloFuso)(offsetEvento)})`;
            const gps = registro.latitude != null && registro.longitude != null
                ? `${Number(registro.latitude).toFixed(6)}, ${Number(registro.longitude).toFixed(6)}` +
                    (registro.precisaoGpsM != null
                        ? ` (±${Math.round(registro.precisaoGpsM)}m)`
                        : '')
                : 'GPS indisponível neste evento';
            linhas.push([
                horario,
                ROTULO_EVENTO[evento.tipoEvento],
                gps,
                CATEGORIA_LEGAL[evento.tipoEvento],
                String(registro.nsr),
            ]);
        }
        descarregar();
        if (eventos.length === 0)
            r.vazio('Nenhuma marcação no período.');
    }
    escreverResumosDiarios(r, resumos) {
        r.secao('Resumo diário categorizado');
        for (const d of resumos) {
            const rotuloDiferenciado = d.ehDomingo && d.ehFeriado
                ? `domingo e feriado (${d.descricaoFeriado})`
                : d.ehFeriado
                    ? `feriado (${d.descricaoFeriado})`
                    : d.ehDomingo
                        ? 'domingo'
                        : null;
            const extras = `${this.formatarHoras(d.extraFaixa1Min)}` +
                (d.extraFaixa2Min > 0
                    ? `   |   Horas Extras ${d.percentualExtra2}%: ${this.formatarHoras(d.extraFaixa2Min)}`
                    : '') +
                (rotuloDiferenciado
                    ? `   (${rotuloDiferenciado} , percentual diferenciado da CCT aplicado, quando configurado)`
                    : '');
            const interjornada = d.descansoInterjornadaMin == null
                ? 'não apurável (jornada seguinte ainda não iniciada no período consultado)'
                : `${this.formatarHoras(d.descansoInterjornadaMin)}` +
                    (d.descansoInterjornadaAbaixoDoMinimo
                        ? '  ⚠ abaixo do mínimo legal de 11:00'
                        : '');
            r.garantirEspaco(150);
            r.subsecao(this.formatarDiaBr(d.dia));
            r.camposChaveValor([
                ['Tempo Total de Direção', this.formatarHoras(d.direcaoMin)],
                ['Tempo Total de Espera', this.formatarHoras(d.esperaMin)],
                [
                    'Intervalo Intrajornada (1º período de descanso)',
                    this.formatarHoras(d.intrajornadaMin),
                ],
                [
                    'Pausas de Direção Continuada (demais descansos do dia)',
                    this.formatarHoras(d.pausasDirecaoContinuadaMin),
                ],
                [`Horas Extras ${d.percentualExtra1}%`, extras],
                [
                    `Adicional Noturno (${d.percentualNoturno}%)`,
                    this.formatarHoras(d.noturnoMin),
                ],
                ['Descanso Interjornada Próximo', interjornada],
            ], 200);
            r.separador();
        }
        if (resumos.length === 0)
            r.vazio('Nenhum dia com marcações no período.');
    }
    escreverAjustesRh(r, tratamentos, linhaFuso, padraoMin) {
        r.secao('Ajustes de RH aplicados neste período');
        r.nota('Estes horários foram lançados/aprovados pelo RH (fluxo direto do gestor ou solicitação aprovada do ' +
            'motorista) e entram na apuração de horas para pagamento , mas NÃO fazem parte das marcações reais com ' +
            'GPS acima, e um horário corrigido não comprova onde o motorista estava naquele instante. Cada ajuste ' +
            'registra o usuário do RH/gestor responsável e fica ancorado no hash-chain do motorista (prova sobre ' +
            'qual estado da cadeia o ajuste foi lançado).');
        r.doc.moveDown(0.5);
        r.tabela([
            { titulo: 'Horário', largura: 22 },
            { titulo: 'Evento', largura: 26 },
            { titulo: 'Motivo', largura: 32 },
            { titulo: 'Lançado por', largura: 20 },
        ], tratamentos.map((t) => [
            (0, fuso_contexto_1.instanteDoEvento)(t.timestampEvento, t.fusoOffsetMin ??
                (0, fuso_brasil_util_1.offsetNoInstante)(linhaFuso, t.timestampEvento.getTime(), padraoMin)),
            ROTULO_EVENTO[t.tipoEvento],
            t.motivo,
            t.usuario.nome,
        ]));
    }
    escreverRodape(r, motorista, registros, tratamentos, deviceUuidAtual) {
        r.secao('Autenticidade e integridade');
        const ultimoRegistro = registros.at(-1);
        r.camposChaveValor([
            ['Hash gênesis da cadeia do motorista', motorista.hashGenesis],
            [
                'Hash do último evento no período (SHA-256, cadeia encadeada)',
                ultimoRegistro
                    ? ultimoRegistro.hashAtual
                    : 'Nenhum evento com GPS no período , cadeia de hash não avaliada.',
            ],
            [
                'Status de alteração',
                tratamentos.length === 0
                    ? 'NENHUMA ALTERAÇÃO RETROATIVA DETECTADA'
                    : `${tratamentos.length} AJUSTE(S) DE RH APLICADO(S) NESTE PERÍODO , ver seção "Ajustes de RH" acima. As marcações originais com GPS nunca são sobrescritas (ledger imutável).`,
            ],
            [
                'Dispositivo(s) usado(s) no período',
                (Array.from(new Set(registros.map((x) => x.deviceUuidUsado))).join(', ') || 'nenhum') +
                    (deviceUuidAtual
                        ? `   |   Dispositivo vinculado atualmente: ${deviceUuidAtual}`
                        : ''),
            ],
        ], 170);
        r.doc.moveDown(0.4);
        r.nota(`Assinatura digital por evento: RSA-SHA256, certificado emitido pela cadeia interna da FVF Hórus ` +
            `(fingerprint do motorista: ${motorista.certificadoFingerprint ?? 'não disponível'}). Os ajustes de RH ` +
            `deste período, quando houver, não são assinados com certificado (não exigido por lei , ver seção ` +
            `"Ajustes de RH") , ficam identificados pelo usuário responsável e ancorados no hash-chain. O ` +
            `certificado do motorista não é ICP-Brasil A1 nesta versão , ver dívidas técnicas do projeto.`);
        r.doc.moveDown(0.4);
        r.nota(`Validação de horário: timestampEvento capturado no aparelho no momento do toque (com GPS do próprio ` +
            `celular quando disponível) e conferido contra deriva de relógio pelo motor antifraude , não é uma ` +
            `validação formal por servidor NTP dedicado.`);
        r.doc.moveDown(0.5);
        r.nota('Este relatório organiza e categoriza a jornada registrada , não calcula a folha de pagamento completa ' +
            '(salário, DSR e demais verbas) nem constitui, por si só, garantia de conformidade trabalhista. A ' +
            'adequação depende das regras configuradas, dos processos internos e das normas aplicáveis à empresa.');
    }
    resumirDia(dia, registros, regra, feriadosPagosSet, feriadosPorDia, offsetMin, linhaFuso = []) {
        const inicioDia = new Date(new Date(`${dia}T00:00:00.000Z`).getTime() - offsetMin * 60_000);
        const fimDia = new Date(inicioDia.getTime() + fuso_brasil_util_1.DIA_MS - 1);
        const direcaoMin = this.somarPedacosDoDia(registros, client_1.TipoEvento.INICIO_DIRECAO, [client_1.TipoEvento.FIM_DIRECAO], dia, linhaFuso, offsetMin).total;
        const esperaMin = this.somarPedacosDoDia(registros, client_1.TipoEvento.ESPERA_CARGA_DESCARGA, [client_1.TipoEvento.FIM_ESPERA_CARGA_DESCARGA, client_1.TipoEvento.FIM_DESCARREGAMENTO], dia, linhaFuso, offsetMin).total;
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
        const noturnoMin = this.somarPedacosDoDia(registros, client_1.TipoEvento.INICIO_DIRECAO, [client_1.TipoEvento.FIM_DIRECAO], dia, linhaFuso, offsetMin).noturno;
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
    somarPedacosDoDia(registros, tipoInicio, tiposFim, dia, linhaFuso, padraoMin) {
        let total = 0;
        let noturno = 0;
        for (const intervalo of this.construirIntervalosCompletos(registros, tipoInicio, tiposFim)) {
            for (const pedaco of (0, fuso_brasil_util_1.dividirPorDiaCivil)(intervalo.inicio, intervalo.fim, linhaFuso, padraoMin)) {
                if ((0, fuso_brasil_util_1.chaveDiaBrt)(pedaco.inicio, pedaco.offsetMin) !== dia)
                    continue;
                total += this.minutosEntre(pedaco.inicio, pedaco.fim);
                noturno += (0, fuso_brasil_util_1.minutosNoturnosEntre)(pedaco.inicio, pedaco.fim, pedaco.offsetMin, ADICIONAL_NOTURNO_INICIO_HORA, ADICIONAL_NOTURNO_FIM_HORA);
            }
        }
        return { total, noturno };
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
    minutosEntre(inicio, fim) {
        return (fim.getTime() - inicio.getTime()) / 60000;
    }
    chaveDia(data, offsetMin) {
        return (0, fuso_brasil_util_1.chaveDiaBrt)(data, offsetMin);
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