/**
 * Fusos do negócio. O Brasil não tem horário de verão desde 2019, então um
 * deslocamento FIXO em minutos é exato (e evita depender de Intl/ICU e do TZ
 * do container). O deslocamento é "minutos a leste do UTC": Brasília = -180,
 * Cuiabá/Manaus = -240, Rio Branco = -300, Fernando de Noronha = -120.
 *
 * Regra de ouro (Rodada 146):
 *  - DURAÇÕES são sempre a diferença entre instantes (UTC), nunca entre
 *    horas de parede, então atravessar fuso não cria nem some hora.
 *  - "Que horas são na parede" (corte do dia, janela do adicional noturno
 *    22h-5h, folga) segue o fuso em que o motorista ESTÁ a cada momento:
 *    o `fusoOffsetMin` de cada ponto batido, e, entre dois pontos de fusos
 *    diferentes, a troca acontece onde as amostras de localização mostram
 *    que ele cruzou (ver `construirLinhaDoTempoFuso`). Sem informação
 *    (registros antigos / app antigo) vale o fuso da empresa (Brasília por
 *    padrão), idêntico ao comportamento anterior.
 *  - O fuso da EMPRESA (`Empresa.fusoHorario`) manda na exibição e na janela
 *    de consulta dos períodos "só data" do fechamento.
 *
 * Convenção do projeto, mantida: valores "só data" (período do fechamento,
 * folgas, ajustes de banco de horas) são guardados como meia-noite UTC e
 * representam o DIA CIVIL escolhido, não um instante real.
 */
export const OFFSET_PADRAO_MIN = -180;
export const OFFSET_BRT_MS = 3 * 60 * 60 * 1000;
export const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

/** Faixa de fusos brasileiros aceitos (Acre -300 ... Fernando de Noronha -120). */
export const OFFSET_MIN_BRASIL = -300;
export const OFFSET_MAX_BRASIL = -120;

/** Tabela dos fusos IANA usados no Brasil (sem horário de verão). */
const OFFSET_POR_FUSO_IANA: Record<string, number> = {
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

/** Fusos que podem ser escolhidos no cadastro da empresa. */
export const FUSOS_EMPRESA_PERMITIDOS = Object.keys(OFFSET_POR_FUSO_IANA);

/** Deslocamento (min) do fuso IANA da empresa; desconhecido/ausente = Brasília. */
export function offsetPadraoDaEmpresa(fusoHorario?: string | null): number {
  if (!fusoHorario) return OFFSET_PADRAO_MIN;
  return OFFSET_POR_FUSO_IANA[fusoHorario] ?? OFFSET_PADRAO_MIN;
}

/** Aceita só deslocamento inteiro, em hora cheia, dentro da faixa brasileira. */
export function offsetValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor % 60 === 0 &&
    valor >= OFFSET_MIN_BRASIL &&
    valor <= OFFSET_MAX_BRASIL
  );
}

/** Deslocamento esperado pela longitude (1h a cada 15°), limitado ao Brasil. */
export function offsetEstimadoPorLongitude(longitude: number): number {
  const min = Math.round(longitude / 15) * 60;
  return Math.min(OFFSET_MAX_BRASIL, Math.max(OFFSET_MIN_BRASIL, min));
}

export interface FusoResolvido {
  /** Deslocamento a gravar/assinar no registro; null = nada confiável (vale o padrão). */
  offsetMin: number | null;
  /** O fuso informado pelo aparelho contradiz o GPS (diferença de 2h ou mais). */
  divergenteDoGps: boolean;
  /** Deslocamento informado pelo aparelho, quando divergiu (para auditoria). */
  informadoPeloAparelho: number | null;
}

/**
 * Decide o fuso de um ponto novo. O fuso do aparelho vale, EXCETO quando
 * contradiz o GPS por 2h ou mais (as fronteiras entre fusos não seguem a
 * longitude exata, então 1h de diferença é tolerada): nesse caso o GPS manda.
 * Sem fuso do aparelho nunca se inventa um (app antigo => null => padrão).
 */
