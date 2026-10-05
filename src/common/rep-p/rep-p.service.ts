import { Injectable } from '@nestjs/common';
import { agoraDoCliente, instanteDoEvento } from '../fuso/fuso-contexto';
import PDFDocument from 'pdfkit';
import type {
  Motorista,
  RegistroJornada,
  RegraSindical,
  TratamentoPonto,
} from '@prisma/client';
import { TipoEvento } from '@prisma/client';
import { NsrService } from '../nsr/nsr.service';
import { compararPorTimestampEvento } from '../ordenacao-temporal.util';
import {
  DIA_MS,
  type PontoFuso,
  chaveDiaBrt,
  construirLinhaDoTempoFuso,
  offsetNoInstante,
  dividirPorDiaCivil,
  minutosNoturnosEntre,
  offsetPadraoDaEmpresa,
  paraParedeBrt,
  rotuloFuso,
} from '../fuso/fuso-brasil.util';

/**
 * Espelho de Ponto Eletrônico (REP-P) , Lei nº 13.103/2015 ("Lei do
 * Motorista") + Portaria MTP 671/2021 (leiaute do REP-P).
 *
 * Diferente do `ComprovanteService` (extrato simples de lista de
 * eventos, pensado pra o motorista compartilhar/imprimir rápido) e do
 * `AejService` (CSV pra planilha), este relatório é o espelho de
 * jornada NO FORMATO exigido pra ter valor de defesa/cobrança
 * trabalhista: cada marcação carrega NSR (Número Sequencial de
 * Registro, mesmo contador global do AFD oficial , ver `NsrService`),
 * coordenada de GPS, categoria legal do evento, e o dia é fechado com
 * um resumo categorizado (direção / espera / intervalos / horas
 * extras / adicional noturno / descanso interjornada) seguido de um
 * rodapé com a cadeia de hash e os metadados de autenticidade.
 *
 * O QUE ESTE RELATÓRIO NÃO FAZ (documentado de propósito, mesmo
 * critério de honestidade já usado no resto do projeto , ver
 * `AfdService`/`HoleriteService`):
 *   - Não assina com certificado ICP-Brasil A1. A assinatura por
 *     evento existe só para as marcações originais do motorista
 *     (`RegistroJornada`, RSA-SHA256, certificado emitido pela CA
 *     interna da FVF Hórus, self-signed) , os ajustes lançados/
 *     aprovados pelo RH (`TratamentoPonto`) não são assinados com
 *     certificado: pesquisa jurídica na Rodada 29 (Portaria MTP
 *     671/2021 art. 82 §único, CLT art. 74, jurisprudência do TST)
 *     mostrou que isso não é exigido , o registro paralelo com
 *     usuarioId + hash-chain (usuário responsável, motivo, ancoragem
 *     no ledger do motorista) já atende , ver "Dívidas técnicas" em
 *     claude/arquitetura-seguranca-controle-jornada.md.
 *   - Não valida o relógio contra um servidor NTP dedicado nem contra
 *     satélite diretamente , usa o `timestampEvento` do aparelho (GPS
 *     do próprio celular, quando disponível) e o `createdAt` do
 *     servidor no momento em que o evento chegou; a checagem de
 *     relógio suspeito já existe no motor antifraude
 *     (`AntifraudeService.avaliarRelogioSuspeito`), mas é uma
 *     comparação de deriva, não uma prova NTP formal.
 *   - Feriados: desde a Rodada 29, o RH cadastra manualmente os
 *     feriados que a empresa aceita (por grupo ou por CNPJ , ver
 *     model `Feriado`) e decide se cada um recebe o percentual
 *     diferenciado de domingo/feriado da CCT. O sistema NÃO tem uma
 *     base nacional/municipal de feriados embutida: um feriado que o
 *     RH não cadastrar não é considerado automaticamente. Domingo
 *     continua sendo detectado sozinho (dia da semana, sempre
 *     calculável).
 *   - Um "horário corrigido" (TratamentoPonto/SolicitacaoAjustePonto
 *     aprovada) nunca aparece misturado nas marcações reais com GPS ,
 *     fica numa seção separada, deixando explícito que aquele ajuste
 *     não prova onde o motorista estava no horário original nem no
 *     horário corrigido (ver Rodada 27, FAQ do usuário).
 */