export function resolverFusoDoRegistro(
  informado: unknown,
  latitude?: number | null,
  longitude?: number | null,
): FusoResolvido {
  const aparelho = offsetValido(informado) ? informado : null;
  if (aparelho === null) {
    return {
      offsetMin: null,
      divergenteDoGps: false,
      informadoPeloAparelho: null,
    };
  }
  if (
    longitude === null ||
    longitude === undefined ||
    Number.isNaN(longitude)
  ) {
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

/** Desloca o instante para que os getters UTC passem a devolver a parede-relógio do fuso. */
export function paraParedeBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): Date {
  return new Date(data.getTime() + offsetMin * 60_000);
}

/** Chave "AAAA-MM-DD" do dia civil no fuso em que o instante cai. */
export function chaveDiaBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): string {
  return paraParedeBrt(data, offsetMin).toISOString().slice(0, 10);
}

/** Instante real da meia-noite (00:00 no fuso) do dia civil em que `data` cai. */
export function inicioDoDiaBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): Date {
  const p = paraParedeBrt(data, offsetMin);
  return new Date(
    Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()) -
      offsetMin * 60_000,
  );
}

/** Instante real da próxima meia-noite do fuso depois de `data`. */
export function proximaMeiaNoiteBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): Date {
  return new Date(inicioDoDiaBrt(data, offsetMin).getTime() + DIA_MS);
}

/** `true` quando o valor é meia-noite UTC exata (assinatura de "data só de calendário"). */
export function ehDataSoCalendario(data: Date): boolean {
  return (
    data.getUTCHours() === 0 &&
    data.getUTCMinutes() === 0 &&
    data.getUTCSeconds() === 0 &&
    data.getUTCMilliseconds() === 0
  );
}

/**
 * Início de período: se vier como data só de calendário (meia-noite UTC),
 * vira 00:00 do fuso daquele dia; qualquer outro instante passa direto.
 */
export function inicioDePeriodoBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): Date {
  return ehDataSoCalendario(data)
    ? new Date(data.getTime() - offsetMin * 60_000)
    : data;
}

/**
 * Fim de período: se vier como data só de calendário (meia-noite UTC), vira
 * 23:59:59.999 do fuso daquele dia; qualquer outro instante passa direto.
 */
export function fimDePeriodoBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): Date {
  return ehDataSoCalendario(data)
    ? new Date(data.getTime() - offsetMin * 60_000 + DIA_MS - 1)
    : data;
}

/** Rótulo curto do fuso: -180 => "UTC-3", -240 => "UTC-4". */
export function rotuloFuso(offsetMin: number): string {
  const h = offsetMin / 60;
  return `UTC${h >= 0 ? '+' : '-'}${Math.abs(h)}`;
}