interface EmpresaDoRelatorio {
  razaoSocial: string;
  cnpj: string;
  /// Rodada 146 , fuso IANA da transportadora (padrão America/Sao_Paulo).
  fusoHorario?: string | null;
}

/** Feriado do período, já resolvido pelo chamador via FeriadosService.listarParaRelatorio (Rodada 29). */
export interface FeriadoDoRelatorio {
  data: string; // 'YYYY-MM-DD'
  descricao: string;
  pagoComoDomingo: boolean;
}

/** TratamentoPonto com o nome de quem assinou, necessário pra exibir a autoria na seção de ajustes. */
type TratamentoComUsuario = TratamentoPonto & { usuario: { nome: string } };

export interface RepPOpcoes {
  periodoInicio: Date;
  periodoFim: Date;
}

const ROTULO_EVENTO: Record<TipoEvento, string> = {
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

const CATEGORIA_LEGAL: Record<TipoEvento, string> = {
  INICIO_JORNADA: 'Jornada de Trabalho',
  INICIO_DESCANSO: 'Descanso/Intervalo',
  FIM_DESCANSO: 'Descanso/Intervalo',
  INICIO_DIRECAO: 'Tempo de Direção (Lei 13.103/2015)',
  FIM_DIRECAO: 'Tempo de Direção (Lei 13.103/2015)',
  ESPERA_CARGA_DESCARGA: 'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
  FIM_ESPERA_CARGA_DESCARGA:
    'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
  FIM_DESCARREGAMENTO: 'Tempo de Espera (Lei 13.103/2015, art. 235-C §9º)',
  FIM_JORNADA: 'Jornada de Trabalho',
  OUTRO: 'Evento Diverso',
};

const ADICIONAL_NOTURNO_INICIO_HORA = 22;
const ADICIONAL_NOTURNO_FIM_HORA = 5;
const DESCANSO_INTERJORNADA_MINIMO_MIN = 660; // 11h (CLT art. 66 / Lei 13.103)
const LIMITE_JORNADA_DIRECAO_ATENCAO_MIN = 480; // 8h , mesma constante de JornadaLegalService (duplicada de propósito, ver cabeçalho do arquivo)

interface EventoLinha {
  origem: 'REGISTRO' | 'AJUSTE_RH';
  timestampEvento: Date;
  tipoEvento: TipoEvento;
  registro?: RegistroJornada & { nsr: number };
  tratamento?: TratamentoPonto;
}

interface ResumoDia {
  dia: string;
  direcaoMin: number;
  esperaMin: number;
  intrajornadaMin: number;
  pausasDirecaoContinuadaMin: number;
  normalMin: number;
  extraFaixa1Min: number;
  extraFaixa2Min: number;
  percentualExtra1: number;
  percentualExtra2: number;
  ehDomingo: boolean;
  ehFeriado: boolean;
  descricaoFeriado: string | null;
  noturnoMin: number;
  percentualNoturno: number;
  descansoInterjornadaMin: number | null;
  descansoInterjornadaAbaixoDoMinimo: boolean;
}

@Injectable()
export class RepPService {
  constructor(private readonly nsr: NsrService) {}

  async gerarPdf(
    motorista: Pick<
      Motorista,
      'nome' | 'cpf' | 'cnh' | 'hashGenesis' | 'certificadoFingerprint'
    >,
    empresa: EmpresaDoRelatorio,
    regraSindical: RegraSindical | null,
    registrosEntrada: RegistroJornada[],
    tratamentosEntrada: TratamentoComUsuario[],
    feriadosNoPeriodo: FeriadoDoRelatorio[],
    opcoes: RepPOpcoes,
    deviceUuidAtual: string | null,
  ): Promise<Buffer> {
    const registros = [...registrosEntrada].sort(compararPorTimestampEvento);
    const tratamentos = [...tratamentosEntrada].sort(
      (a, b) => a.timestampEvento.getTime() - b.timestampEvento.getTime(),
    );

    const registrosComNsr = await Promise.all(
      registros.map(async (r) => ({
        ...r,
        nsr: await this.nsr.obterOuCriar(`registro:${r.id}`, 7),
      })),
    );

    const eventos: EventoLinha[] = [
      ...registrosComNsr.map((r) => ({
        origem: 'REGISTRO' as const,
        timestampEvento: r.timestampEvento,
        tipoEvento: r.tipoEvento,
        registro: r,
      })),
    ];

    // Só feriados marcados como "pago como domingo" entram na conta do
    // percentual diferenciado , um feriado cadastrado só como
    // informativo (pagoComoDomingo: false) não altera o cálculo.
    const feriadosPagosSet = new Set(
      feriadosNoPeriodo.filter((f) => f.pagoComoDomingo).map((f) => f.data),
    );
    const feriadosPorDia = new Map(
      feriadosNoPeriodo.map((f) => [f.data, f.descricao]),
    );

    // Rodada 146/147: cada marcação cai no dia civil do fuso em que foi
    // batida. Direção, espera e adicional noturno são calculados por pedaço
    // (sem cruzar meia-noite nem troca de fuso), cada um na parede do fuso
    // em que o motorista estava. A troca de fuso vale a partir do ponto
    // seguinte (aqui não há amostras de GPS; o holerite refina com elas).
    const offsetEmpresaMin = offsetPadraoDaEmpresa(empresa.fusoHorario);
    const linhaFuso = construirLinhaDoTempoFuso(
      registros.map((r) => ({
        t: r.timestampEvento.getTime(),
        offsetMin: r.fusoOffsetMin ?? null,
      })),
      [],
      offsetEmpresaMin,
    );
    const offsetPorDia = new Map<string, number>();
    for (const e of eventos) {
      const off = e.registro?.fusoOffsetMin ?? offsetEmpresaMin;
      const chave = this.chaveDia(e.timestampEvento, off);
      if (!offsetPorDia.has(chave)) offsetPorDia.set(chave, off);
    }
    const diasChaves = Array.from(offsetPorDia.keys()).sort();
    const resumosPorDia = diasChaves.map((dia) =>
      this.resumirDia(
        dia,
        registros,
        regraSindical,
        feriadosPagosSet,
        feriadosPorDia,
        offsetPorDia.get(dia) ?? offsetEmpresaMin,
        linhaFuso,
      ),
    );

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finalizado = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    this.escreverCabecalho(
      doc,
      motorista,
      empresa,
      opcoes,
      regraSindical,
      feriadosNoPeriodo,
    );
    this.escreverTabelaEventos(doc, eventos, offsetEmpresaMin);
    this.escreverResumosDiarios(doc, resumosPorDia);
    if (tratamentos.length > 0) {
      this.escreverAjustesRh(doc, tratamentos, linhaFuso, offsetEmpresaMin);
    }
    this.escreverRodape(
      doc,
      motorista,
      registros,
      tratamentos,
      deviceUuidAtual,
    );

    doc.end();
    return finalizado;
  }

  // --- Cabeçalho --------------------------------------------------

  private escreverCabecalho(
    doc: PDFKit.PDFDocument,
    motorista: Pick<Motorista, 'nome' | 'cpf' | 'cnh'>,
    empresa: EmpresaDoRelatorio,
    opcoes: RepPOpcoes,
    regraSindical: RegraSindical | null,
    feriadosNoPeriodo: FeriadoDoRelatorio[],
  ) {
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
    doc.text(
      // Rodada 97 , mesmo bug/correção do comprovante e do holerite: ver
      // comentário completo em holerite-pdf.util.ts.
      `Período: ${opcoes.periodoInicio.toLocaleString('pt-BR', { timeZone: 'UTC' })} até ${opcoes.periodoFim.toLocaleString('pt-BR', { timeZone: 'UTC' })}`,
    );
    doc.text(
      `Gerado em: ${agoraDoCliente()}`,
    );
    doc.text(
      regraSindical
        ? `Convenção coletiva aplicada: ${regraSindical.nome} (${regraSindical.categoriaTransporte})`
        : 'Convenção coletiva aplicada: nenhuma vinculada a este CNPJ , parâmetros de referência CLT/Lei 13.103',
    );
    doc.text(
      feriadosNoPeriodo.length > 0
        ? `Feriados cadastrados pelo RH e considerados neste período: ${feriadosNoPeriodo
            .map(
              (f) =>
                `${this.formatarDiaBr(f.data)} (${f.descricao}${f.pagoComoDomingo ? '' : ', informativo , sem percentual diferenciado'})`,
            )
            .join('; ')}`
        : 'Feriados cadastrados pelo RH e considerados neste período: nenhum , só domingos recebem o percentual diferenciado, quando configurado na convenção coletiva.',
      { align: 'justify' },
    );
    doc.moveDown();
  }

  // --- Tabela de eventos -------------------------------------------

  private escreverTabelaEventos(
    doc: PDFKit.PDFDocument,
    eventos: EventoLinha[],
    offsetEmpresaMin: number,
  ) {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Marcações do período');
    doc.moveDown(0.3);

    let diaAtual: string | null = null;
    for (const evento of eventos) {
      const offsetEvento = evento.registro?.fusoOffsetMin ?? offsetEmpresaMin;
      const dia = this.chaveDia(evento.timestampEvento, offsetEvento);
      if (dia !== diaAtual) {
        diaAtual = dia;
        doc.moveDown(0.4);
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#1f2937')
          .text(`, ${this.formatarDiaBr(dia)} ,`);
      }

      const registro = evento.registro!;
      // Hora de parede do fuso em que o ponto foi batido; selo "(UTC-x)"
      // quando difere do fuso da empresa.
      const horarioBase = paraParedeBrt(evento.timestampEvento, offsetEvento)
        .toISOString()
        .slice(11, 19);
      const horario =
        offsetEvento === offsetEmpresaMin
          ? horarioBase
          : `${horarioBase} (${rotuloFuso(offsetEvento)})`;
      const gps =
        registro.latitude != null && registro.longitude != null
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
        .text(
          `   Localização GPS: ${gps}   |   Categoria legal: ${CATEGORIA_LEGAL[evento.tipoEvento]}   |   NSR: ${registro.nsr}`,
        );
    }
    doc.moveDown();
  }

  // --- Resumo diário -------------------------------------------------

  private escreverResumosDiarios(
    doc: PDFKit.PDFDocument,
    resumos: ResumoDia[],
  ) {
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
      doc.text(
        `Intervalo Intrajornada (1º período de descanso): ${this.formatarHoras(r.intrajornadaMin)}`,
      );
      doc.text(
        `Pausas de Direção Continuada (demais descansos do dia): ${this.formatarHoras(r.pausasDirecaoContinuadaMin)}`,
      );
      const rotuloDiferenciado =
        r.ehDomingo && r.ehFeriado
          ? `domingo e feriado (${r.descricaoFeriado})`
          : r.ehFeriado
            ? `feriado (${r.descricaoFeriado})`
            : r.ehDomingo
              ? 'domingo'
              : null;
      doc.text(
        `Horas Extras ${r.percentualExtra1}%: ${this.formatarHoras(r.extraFaixa1Min)}` +
          (r.extraFaixa2Min > 0
            ? `   |   Horas Extras ${r.percentualExtra2}%: ${this.formatarHoras(r.extraFaixa2Min)}`
            : '') +
          (rotuloDiferenciado
            ? `   (${rotuloDiferenciado} , percentual diferenciado da CCT aplicado, quando configurado)`
            : ''),
      );
      doc.text(
        `Adicional Noturno (${r.percentualNoturno}%): ${this.formatarHoras(r.noturnoMin)}`,
      );
      doc.text(
        r.descansoInterjornadaMin == null
          ? 'Descanso Interjornada Próximo: não apurável (jornada seguinte ainda não iniciada no período consultado)'
          : `Descanso Interjornada Próximo: ${this.formatarHoras(r.descansoInterjornadaMin)}` +
              (r.descansoInterjornadaAbaixoDoMinimo
                ? '  ⚠ abaixo do mínimo legal de 11:00'
                : ''),
      );
      doc.moveDown(0.6);
    }
  }

  // --- Ajustes de RH (separado, nunca misturado nas marcações reais) --

  private escreverAjustesRh(
    doc: PDFKit.PDFDocument,
    tratamentos: TratamentoComUsuario[],
    linhaFuso: PontoFuso[],
    padraoMin: number,
  ) {
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
      .text(
        'Estes horários foram lançados/aprovados pelo RH (fluxo direto do gestor ou solicitação aprovada do ' +
          'motorista) e entram na apuração de horas para pagamento , mas NÃO fazem parte das marcações reais com ' +
          'GPS acima, e um horário corrigido não comprova onde o motorista estava naquele instante. Cada ajuste ' +
          'registra o usuário do RH/gestor responsável e fica ancorado no hash-chain do motorista (prova sobre ' +
          'qual estado da cadeia o ajuste foi lançado).',
        { align: 'justify' },
      );
    doc.moveDown(0.3);

    for (const t of tratamentos) {
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#111827')
        .text(
          `${instanteDoEvento(
            t.timestampEvento,
            (t as { fusoOffsetMin?: number | null }).fusoOffsetMin ??
              offsetNoInstante(linhaFuso, t.timestampEvento.getTime(), padraoMin),
          )}  ,  ${ROTULO_EVENTO[t.tipoEvento]}`,
        );
      doc.fontSize(7.5).fillColor('#6b7280').text(`   Motivo: ${t.motivo}`);
      doc
        .fontSize(7.5)
        .fillColor('#6b7280')
        .text(`   Lançado por: ${t.usuario.nome}`);
    }
    doc.moveDown();
  }

  // --- Rodapé criptográfico -------------------------------------------

  private escreverRodape(
    doc: PDFKit.PDFDocument,
    motorista: Pick<Motorista, 'hashGenesis' | 'certificadoFingerprint'>,
    registros: RegistroJornada[],
    tratamentos: TratamentoPonto[],
    deviceUuidAtual: string | null,
  ) {
    doc.moveDown();
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Autenticidade e integridade');
    doc.fontSize(8).font('Helvetica').fillColor('#111827');

    const ultimoRegistro = registros.at(-1);
    doc.text(`Hash gênesis da cadeia do motorista: ${motorista.hashGenesis}`);
    doc.text(
      ultimoRegistro
        ? `Hash do último evento no período (SHA-256, cadeia encadeada): ${ultimoRegistro.hashAtual}`
        : 'Nenhum evento com GPS no período , cadeia de hash não avaliada.',
    );
    doc.text(
      `Status de alteração: ${
        tratamentos.length === 0
          ? 'NENHUMA ALTERAÇÃO RETROATIVA DETECTADA'
          : `${tratamentos.length} AJUSTE(S) DE RH APLICADO(S) NESTE PERÍODO , ver seção "Ajustes de RH" acima. As marcações originais com GPS nunca são sobrescritas (ledger imutável).`
      }`,
    );
    doc.text(
      `Dispositivo(s) usado(s) no período: ${
        Array.from(new Set(registros.map((r) => r.deviceUuidUsado))).join(
          ', ',
        ) || 'nenhum'
      }` +
        (deviceUuidAtual
          ? `   |   Dispositivo vinculado atualmente: ${deviceUuidAtual}`
          : ''),
    );
    doc.text(
      `Assinatura digital por evento: RSA-SHA256, certificado emitido pela cadeia interna da FVF Hórus ` +
        `(fingerprint do motorista: ${motorista.certificadoFingerprint ?? 'não disponível'}). Os ajustes de RH ` +
        `deste período, quando houver, não são assinados com certificado (não exigido por lei , ver seção ` +
        `"Ajustes de RH") , ficam identificados pelo usuário responsável e ancorados no hash-chain. O ` +
        `certificado do motorista não é ICP-Brasil A1 nesta versão , ver dívidas técnicas do projeto.`,
      { align: 'justify' },
    );
    doc.text(
      `Validação de horário: timestampEvento capturado no aparelho no momento do toque (com GPS do próprio ` +
        `celular quando disponível) e conferido contra deriva de relógio pelo motor antifraude , não é uma ` +
        `validação formal por servidor NTP dedicado.`,
      { align: 'justify' },
    );
    doc.moveDown(0.5);
    doc
      .fontSize(7)
      .fillColor('#6b7280')
      .text(
        'Este relatório organiza e categoriza a jornada registrada , não calcula a folha de pagamento completa ' +
          '(salário, DSR e demais verbas) nem constitui, por si só, garantia de conformidade trabalhista. A ' +
          'adequação depende das regras configuradas, dos processos internos e das normas aplicáveis à empresa.',
        { align: 'justify' },
      );
  }

  // --- Cálculo do resumo diário -------------------------------------

  private resumirDia(
    dia: string,
    registros: RegistroJornada[],
    regra: RegraSindical | null,
    feriadosPagosSet: Set<string>,
    feriadosPorDia: Map<string, string>,
    offsetMin: number,
    linhaFuso: PontoFuso[] = [],
  ): ResumoDia {
    // Rodada 144/146: o dia é o dia civil do fuso em que o motorista estava
    // (00:00 a 23:59:59.999 na parede desse fuso).
    const inicioDia = new Date(
      new Date(`${dia}T00:00:00.000Z`).getTime() - offsetMin * 60_000,
    );
    const fimDia = new Date(inicioDia.getTime() + DIA_MS - 1);

    const direcaoMin = this.somarPedacosDoDia(
      registros,
      TipoEvento.INICIO_DIRECAO,
      [TipoEvento.FIM_DIRECAO],
      dia,
      linhaFuso,
      offsetMin,
    ).total;
    const esperaMin = this.somarPedacosDoDia(
      registros,
      TipoEvento.ESPERA_CARGA_DESCARGA,
      [TipoEvento.FIM_ESPERA_CARGA_DESCARGA, TipoEvento.FIM_DESCARREGAMENTO],
      dia,
      linhaFuso,
      offsetMin,
    ).total;

    const pausas = this.construirIntervalosCompletos(
      registros,
      TipoEvento.INICIO_DESCANSO,
      [TipoEvento.FIM_DESCANSO],
    )
      .filter(
        (p) =>
          p.fim.getTime() > inicioDia.getTime() &&
          p.inicio.getTime() < fimDia.getTime(),
      )
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    const intrajornadaMin =
      pausas.length > 0
        ? this.minutosEntre(pausas[0].inicio, pausas[0].fim)
        : 0;
    const pausasDirecaoContinuadaMin = pausas
      .slice(1)
      .reduce((acc, p) => acc + this.minutosEntre(p.inicio, p.fim), 0);

    const noturnoMin = this.somarPedacosDoDia(
      registros,
      TipoEvento.INICIO_DIRECAO,
      [TipoEvento.FIM_DIRECAO],
      dia,
      linhaFuso,
      offsetMin,
    ).noturno;

    const limiteJornadaNormalMin = regra?.limiteJornadaNormalMin ?? 480;
    const limiteFaixa1Min = regra?.limiteHoraExtraFaixa1Min ?? 120;
    const ehDomingo = inicioDia.getUTCDay() === 0;
    const ehFeriado = feriadosPagosSet.has(dia);
    const diferenciado = ehDomingo || ehFeriado;
    const percentualExtra1 = Number(
      (diferenciado ? regra?.percentualHoraExtraDomingoFeriado : undefined) ??
        regra?.percentualHoraExtra1 ??
        50,
    );
    const percentualExtra2 = Number(
      (diferenciado ? regra?.percentualHoraExtraDomingoFeriado : undefined) ??
        regra?.percentualHoraExtra2 ??
        70,
    );
    const percentualNoturno = Number(regra?.percentualAdicionalNoturno ?? 20);

    const totalExtraMin = Math.max(
      0,
      Math.round(direcaoMin) - limiteJornadaNormalMin,
    );
    const normalMin = Math.min(Math.round(direcaoMin), limiteJornadaNormalMin);
    const extraFaixa1Min = Math.min(totalExtraMin, limiteFaixa1Min);
    const extraFaixa2Min = Math.max(0, totalExtraMin - limiteFaixa1Min);

    const { descansoInterjornadaMin } = this.calcularDescansoInterjornada(
      registros,
      inicioDia,
      fimDia,
    );

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
      descansoInterjornadaAbaixoDoMinimo:
        descansoInterjornadaMin != null &&
        descansoInterjornadaMin < DESCANSO_INTERJORNADA_MINIMO_MIN,
    };
  }

  /**
   * Descanso interjornada: do FIM_JORNADA deste dia até o próximo
   * INICIO_JORNADA encontrado depois dele.
   *
   * Pedido do usuário: "por acidente ele pode finalizar a jornada
   * antes do fim do dia e iniciar outra não tem problema... o aviso
   * deve aparecer se ele já cumpriu as horas determinadas por lei".
   * Só retorna o descanso (pra o PDF marcar "abaixo do mínimo") quando
   * a jornada que terminou nesse FIM_JORNADA já tinha cumprido o
   * limite legal de direção (8h) , senão essa jornada ficou
   * incompleta e a próxima é um complemento dela, não uma jornada
   * nova de verdade (mesma regra aplicada no alerta , ver
   * JornadaLegalService.avaliarDescansoInterjornada).
   */
  private calcularDescansoInterjornada(
    registros: RegistroJornada[],
    inicioDia: Date,
    fimDia: Date,
  ): { descansoInterjornadaMin: number | null } {
    const fimJornadaDoDia = registros
      .filter(
        (r) =>
          r.tipoEvento === TipoEvento.FIM_JORNADA &&
          r.timestampEvento.getTime() >= inicioDia.getTime() &&
          r.timestampEvento.getTime() <= fimDia.getTime(),
      )
      .sort(compararPorTimestampEvento)
      .at(-1);
    if (!fimJornadaDoDia) return { descansoInterjornadaMin: null };

    const proximoInicioJornada = registros
      .filter(
        (r) =>
          r.tipoEvento === TipoEvento.INICIO_JORNADA &&
          r.timestampEvento.getTime() >
            fimJornadaDoDia.timestampEvento.getTime(),
      )
      .sort(compararPorTimestampEvento)[0];
    if (!proximoInicioJornada) return { descansoInterjornadaMin: null };

    const inicioJornadaQueTerminouAqui = registros
      .filter(
        (r) =>
          r.tipoEvento === TipoEvento.INICIO_JORNADA &&
          r.timestampEvento.getTime() <=
            fimJornadaDoDia.timestampEvento.getTime(),
      )
      .sort(compararPorTimestampEvento)
      .at(-1);
    if (inicioJornadaQueTerminouAqui) {
      const direcaoDaJornadaMin = this.somarIntervalosNoDia(
        registros,
        TipoEvento.INICIO_DIRECAO,
        [TipoEvento.FIM_DIRECAO],
        inicioJornadaQueTerminouAqui.timestampEvento,
        fimJornadaDoDia.timestampEvento,
      );
      if (direcaoDaJornadaMin < LIMITE_JORNADA_DIRECAO_ATENCAO_MIN) {
        // Jornada incompleta (menos de 8h de direção) , a próxima é
        // um complemento dela, não conta descanso interjornada.
        return { descansoInterjornadaMin: null };
      }
    }

    return {
      descansoInterjornadaMin: this.minutosEntre(
        fimJornadaDoDia.timestampEvento,
        proximoInicioJornada.timestampEvento,
      ),
    };
  }

  /**
   * Soma (e conta o noturno 22h-5h) dos pedaços de cada intervalo que caem
   * no dia civil `dia`, cada pedaço no fuso em que o motorista estava.
   */
  private somarPedacosDoDia(
    registros: RegistroJornada[],
    tipoInicio: TipoEvento,
    tiposFim: TipoEvento[],
    dia: string,
    linhaFuso: PontoFuso[],
    padraoMin: number,
  ): { total: number; noturno: number } {
    let total = 0;
    let noturno = 0;
    for (const intervalo of this.construirIntervalosCompletos(
      registros,
      tipoInicio,
      tiposFim,
    )) {
      for (const pedaco of dividirPorDiaCivil(
        intervalo.inicio,
        intervalo.fim,
        linhaFuso,
        padraoMin,
      )) {
        if (chaveDiaBrt(pedaco.inicio, pedaco.offsetMin) !== dia) continue;
        total += this.minutosEntre(pedaco.inicio, pedaco.fim);
        noturno += minutosNoturnosEntre(
          pedaco.inicio,
          pedaco.fim,
          pedaco.offsetMin,
          ADICIONAL_NOTURNO_INICIO_HORA,
          ADICIONAL_NOTURNO_FIM_HORA,
        );
      }
    }
    return { total, noturno };
  }

  private somarIntervalosNoDia(
    registros: RegistroJornada[],
    tipoInicio: TipoEvento,
    tiposFim: TipoEvento[],
    inicioDia: Date,
    fimDia: Date,
  ): number {
    const intervalos = this.construirIntervalosCompletos(
      registros,
      tipoInicio,
      tiposFim,
    );
    let total = 0;
    for (const intervalo of intervalos) {
      const inicio =
        intervalo.inicio.getTime() > inicioDia.getTime()
          ? intervalo.inicio
          : inicioDia;
      const fim =
        intervalo.fim.getTime() < fimDia.getTime() ? intervalo.fim : fimDia;
      if (fim.getTime() > inicio.getTime())
        total += this.minutosEntre(inicio, fim);
    }
    return total;
  }

  /** Intervalos INICIO_X→FIM_X completos de TODO o histórico disponível (não só do dia) , necessário pra um intervalo que cruza meia-noite ser corretamente fatiado por somarIntervalosNoDia. */
  private construirIntervalosCompletos(
    registros: RegistroJornada[],
    tipoInicio: TipoEvento,
    tiposFim: TipoEvento[],
  ): Array<{ inicio: Date; fim: Date }> {
    const valoresFim = new Set(tiposFim);
    const ordenados = [...registros].sort(compararPorTimestampEvento);
    const intervalos: Array<{ inicio: Date; fim: Date }> = [];
    let aberto: Date | null = null;
    for (const r of ordenados) {
      if (r.tipoEvento === tipoInicio) {
        aberto = r.timestampEvento;
      } else if (valoresFim.has(r.tipoEvento) && aberto) {
        intervalos.push({ inicio: aberto, fim: r.timestampEvento });
        aberto = null;
      }
    }
    return intervalos;
  }

  private minutosEntre(inicio: Date, fim: Date): number {
    return (fim.getTime() - inicio.getTime()) / 60000;
  }

  private chaveDia(data: Date, offsetMin: number): string {
    return chaveDiaBrt(data, offsetMin);
  }

  private formatarDiaBr(chaveDia: string): string {
    const [ano, mes, dia] = chaveDia.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /** "270" -> "04:30" , mesma convenção usada em todo o resto do sistema desde a Rodada 12, nunca minutos crus. */
  private formatarHoras(minutos: number): string {
    const totalMin = Math.max(0, Math.round(minutos));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