/** Data/hora para o log de eventos do PDF: DD/MM/AAAA HH:mm na parede do fuso. */
export function formatarDataHoraBrt(
  data: Date,
  offsetMin: number = OFFSET_PADRAO_MIN,
): string {
  const p = paraParedeBrt(data, offsetMin);
  const dia = String(p.getUTCDate()).padStart(2, '0');
  const mes = String(p.getUTCMonth() + 1).padStart(2, '0');
  const ano = p.getUTCFullYear();
  const hora = String(p.getUTCHours()).padStart(2, '0');
  const minuto = String(p.getUTCMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

// --- Horários dentro de mensagens -----------------------------------------

/**
 * Mensagens guardadas/enviadas a mais de uma pessoa não podem carregar a hora
 * já formatada num fuso fixo (07h em Brasília é 06h em Cuiabá). A hora vai
 * como marcador `[[t:ISO]]` e é desenhada na hora de quem recebe/vê, no fuso
 * dele (`renderizarHorarios`). Web e app têm a mesma função.
 */
export function marcarHorario(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return `[[t:${d.toISOString()}]]`;
}

const REGEX_MARCADOR_HORARIO = /\[\[t:(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]\]/g;

/** Troca cada marcador pela data/hora (DD/MM/AAAA HH:mm) na parede do fuso informado. */
export function renderizarHorarios(
  texto: string,
  offsetMin: number = OFFSET_PADRAO_MIN,
): string {
  return texto.replace(REGEX_MARCADOR_HORARIO, (_m, iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : formatarDataHoraBrt(d, offsetMin);
  });
}

// --- Linha do tempo de fuso do motorista ----------------------------------

/** A partir de `desde` (ms epoch) o motorista está no fuso `offsetMin`. */
export interface PontoFuso {
  desde: number;
  offsetMin: number;
}

export interface RegistroParaFuso {
  /** Instante do ponto (ms epoch). */
  t: number;
  /** `fusoOffsetMin` gravado no registro; null = antigo/app antigo. */
  offsetMin: number | null;
}

export interface AmostraParaFuso {
  t: number;
  longitude: number;
}

/**
 * Monta, para um motorista, "em que fuso ele estava em cada instante".
 *
 * Os pontos batidos são a fonte principal (cada um já traz o fuso
 * validado contra o GPS). Quando dois pontos seguidos têm fusos
 * diferentes, o momento da troca é o da primeira amostra de localização
 * entre eles cujo fuso estimado pela longitude já é o do ponto seguinte;
 * sem amostra, a troca vale a partir do ponto seguinte. A longitude é só
 * para LOCALIZAR a troca (a fronteira real não segue o meridiano, o erro
 * é de poucos quilômetros), nunca para decidir o fuso de um ponto.
 */
export function construirLinhaDoTempoFuso(
  registros: RegistroParaFuso[],
  amostras: AmostraParaFuso[],
  padraoMin: number = OFFSET_PADRAO_MIN,
): PontoFuso[] {
  const regs = [...registros]
    .sort((a, b) => a.t - b.t)
    .map((r) => ({ t: r.t, off: r.offsetMin ?? padraoMin }));
  if (regs.length === 0) return [];
  const amostrasOrdenadas = [...amostras].sort((a, b) => a.t - b.t);

  const linha: PontoFuso[] = [
    { desde: Number.NEGATIVE_INFINITY, offsetMin: regs[0].off },
  ];
  for (let i = 1; i < regs.length; i++) {
    const anterior = regs[i - 1];
    const atual = regs[i];
    if (atual.off === linha[linha.length - 1].offsetMin) continue;
    const troca = amostrasOrdenadas.find(
      (a) =>
        a.t > anterior.t &&
        a.t < atual.t &&
        offsetEstimadoPorLongitude(a.longitude) === atual.off,
    );
    linha.push({ desde: troca ? troca.t : atual.t, offsetMin: atual.off });
  }
  return linha;
}

/** Fuso em que o motorista estava no instante `t` (ms). Sem linha, o padrão. */
export function offsetNoInstante(
  linha: PontoFuso[],
  t: number,
  padraoMin: number = OFFSET_PADRAO_MIN,
): number {
  if (linha.length === 0) return padraoMin;
  let atual = linha[0].offsetMin;
  for (const ponto of linha) {
    if (ponto.desde <= t) atual = ponto.offsetMin;
    else break;
  }
  return atual;
}

export interface PedacoDeTempo {
  inicio: Date;
  fim: Date;
  /** Fuso do motorista durante todo o pedaço. */
  offsetMin: number;
}

/**
 * Quebra [inicio, fim] em pedaços que não cruzam NEM a meia-noite NEM uma
 * troca de fuso; cada pedaço sabe o fuso em que aconteceu.
 */
export function dividirPorDiaCivil(
  inicio: Date,
  fim: Date,
  linha: PontoFuso[],
  padraoMin: number = OFFSET_PADRAO_MIN,
): PedacoDeTempo[] {
  const pedacos: PedacoDeTempo[] = [];
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

/** Minutos de [inicio, fim] dentro da janela 22h-5h NA PAREDE do fuso informado. */
export function minutosNoturnosEntre(
  inicio: Date,
  fim: Date,
  offsetMin: number,
  inicioNoturnoHora = 22,
  fimNoturnoHora = 5,
): number {
  const ini = inicio.getTime();
  const f = fim.getTime();
  const sobreposicao = (aIni: number, aFim: number, bIni: number, bFim: number) =>
    Math.max(0, Math.min(aFim, bFim) - Math.max(aIni, bIni));

  let total = 0;
  let diaBase = inicioDoDiaBrt(inicio, offsetMin).getTime();
  while (diaBase < f) {
    total += sobreposicao(ini, f, diaBase, diaBase + fimNoturnoHora * HORA_MS);
    total += sobreposicao(
      ini,
      f,
      diaBase + inicioNoturnoHora * HORA_MS,
      diaBase + 24 * HORA_MS,
    );
    diaBase += DIA_MS;
  }
  return total / 60_000;
}
