import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  Prisma,
  RegistroJornada,
  SeveridadeAlerta,
  TipoAlertaJornada,
  TipoEvento,
} from '@prisma/client';
import { AntifraudeService } from '../common/antifraude/antifraude.service';
import { JornadaLegalService } from '../common/jornada-legal/jornada-legal.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { AuditService } from '../common/audit/audit.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import {
  TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN,
  calcularDivergenciaRelogioConfiavelMin,
} from '../common/relogio-confiavel/relogio-confiavel.util';
import { CertificateService } from '../common/signature/certificate.service';
import { SignatureService } from '../common/signature/signature.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QueueEvents } from 'bullmq';
import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';
import { VerificacaoJornadaAgendadaService } from './verificacao-agendada.service';
import {
  FILA_LOTE_REGISTROS_JORNADA,
  JobLoteRegistroJornada,
  ResultadoItemLote,
} from './lote-registros-jornada.constants';
import {
  chaveDiaBrt,
  fimDePeriodoBrt,
  inicioDePeriodoBrt,
  marcarHorario,
  resolverFusoDoRegistro,
} from '../common/fuso/fuso-brasil.util';

export type JornadaResumo = ReturnType<
  RegistrosJornadaService['resumirJornadaDiaria']
>;

export interface ViagemConsolidada {
  inicio: Date;
  fim: Date;
  diasCorridos: number;
  emAndamento: boolean;
  jornadas: JornadaResumo[];
  totalDirecaoMin: number;
  totalEsperaMin: number;
  totalJornadaMin: number;
  /**
   * CT-e(s) cuja cobertura (vínculo → entrega) definiu esta viagem ,
   * ver Rodada 16. Vazio quando a viagem é uma jornada avulsa, sem
   * nenhum CT-e vinculado ao motorista no período dela.
   */
  ctesRelacionados: { id: string; numero: string | null }[];
}

@Injectable()
export class RegistrosJornadaService {
  // Mesmo valor de DESVIO_RELOGIO_FUTURO_MAXIMO_MIN em AntifraudeService ,
  // duplicado de propósito (mesma convenção do resto do projeto: módulos
  // que não precisam ficar acoplados documentam a própria constante).
  private static readonly TOLERANCIA_RELOGIO_FUTURO_MIN = 10;

  // Rodada 88 , tolerância pra divergência entre o quanto o relógio de
  // PAREDE andou e o quanto o relógio MONOTÔNICO (elapsedRealtime) andou
  // entre dois toques do MESMO aparelho, sem reiniciar no meio. Os dois
  // deveriam andar praticamente juntos (a menos de deriva normal de
  // NTP/fuso, sempre da ordem de segundos) , uma diferença grande só
  // acontece se alguém mexeu manualmente na data/hora do aparelho no
  // meio do caminho. 5 minutos de folga é generoso o bastante pra
  // absorver qualquer deriva legítima sem abrir brecha pro ataque que o
  // usuário demonstrou (adiantar horas e bater ponto).
  private static readonly TOLERANCIA_DIVERGENCIA_RELOGIO_MONOTONICO_MIN = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly certificados: CertificateService,
    private readonly assinaturas: SignatureService,
    private readonly audit: AuditService,
    private readonly jornadaLegal: JornadaLegalService,
    private readonly antifraude: AntifraudeService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly tenant: TenantService,
    /**
     * Opcional (Rodada 21): produtor da fila de verificação agendada.
     * Fica opcional só pra não obrigar os specs que instanciam esta
     * classe diretamente com mocks posicionais (sem `@nestjs/testing`)
     * a passar um 12º mock que não têm interesse em exercitar , em
     * produção o Nest sempre injeta a instância real. Quando ausente
     * (testes antigos), `agendarProximaVerificacaoSeAplicavel` só
     * retorna sem fazer nada, preservando o comportamento anterior.
     */
    private readonly verificacaoAgendada?: VerificacaoJornadaAgendadaService,
    /**
     * Opcional (Rodada 66), mesmo raciocínio do parâmetro acima ,
     * produtor da fila de processamento de lotes de ponto. Ausente só
     * em specs antigos que instanciam a classe sem @nestjs/testing;
     * quando ausente, `processarLote` cai direto no fallback síncrono
     * (mesmo comportamento de quando o Redis está fora do ar).
     */
    @InjectQueue(FILA_LOTE_REGISTROS_JORNADA)
    private readonly filaLote?: Queue<JobLoteRegistroJornada>,
  ) {}

  private readonly logger = new Logger(RegistrosJornadaService.name);

  /**
   * Conexão dedicada só para ESPERAR o resultado de um job da fila de
   * lote (`Job.waitUntilFinished`) , não reaproveita a conexão da
   * `Queue` injetada porque o BullMQ exige um `QueueEvents` próprio pra
   * isso. Criada uma única vez (lazy) e reusada por toda a vida do
   * processo; uma falha ao conectar nunca deve derrubar o serviço ,
   * `processarLote` trata isso com o mesmo fail-open dos demais pontos
   * que dependem do Redis.
   */
  private queueEventsLote?: QueueEvents;
  private obterQueueEventsLote(): QueueEvents {
    if (!this.queueEventsLote) {
      this.queueEventsLote = new QueueEvents(FILA_LOTE_REGISTROS_JORNADA, {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      });
      this.queueEventsLote.on('error', (err) => {
        this.logger.warn(
          `QueueEvents (lote de registros) reportou erro de conexão: ${err.message}`,
        );
      });
    }
    return this.queueEventsLote;
  }

  /**
   * Anexa um evento ao "livro" (ledger) do motorista.
   *
   * Só existe CREATE aqui , nunca update/delete (também bloqueado a
   * nível de banco pelo trigger WORM). Uma correção é sempre um novo
   * evento (ex.: OUTRO com observação de estorno), igual a um extrato
   * bancário: nada some, tudo se soma.
   *
   * `Serializable` isolation garante que dois eventos do mesmo
   * motorista não recebam o mesmo `sequencial`/`hashAnterior` mesmo se
   * chegarem quase ao mesmo tempo (ex.: reconexão depois de offline
   * disparando vários envios em paralelo).
   */
  async create(
    motoristaId: string,
    deviceUuidUsado: string,
    dto: CreateRegistroJornadaDto,
    ip?: string,
    userAgent?: string,
  ) {
    const alertasCriticosParaNotificar: { mensagem: string; tipo: string }[] =
      [];
    let empresaIdParaNotificar: string | undefined;
    // Rodada 72 , preenchido dentro da transação por
    // `avaliarCteAbertoSemVinculoRecente` quando ela detecta o caso
    // (início de direção sem CT-e recente + CT-e em aberto pendente).
    // Guardado aqui (em vez de já disparar o WhatsApp dentro do tx)
    // pelo mesmo motivo dos outros dois envios abaixo: I/O de rede não
    // deve segurar o lock/transação do Postgres.
    let alertaCteAbertoParaNotificar: string | null = null;
    // Capturado ANTES da transação , é o horário "de verdade" em que o
    // servidor recebeu a requisição, usado pelo AntifraudeService pra
    // comparar contra o timestampEvento que o aparelho informou (ver
    // RELOGIO_DISPOSITIVO_SUSPEITO). Não usa o createdAt do registro pra
    // não acoplar essa checagem ao relógio interno da transação.
    const horaRecebimentoServidor = new Date();

    const registro = await this.prisma.$transaction(
      async (tx) => {
        // `tx` é gerado pelo próprio Prisma e NÃO passa pela
        // interceptação de RLS que `this.prisma.<modelo>` tem (ver
        // prisma.service.ts) , por isso o SET LOCAL é feito à mão,
        // uma única vez, aqui no início do bloco, valendo pra toda
        // operação dentro desta mesma transação.
        const ctxTenant = TenantContext.atual();
        if (!ctxTenant) {
          throw new Error(
            'create() de RegistroJornada sem contexto de tenant , ver TenantContextInterceptor.',
          );
        }
        await tx.$executeRawUnsafe(
          `SET LOCAL app.grupo_atual = '${ctxTenant.grupoId.replace(/'/g, "''")}'`,
        );

        if (dto.idempotencyKey) {
          const existente = await tx.registroJornada.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existente) return existente;
        }

        const motorista = await tx.motorista.findUnique({
          where: { id: motoristaId },
        });
        if (!motorista) throw new NotFoundException('Motorista não encontrado');
        empresaIdParaNotificar = motorista.empresaId;

        const ultimo = await tx.registroJornada.findFirst({
          where: { motoristaId },
          orderBy: { sequencial: 'desc' },
        });

        // Rodada 87 , pedido do usuário: mudar a hora do aparelho não pode
        // permitir bater ponto com um horário fabricado, e o sistema não
        // pode aceitar um ponto com suspeita desse tipo de fraude. Antes
        // disto, o `AntifraudeService` já DETECTAVA relógio adiantado
        // (`RELOGIO_DISPOSITIVO_SUSPEITO`) mas nunca bloqueava , só virava
        // alerta pra investigar depois (ponto sempre aceito, decisão
        // documentada no §15 do ARCHITECTURE.md pra sinais com risco de
        // falso positivo, como root/jailbreak). Aqui é diferente: os dois
        // sinais abaixo são confiáveis o bastante (mesma lógica que já
        // bloqueia mock location no app) e, sem bloquear, corrompem
        // diretamente o pareamento início/fim usado nos relatórios , foi
        // exatamente o que o usuário relatou ("as horas no relatório não
        // batem com o que foi registrado"): um evento gravado com o
        // relógio adiantado, seguido de outro com o relógio normal,
        // aparece como se o tempo tivesse andado pra trás.
        const timestampEventoNovo = new Date(dto.timestampEvento);
        // Rodada 92 , preenchido pela checagem nº4 abaixo quando o
        // evento precisa ficar pendente de verificação (ver bloco logo
        // após a criação do registro).
        let precisaRegistrarPendenciaRelogioConfiavel = false;

        // 1) Relógio andando pra trás em relação ao ÚLTIMO evento do
        //    PRÓPRIO motorista , fisicamente impossível sem mexer no
        //    relógio do aparelho entre os dois toques (mesmo offline, o
        //    tempo só anda pra frente entre dois toques do mesmo device).
        if (
          ultimo &&
          timestampEventoNovo.getTime() <= ultimo.timestampEvento.getTime()
        ) {
          await this.audit.registrar({
            actorType: ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'REGISTRO_REJEITADO_RELOGIO_RETROCEDIDO',
            entidade: 'RegistroJornada',
            detalhes: {
              tipoEvento: dto.tipoEvento,
              timestampEventoRecebido: dto.timestampEvento,
              timestampUltimoRegistro: ultimo.timestampEvento,
              deviceUuidUsado,
            },
            ip,
            userAgent,
          });
          throw new BadRequestException(
            'Não foi possível registrar: o horário deste evento é anterior (ou igual) ao seu último registro. ' +
              'Verifique a data e a hora do aparelho (recomendado: horário automático da operadora) e tente novamente.',
          );
        }

        // 2) Relógio adiantado em relação ao horário real , comparado
        //    contra o momento em que o SERVIDOR recebeu a requisição,
        //    mesmo limiar já usado pro alerta RELOGIO_DISPOSITIVO_SUSPEITO
        //    em AntifraudeService (10min de tolerância pra deriva normal
        //    de relógio/fuso), só que agora bloqueia em vez de só marcar.
        const minutosNoFuturo =
          (timestampEventoNovo.getTime() - horaRecebimentoServidor.getTime()) /
          60000;
        if (
          minutosNoFuturo >
          RegistrosJornadaService.TOLERANCIA_RELOGIO_FUTURO_MIN
        ) {
          await this.audit.registrar({
            actorType: ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'REGISTRO_REJEITADO_RELOGIO_ADIANTADO',
            entidade: 'RegistroJornada',
            detalhes: {
              tipoEvento: dto.tipoEvento,
              timestampEventoRecebido: dto.timestampEvento,
              horaRecebimentoServidor,
              minutosNoFuturo: Math.round(minutosNoFuturo),
              deviceUuidUsado,
            },
            ip,
            userAgent,
          });
          throw new BadRequestException(
            'Não foi possível registrar: o relógio do aparelho parece estar adiantado em relação ao horário real. ' +
              'Ajuste a data e a hora do celular (recomendado: horário automático da operadora) e tente novamente.',
          );
        }

        // 3) Relógio monotônico do MESMO aparelho (Rodada 88 , "próximo
        //    nível" pedido pelo usuário depois de conseguir a build EAS):
        //    diferente dos dois blocos acima (que só pegam relógio
        //    retrocedido ou adiantado em relação a AGORA), este pega o
        //    caso que passava batido pelos dois: adiantar o relógio
        //    ALGUMAS HORAS pra um horário passado plausível e bater o
        //    ponto offline (o motorista relatou isso testando , "apenas
        //    deixar o telefone no modo avião depois sobe tranquilamente").
        //    O relógio monotônico (elapsedRealtime/systemUptime) não pode
        //    ser alterado pelo usuário , só reseta ao reiniciar o
        //    aparelho. Se não houve reset (elapsedRealtime só cresce) e o
        //    tempo decorrido de PAREDE entre os dois toques diverge do
        //    tempo decorrido MONOTÔNICO além da tolerância, é prova de
        //    que o relógio de parede foi mexido manualmente entre os dois
        //    eventos , não tem outra explicação física possível (nem
        //    sincronização tardia legítima, que não muda o quanto o
        //    relógio monotônico andou).
        //
        //    Só roda quando os dois registros (o anterior e este) são do
        //    MESMO device (elapsedRealtime não é comparável entre
        //    aparelhos diferentes) e ambos trazem o valor (apps antigos /
        //    Expo Go sem o módulo nativo não trazem , nesse caso, sem
        //    dado pra comparar, a checagem é pulada pra este par,
        //    caindo de volta nas defesas de sempre).
        if (
          ultimo &&
          ultimo.deviceUuidUsado === deviceUuidUsado &&
          ultimo.elapsedRealtimeMs != null &&
          dto.elapsedRealtimeMs != null &&
          dto.elapsedRealtimeMs >= ultimo.elapsedRealtimeMs // senão, o aparelho reiniciou no meio , não dá pra comparar
        ) {
          const deltaParedeMs =
            timestampEventoNovo.getTime() - ultimo.timestampEvento.getTime();
          const deltaMonotonicoMs =
            dto.elapsedRealtimeMs - ultimo.elapsedRealtimeMs;
          const divergenciaMin =
            Math.abs(deltaParedeMs - deltaMonotonicoMs) / 60000;
          if (
            divergenciaMin >
            RegistrosJornadaService.TOLERANCIA_DIVERGENCIA_RELOGIO_MONOTONICO_MIN
          ) {
            await this.audit.registrar({
              actorType: ActorType.MOTORISTA,
              actorId: motoristaId,
              acao: 'REGISTRO_REJEITADO_RELOGIO_MONOTONICO_DIVERGENTE',
              entidade: 'RegistroJornada',
              detalhes: {
                tipoEvento: dto.tipoEvento,
                timestampEventoRecebido: dto.timestampEvento,
                timestampUltimoRegistro: ultimo.timestampEvento,
                deltaParedeMs,
                deltaMonotonicoMs,
                divergenciaMin: Math.round(divergenciaMin),
                deviceUuidUsado,
              },
              ip,
              userAgent,
            });
            throw new BadRequestException(
              'Não foi possível registrar: o relógio deste aparelho parece ter sido alterado manualmente entre o ' +
                'último ponto batido e agora. Ajuste a data e a hora do celular (recomendado: horário automático da ' +
                'operadora) e tente novamente. Se isto não fizer sentido, contate a empresa.',
            );
          }
        }

        // 4) Relógio CONFIÁVEL (Rodada 92) , fecha, com uma fonte
        //    EXTERNA de verdade, a lacuna que a checagem nº3 deixa de
        //    propósito quando o aparelho reinicia no meio. A Rodada 91
        //    tentou isso só com dados do PRÓPRIO aparelho (uma "âncora
        //    de boot" calculada a partir do registro anterior) e
        //    provou, por álgebra, que nunca podia disparar , ver o
        //    post-mortem completo no doc da Rodada 91. A diferença
        //    aqui: uma das pontas da comparação agora vem do relógio do
        //    SERVIDOR (`AmostraHoraConfiavel.horaServidorNoMomento`,
        //    gravada toda vez que o app sincroniza , ver
        //    RelogioConfiavelService), não mais do próprio aparelho ,
        //    isso é o "externo e confiável" que faltava.
        //
        //    Busca a amostra de hora confiável mais recente do MESMO
        //    boot deste evento: dentro de um boot o contador monotônico
        //    só cresce, então pedir a amostra com o MAIOR
        //    elapsedRealtimeMsNoMomento que ainda seja <= o deste evento
        //    já garante que ela é desse boot (ou de um boot anterior tão
        //    perto do fim que o uptime dele sozinho já bateria o deste
        //    evento , teoricamente possível, mas inofensivo: se for
        //    mesmo doutro boot, a comparação só fica mais rígida, nunca
        //    menos, porque qualquer boot entre os dois certamente usou
        //    ALGUM tempo real, que entra a favor da divergência).
        if (dto.elapsedRealtimeMs != null) {
          const amostraHoraConfiavel = await tx.amostraHoraConfiavel.findFirst({
            where: {
              deviceUuidUsado,
              elapsedRealtimeMsNoMomento: { lte: dto.elapsedRealtimeMs },
            },
            orderBy: { elapsedRealtimeMsNoMomento: 'desc' },
          });

          if (amostraHoraConfiavel) {
            const divergenciaHoraConfiavelMin =
              calcularDivergenciaRelogioConfiavelMin(
                timestampEventoNovo,
                dto.elapsedRealtimeMs,
                amostraHoraConfiavel,
              );
            if (
              divergenciaHoraConfiavelMin >
              TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN
            ) {
              await this.audit.registrar({
                actorType: ActorType.MOTORISTA,
                actorId: motoristaId,
                acao: 'REGISTRO_REJEITADO_RELOGIO_DIVERGENTE_DE_HORA_CONFIAVEL',
                entidade: 'RegistroJornada',
                detalhes: {
                  tipoEvento: dto.tipoEvento,
                  timestampEventoRecebido: dto.timestampEvento,
                  divergenciaMin: Math.round(divergenciaHoraConfiavelMin),
                  deviceUuidUsado,
                },
                ip,
                userAgent,
              });
              throw new BadRequestException(
                'Não foi possível registrar: comparando com a última vez que este aparelho confirmou a hora com o ' +
                  'servidor, o relógio dele parece ter sido alterado manualmente. Ajuste a data e a hora do celular ' +
                  '(recomendado: horário automático da operadora) e tente novamente. Se isto não fizer sentido, ' +
                  'contate a empresa.',
              );
            }
          } else {
            // Nenhuma amostra ainda deste boot (aparelho reiniciou e
            // ainda não teve , ou não aproveitou , nenhuma chance de
            // sincronizar antes deste toque): não dá pra provar nem
            // desmentir manipulação agora sem quebrar o uso offline
            // legítimo, então o evento é aceito e fica pendente de
            // verificação pra quando a próxima amostra deste boot
            // chegar (ver bloco logo após a criação do registro, e
            // RelogioConfiavelService.resolverPendencias).
            precisaRegistrarPendenciaRelogioConfiavel = true;
          }
        }

        const sequencial = (ultimo?.sequencial ?? 0) + 1;
        const hashAnterior = ultimo?.hashAtual ?? motorista.hashGenesis;

        // BUG DE INTEGRIDADE CORRIGIDO AQUI: latitude/longitude vêm do
        // GPS do aparelho com muito mais casas decimais do que a coluna
        // suporta (`Decimal(10,7)` , 7 casas). Antes desta correção, o
        // hash era calculado com o valor CRU (ex.: -23.550512345678) mas
        // o Postgres arredondava pra 7 casas ao gravar (-23.5505123) ,
        // na hora de verificar a integridade, recalculávamos o hash com
        // o valor JÁ ARREDONDADO lido de volta do banco, que não batia
        // com o hash gravado, mesmo sem NENHUMA adulteração real
        // (`verificarIntegridade` apontava "hashAtual não corresponde ao
        // recálculo" para registros com GPS). A correção é arredondar
        // ANTES de calcular o hash, pra garantir que o valor usado no
        // hash e o valor efetivamente gravado sejam sempre idênticos.
        const latitude = this.arredondarCoordenada(dto.latitude);
        const longitude = this.arredondarCoordenada(dto.longitude);

        // Rodada 146: fuso em que o ponto foi batido. O do aparelho vale,
        // exceto se contradiz o GPS por 2h+ (aí o GPS manda e o desvio
        // vai para a auditoria). App antigo (sem fuso) => null => vale o
        // fuso da empresa, como sempre foi.
        const fusoResolvido = resolverFusoDoRegistro(
          dto.fusoOffsetMin,
          dto.latitude,
          dto.longitude,
        );
        const fusoOffsetMin = fusoResolvido.offsetMin;

        const hashAtual = this.hashChain.calcularHash(
          hashAnterior,
          sequencial,
          {
            motoristaId,
            fusoOffsetMin,
            tipoEvento: dto.tipoEvento,
            timestampEvento: dto.timestampEvento,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            precisaoGpsM: dto.precisaoGpsM ?? null,
            observacao: dto.observacao ?? null,
            sequencial,
            deviceUuidUsado,
          },
        );

        const pfxDecifrado = this.crypto.decrypt(
          Buffer.from(motorista.certificadoPfxEnc as Buffer),
          motorista.certificadoIv!,
          motorista.certificadoAuthTag!,
          motorista.id,
        );
        const { privateKey } = this.certificados.decodificar(
          motorista.id,
          pfxDecifrado,
        );
        const assinaturaDigital = this.assinaturas.assinar(
          privateKey,
          hashAtual,
        );

        const registro = await tx.registroJornada.create({
          data: {
            motoristaId,
            tipoEvento: dto.tipoEvento,
            timestampEvento: new Date(dto.timestampEvento),
            latitude,
            longitude,
            precisaoGpsM: dto.precisaoGpsM,
            observacao: dto.observacao,
            sequencial,
            hashAnterior,
            hashAtual,
            assinaturaDigital,
            deviceUuidUsado,
            idempotencyKey: dto.idempotencyKey,
            elapsedRealtimeMs: dto.elapsedRealtimeMs ?? null,
            fusoOffsetMin,
          },
        });

        // Rodada 92 , ver checagem nº4 acima: este evento passou sem
        // nenhuma amostra de hora confiável do mesmo boot pra comparar
        // na hora, então fica registrado aqui pra ser reavaliado assim
        // que uma chegar (RelogioConfiavelService.resolverPendencias).
        if (
          precisaRegistrarPendenciaRelogioConfiavel &&
          dto.elapsedRealtimeMs != null
        ) {
          await tx.verificacaoRelogioPendente.create({
            data: {
              registroJornadaId: registro.id,
              motoristaId,
              deviceUuidUsado,
              elapsedRealtimeMs: dto.elapsedRealtimeMs,
              timestampEvento: timestampEventoNovo,
            },
          });
        }

        await this.audit.registrar({
          actorType: ActorType.MOTORISTA,
          actorId: motoristaId,
          acao: 'REGISTRO_JORNADA_CRIADO',
          entidade: 'RegistroJornada',
          entidadeId: registro.id,
          detalhes: { sequencial, tipoEvento: dto.tipoEvento, fusoOffsetMin },
          ip,
          userAgent,
        });

        // Rodada 146: o fuso informado pelo aparelho contradisse o GPS por
        // 2h ou mais. O GPS valeu (impede ganhar hora noturna só mudando o
        // fuso do celular); fica registrado pra conferência do gestor.
        if (fusoResolvido.divergenteDoGps) {
          await this.audit.registrar({
            actorType: ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'FUSO_APARELHO_INCOMPATIVEL_GPS',
            entidade: 'RegistroJornada',
            entidadeId: registro.id,
            detalhes: {
              fusoInformadoPeloAparelhoMin: fusoResolvido.informadoPeloAparelho,
              fusoAplicadoMin: fusoOffsetMin,
              latitude,
              longitude,
              deviceUuidUsado,
            },
            ip,
            userAgent,
          });
        }

        // Sinal de possível fraude (GPS falsificado/aparelho comprometido)
        // detectado pelo próprio app , nunca bloqueia o registro (o
        // ponto sempre é aceito), só fica marcado pra investigação do
        // gestor. Ver §15 do ARCHITECTURE.md.
        if (dto.flagsIntegridadeDispositivo?.length) {
          await this.audit.registrar({
            actorType: ActorType.MOTORISTA,
            actorId: motoristaId,
            acao: 'INTEGRIDADE_DISPOSITIVO_SUSPEITA',
            entidade: 'RegistroJornada',
            entidadeId: registro.id,
            detalhes: {
              flags: dto.flagsIntegridadeDispositivo,
              deviceUuidUsado,
            },
            ip,
            userAgent,
          });
        }

        const alertasGerados = await this.avaliarLimitesLegais(
          tx,
          motoristaId,
          registro,
        );
        const alertasFraude = await this.avaliarAntifraude(
          tx,
          motoristaId,
          registro,
          horaRecebimentoServidor,
          dto.flagsIntegridadeDispositivo,
        );
        const alertasFolga = await this.avaliarFolgaConflitante(
          tx,
          motoristaId,
          registro,
        );
        await this.avaliarDescarregamento(tx, motoristaId, registro);
        alertaCteAbertoParaNotificar =
          await this.avaliarCteAbertoSemVinculoRecente(
            tx,
            motoristaId,
            registro,
          );
        for (const alerta of [
          ...alertasGerados,
          ...alertasFraude,
          ...alertasFolga,
        ]) {
          if (alerta.severidade === 'CRITICO') {
            alertasCriticosParaNotificar.push({
              mensagem: alerta.mensagem,
              tipo: alerta.tipo,
            });
          }
        }

        return registro;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Fora da transação de propósito: enviar (ou tentar enviar) uma
    // notificação push é I/O que não deveria segurar o lock/transação
    // do banco. Fail-open (fire-and-forget) já é garantido dentro do
    // próprio PushNotificationsService.
    for (const alerta of alertasCriticosParaNotificar) {
      void this.pushNotifications.notificarMotorista(
        motoristaId,
        'Alerta de jornada',
        alerta.mensagem,
        { tipo: alerta.tipo },
      );
      if (empresaIdParaNotificar) {
        void this.whatsapp.notificarGestoresDaEmpresa(
          empresaIdParaNotificar,
          alerta.mensagem,
        );
      }
    }

    // Rodada 72 , pedido do usuário: "o sistema envia uma notificação
    // ao gestor e uma msg pelo WhatsApp que existe um documento em
    // aberto". Diferente do loop acima (só CRITICO), esse caso
    // específico dispara WhatsApp mesmo sendo ATENCAO , é
    // intencionalmente o único aviso desse tipo (não é um estouro de
    // limite legal), então não faz sentido esperar escalar pra
    // CRITICO pra avisar o gestor.
    if (alertaCteAbertoParaNotificar && empresaIdParaNotificar) {
      void this.whatsapp.notificarGestoresDaEmpresa(
        empresaIdParaNotificar,
        alertaCteAbertoParaNotificar,
      );
    }

    // Rodada 21: agenda (fora da transação, mesmo raciocínio de não
    // segurar o lock do Postgres por I/O de Redis já aplicado às duas
    // notificações acima) o próximo check deste motorista , troca a
    // ideia de "escanear todo mundo a cada N minutos" por "acordar
    // exatamente este motorista na hora certa". Fire-and-forget: um
    // erro aqui nunca pode atrasar a resposta do registro de ponto.
    void this.agendarProximaVerificacaoSeAplicavel(
      motoristaId,
      registro.timestampEvento,
    );

    return registro;
  }

  /**
   * Processa os eventos de um lote SEQUENCIALMENTE, em ORDEM (nunca em
   * paralelo) , é o que preserva a cadeia de hash: cada `create()`
   * depende do `sequencial`/`hashAnterior` do evento imediatamente
   * anterior do MESMO motorista, então processar dois eventos do mesmo
   * lote ao mesmo tempo produziria uma corrida pelo mesmo "próximo
   * elo" da cadeia (o `Serializable` da transação de `create()` evita
   * corrupção, mas um dos dois simplesmente falharia por conflito de
   * serialização à toa).
   *
   * Um item com erro NUNCA aborta o lote inteiro , o app mobile precisa
   * saber, item por item, o que foi aceito e o que falhou (pra só
   * remover da fila local de sync os que tiveram sucesso) , daí o
   * try/catch por item em vez de deixar a exceção subir.
   */
  async processarLoteSequencial(
    motoristaId: string,
    deviceUuid: string,
    eventos: CreateRegistroJornadaDto[],
    ip?: string,
    userAgent?: string,
  ): Promise<ResultadoItemLote[]> {
    const resultados: ResultadoItemLote[] = [];
    for (let index = 0; index < eventos.length; index++) {
      try {
        const registro = await this.create(
          motoristaId,
          deviceUuid,
          eventos[index],
          ip,
          userAgent,
        );
        resultados.push({ index, sucesso: true, registroId: registro.id });
      } catch (err) {
        resultados.push({
          index,
          sucesso: false,
          erro: (err as Error).message,
        });
      }
    }
    return resultados;
  }

  /**
   * Endpoint de envio em lote (Rodada 66) , pedido do usuário: motorista
   * acumula vários eventos offline e envia tudo de uma vez ao
   * reconectar. A ESCALA ("milhares de envios simultâneos") vem de
   * rotear o processamento pesado pela fila BullMQ (`FILA_LOTE_REGISTROS_JORNADA`)
   * em vez de processar cada requisição HTTP direto na thread da
   * requisição: o worker (`LoteRegistrosJornadaProcessor`) tem
   * concorrência limitada e configurável, então mesmo que milhares de
   * motoristas mandem lote ao mesmo tempo (ex.: todo mundo saindo de
   * uma área sem sinal ao mesmo tempo), o Postgres nunca recebe mais
   * transações simultâneas do que o worker permite , o excesso só
   * espera na fila, sem sobrecarregar o banco.
   *
   * A resposta ainda é SÍNCRONA (o app precisa saber, na hora, o que
   * foi aceito) , aguarda o job terminar (`waitUntilFinished`) com um
   * teto de tempo. Fail-open, mesmo padrão de todo o resto do sistema
   * que depende de Redis: se enfileirar ou esperar falhar (Redis fora
   * do ar, timeout), processa o lote direto aqui mesmo, síncrono,
   * sem fila , mais lento sob carga, mas nunca bloqueia o motorista.
   */
  async processarLote(
    motoristaId: string,
    deviceUuid: string,
    eventos: CreateRegistroJornadaDto[],
    ip?: string,
    userAgent?: string,
  ): Promise<ResultadoItemLote[]> {
    if (!this.filaLote) {
      return this.processarLoteSequencial(
        motoristaId,
        deviceUuid,
        eventos,
        ip,
        userAgent,
      );
    }

    try {
      const job = await this.filaLote.add(
        'processar',
        { motoristaId, deviceUuid, eventos, ip, userAgent },
        { removeOnComplete: true, removeOnFail: 50, attempts: 1 },
      );
      const resultado = (await job.waitUntilFinished(
        this.obterQueueEventsLote(),
        30_000,
      )) as ResultadoItemLote[];
      return resultado;
    } catch (err) {
      this.logger.warn(
        `Falha ao processar lote via fila (motorista ${motoristaId}) , caindo no fallback síncrono: ${(err as Error).message}`,
      );
      return this.processarLoteSequencial(
        motoristaId,
        deviceUuid,
        eventos,
        ip,
        userAgent,
      );
    }
  }

  /**
   * Roda o motor de limites legais (Lei do Motorista + espera em
   * carga/descarga) dentro da mesma transação do registro recém-criado
   * e persiste os alertas calculados. Falha aqui não deve derrubar o
   * registro do ponto em si , é uma camada de aviso, não o ledger.
   */
  private async avaliarLimitesLegais(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
    /** Ver comentário do mesmo parâmetro em `JornadaLegalService.avaliar`. */
    agoraOverride?: Date,
  ): Promise<{ tipo: string; severidade: string; mensagem: string }[]> {
    try {
      const historico = await tx.registroJornada.findMany({
        where: { motoristaId },
        orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
      });

      // Achado real (Rodada 129): a janela de "já alertei esse tipo,
      // não repete" usava `historico[0]` , o PRIMEIRO registro de toda
      // a vida do motorista, não o início da jornada atual. Na prática
      // isso é "desde sempre": depois da primeira vez que um tipo de
      // alerta disparasse (ex.: descanso interjornada insuficiente),
      // esse tipo nunca mais gerava um `AlertaJornada` novo pra esse
      // motorista, em nenhuma jornada futura , mesmo numa violação
      // genuinamente nova, semanas depois. O app, por sua vez, mostra
      // o aviso de descanso insuficiente direto na tela a cada
      // tentativa (`RegistrarPontoScreen.tsx`, Rodada 71) , client-side,
      // sem depender do backend , então parecia "disparou de novo" só
      // que sem nunca aparecer na aba Alertas nem no painel do gestor.
      // Correção: a janela agora começa no início da jornada ATUAL
      // (o `INICIO_JORNADA` mais recente), nunca antes , dedup continua
      // funcionando dentro da mesma jornada, mas uma jornada nova
      // sempre pode gerar o alerta de novo se a violação se repetir.
      const ultimoInicioJornada = [...historico]
        .filter((r) => r.tipoEvento === TipoEvento.INICIO_JORNADA)
        .pop();

      const tiposExistentes = new Set(
        (
          await tx.alertaJornada.findMany({
            where: {
              motoristaId,
              createdAt: {
                gte:
                  ultimoInicioJornada?.timestampEvento ??
                  historico[0]?.timestampEvento ??
                  registroRecemCriado.timestampEvento,
              },
            },
            select: { tipo: true },
          })
        ).map((a) => a.tipo),
      );

      const alertas = this.jornadaLegal.avaliar(
        historico,
        registroRecemCriado,
        tiposExistentes,
        agoraOverride,
      );

      for (const alerta of alertas) {
        await tx.alertaJornada.create({
          data: {
            motoristaId,
            tipo: alerta.tipo,
            severidade: alerta.severidade,
            mensagem: alerta.mensagem,
            janelaInicio: alerta.janelaInicio,
            janelaFim: alerta.janelaFim,
            minutosAcumulados: alerta.minutosAcumulados,
            registroGeradorId: registroRecemCriado.id,
            detalhes: (alerta.detalhes ?? undefined) as Prisma.InputJsonValue,
          },
        });

        await this.audit.registrar({
          actorType: ActorType.SISTEMA,
          acao: `ALERTA_JORNADA_${alerta.tipo}`,
          entidade: 'AlertaJornada',
          entidadeId: registroRecemCriado.id,
          detalhes: {
            severidade: alerta.severidade,
            minutosAcumulados: alerta.minutosAcumulados,
          },
        });
      }
      return alertas;
    } catch (err) {
      // Fail-open: um bug no motor de alertas nunca pode travar o
      // registro do ponto do motorista.
      this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_JORNADA_FALHA_AVALIACAO',
        entidade: 'RegistroJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { erro: (err as Error).message },
      });
      return [];
    }
  }

  /**
   * Verificação PROATIVA dos limites legais (Rodada 19) , chamada
   * periodicamente por `MonitoramentoJornadaAbertaService`, fora de
   * qualquer criação de evento.
   *
   * Achado real: `avaliarLimitesLegais` só rodava dentro da transação
   * de `create()`, acionado por um evento NOVO. Um motorista que
   * simplesmente segue dirigindo sem registrar mais nada no app (sem
   * parar, sem bater nenhum outro evento) nunca disparava o motor ,
   * então "direção contínua de 7h30" passava batido, sem alerta nenhum
   * pro motorista nem pro gestor, mesmo bem acima do limite legal de
   * 05:30. Esta varredura resolve isso: acha todo motorista com jornada
   * aberta (sem `FIM_JORNADA`) e reavalia os mesmos limites com "agora"
   * sendo o horário real da varredura , não mais preso ao timestamp do
   * último evento que o motorista escolheu (ou esqueceu) de registrar.
   *
   * O alerta gerado usa o ÚLTIMO registro real do motorista como
   * `registroGeradorId` (satisfaz a FK obrigatória) , ele não "criou" o
   * alerta agora, mas é o evento que abriu o estado ainda em aberto que
   * a varredura está avaliando.
   */
  /**
   * Rodada 68 , passou a devolver quantas jornadas foram avaliadas
   * (antes era `void`): sem isso, não havia nenhum jeito de confirmar
   * pelo terminal que a varredura de segurança estava realmente
   * rodando , um erro relatado de "alerta não chegou" não tinha como
   * ser diferenciado de "a varredura nunca roda" vs. "rodou, mas não
   * achou nada" só olhando os logs.
   */
  async verificarJornadasAbertasProativamente(): Promise<number> {
    // SISTEMA (RLS , Rodada 23): esta varredura cruza TODOS os grupos
    // de propósito (é o próprio ponto dela, ver Rodada 19/20/21) , não
    // roda dentro de uma requisição HTTP, então não há um
    // TenantContext ambiente sem isto.
    return TenantContext.paraSistema(async () => {
      const jornadasAbertas = await this.prisma.$queryRaw<
        { motoristaId: string }[]
      >(Prisma.sql`
        SELECT ultimo."motoristaId"
        FROM (
          SELECT DISTINCT ON (r."motoristaId") r."motoristaId", r."tipoEvento"
          FROM registros_jornada r
          WHERE r."tipoEvento" != 'OUTRO'
          ORDER BY r."motoristaId", r."timestampEvento" DESC, r.sequencial DESC
        ) ultimo
        WHERE ultimo."tipoEvento" != 'FIM_JORNADA'
      `);

      for (const { motoristaId } of jornadasAbertas) {
        await this.verificarEAgendarProximoMotorista(motoristaId);
      }
      return jornadasAbertas.length;
    });
  }

  /**
   * Reavalia os limites legais de UM motorista agora (com o relógio
   * real, não o do último evento) e, em seguida, agenda o próximo
   * check dele via `VerificacaoJornadaAgendadaService` , ver Rodada 21.
   *
   * Dois chamadores: (1) o job da fila de verificação agendada, que
   * dispara exatamente quando `JornadaLegalService.calcularProximoLimiar`
   * previu o próximo limiar; (2) `verificarJornadasAbertasProativamente`,
   * a varredura periódica de segurança (Rodada 19/20) , que agora, além
   * de servir de rede de segurança contra o job se perder por algum
   * motivo, também tem o efeito colateral de "curar" um motorista sem
   * nenhum job agendado (ex.: dados de antes desta rodada, jornada que
   * já estava aberta quando o deploy aconteceu), reagendando-o pelo
   * caminho novo a partir daí.
   *
   * Fail-open por motorista: um erro aqui é registrado em audit log e
   * NUNCA propagado , nem pra não travar a varredura periódica (que
   * segue pros próximos motoristas do laço), nem pra não derrubar o
   * worker da fila (embora lá o BullMQ ainda tente de novo antes de
   * desistir, por causa do `attempts` padrão da fila).
   */
  async verificarEAgendarProximoMotorista(motoristaId: string): Promise<void> {
    // SISTEMA (RLS , Rodada 23): os dois chamadores (o processor da
    // fila e a varredura periódica, já também em contexto SISTEMA)
    // disparam isto fora de qualquer requisição HTTP. Redundante
    // quando já chamado por dentro de `TenantContext.paraSistema`
    // (aninhar o mesmo contexto não tem efeito nocivo), necessário
    // quando chamado direto pelo processor da fila.
    await TenantContext.paraSistema(async () => {
      try {
        const motorista = await this.prisma.motorista.findUnique({
          where: { id: motoristaId },
        });
        const ultimoRegistro = await this.prisma.registroJornada.findFirst({
          where: { motoristaId },
          orderBy: { sequencial: 'desc' },
        });
        if (!motorista || !ultimoRegistro) return;

        // Rodada 93 , pedido do usuário: "está disparando alertas mesmo
        // com o app estando em fim de jornada". Causa raiz: quando o
        // gestor lança um ajuste (TratamentoPonto) de FIM_JORNADA pelo
        // painel (Rodada 88), o APP reconcilia isso e passa a mostrar
        // "fim de jornada" pro motorista , mas essa é SÓ uma anotação
        // paralela, nunca grava um RegistroJornada de verdade (WORM, de
        // propósito). Esta varredura/job agendado olhava só pro ledger
        // CRU (`registroJornada`), que continuava "aberto" pra sempre
        // (nenhum FIM_JORNADA de verdade ali) , então seguia gerando
        // "tempo indefinido"/"direção excedida" pra uma jornada que, pro
        // motorista e pro gestor, já tinha acabado. Mesmo princípio de
        // reconciliação já usado no app mobile (ver
        // mobile/src/storage/db.ts `maisRecenteEntreLocalEAjuste` ,
        // comparar por `createdAt`, nunca por `timestampEvento`, que é
        // editável pelo gestor): se existe um ajuste de FIM_JORNADA mais
        // recente (por `createdAt`) que o último RegistroJornada real,
        // trata a jornada como encerrada e para por aqui , sem gerar
        // alerta novo, e cancelando qualquer verificação já agendada
        // (mesmo efeito de um FIM_JORNADA de verdade).
        const ajusteFimJornadaMaisRecente =
          await this.prisma.tratamentoPonto.findFirst({
            where: { motoristaId, tipoEvento: TipoEvento.FIM_JORNADA },
            orderBy: { createdAt: 'desc' },
          });
        // Achado real (Rodada 128): a checagem acima, sozinha, comparava
        // só por `createdAt`, sem confirmar que o ajuste se referia à
        // jornada que está aberta AGORA. Cenário real: motorista com uma
        // jornada aberta há muito tempo (dirigindo sem bater mais nada
        // no app, o `ultimoRegistro` continua sendo um evento antigo) e
        // o gestor lança um ajuste de FIM_JORNADA por qualquer outro
        // motivo (corrigindo uma jornada ANTIGA e já encerrada, por
        // exemplo) , como o `createdAt` desse ajuste é "agora" (mais
        // recente que o último registro real, que é antigo), a
        // verificação achava, incorretamente, que a jornada atual tinha
        // sido encerrada, e silenciava o motor de alertas pra esse
        // motorista pra sempre (cancelando o job agendado) , nenhum
        // alerta de estouro aparecia em lugar nenhum, mesmo com o
        // motorista genuinamente em jornada (o painel, que não olha pra
        // ajustes, continuava mostrando "em jornada" corretamente).
        // Correção: só considera o ajuste como encerrando a jornada
        // ATUAL se ele for posterior ao início dela (o `INICIO_JORNADA`
        // mais recente) , um ajuste sobre uma jornada anterior nunca
        // mais silencia a que está aberta agora.
        if (ajusteFimJornadaMaisRecente) {
          const inicioJornadaAtual =
            await this.prisma.registroJornada.findFirst({
              where: { motoristaId, tipoEvento: TipoEvento.INICIO_JORNADA },
              orderBy: { sequencial: 'desc' },
            });
          const ajusteEncerraJornadaAtual =
            ajusteFimJornadaMaisRecente.createdAt > ultimoRegistro.createdAt &&
            (!inicioJornadaAtual ||
              ajusteFimJornadaMaisRecente.timestampEvento >=
                inicioJornadaAtual.timestampEvento);
          if (ajusteEncerraJornadaAtual) {
            await this.verificacaoAgendada?.cancelar(motoristaId);
            return;
          }
        }

        const agora = new Date();
        const alertas = await this.avaliarLimitesLegais(
          this.prisma,
          motoristaId,
          ultimoRegistro,
          agora,
        );

        // Diferente do caminho reativo (que só notifica por push/WhatsApp em
        // CRITICO , o motorista está com o app na mão, vendo o dashboard em
        // tempo real, então ATENCAO só precisa aparecer na tela mesmo),
        // aqui a notificação em ATENCAO também dispara: Rodada 20, a pedido
        // do usuário , "próximo de estourar" e "já estourou" avisam as
        // duas partes, sem esperar o motorista chegar em CRITICO.
        for (const alerta of alertas) {
          if (
            alerta.severidade !== 'CRITICO' &&
            alerta.severidade !== 'ATENCAO'
          )
            continue;
          void this.pushNotifications.notificarMotorista(
            motoristaId,
            'Alerta de jornada',
            alerta.mensagem,
            {
              tipo: alerta.tipo,
            },
          );
          void this.whatsapp.notificarGestoresDaEmpresa(
            motorista.empresaId,
            alerta.mensagem,
          );
        }

        await this.agendarProximaVerificacaoSeAplicavel(motoristaId, agora);
      } catch (err) {
        // Fail-open: um erro num motorista nunca pode travar quem chamou
        // (a varredura periódica dos demais, ou o worker da fila).
        this.audit.registrar({
          actorType: ActorType.SISTEMA,
          acao: 'VERIFICACAO_PROATIVA_JORNADA_FALHA',
          entidade: 'Motorista',
          entidadeId: motoristaId,
          detalhes: { erro: (err as Error).message },
        });
      }
    });
  }

  /**
   * Calcula (via `JornadaLegalService.calcularProximoLimiar`) e agenda
   * o próximo check deste motorista , Rodada 21. Best-effort, fora de
   * qualquer transação (é uma chamada ao Redis, não ao Postgres): tanto
   * o caminho reativo (`create`, logo depois da transação) quanto
   * `verificarEAgendarProximoMotorista` chamam isto pra manter a
   * agenda sempre em dia com o estado mais recente. Quando não há mais
   * nenhum limiar futuro a esperar (nada em aberto, ou os três limites
   * já foram todos cruzados), cancela qualquer job pendente em vez de
   * agendar , não há por que verificar de novo sem um evento novo.
   */
  private async agendarProximaVerificacaoSeAplicavel(
    motoristaId: string,
    agora: Date,
  ): Promise<void> {
    if (!this.verificacaoAgendada) return; // instanciação manual em teste, sem o produtor da fila , comportamento antigo preservado
    try {
      const historico = await this.prisma.registroJornada.findMany({
        where: { motoristaId },
        orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
      });
      const proximo = this.jornadaLegal.calcularProximoLimiar(historico, agora);
      if (proximo) {
        await this.verificacaoAgendada.agendar(motoristaId, proximo.emMs);
      } else {
        await this.verificacaoAgendada.cancelar(motoristaId);
      }
    } catch (err) {
      // Rodada 68 , antes só ia pro audit log (silencioso no
      // terminal). Isso é quase sempre um sintoma de Redis fora do ar
      // (ver BullModule.forRootAsync em app.module.ts): sem o job
      // exato agendado, o motorista só é coberto pela varredura de
      // segurança de 30min (MonitoramentoJornadaAbertaService, que não
      // depende de Redis) , atraso, não ausência total de alerta, mas
      // precisa ficar visível pra quem está rodando localmente.
      this.logger.warn(
        `Falha ao agendar verificação futura do motorista ${motoristaId} (provável Redis indisponível): ${(err as Error).message}`,
      );
      this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'AGENDAMENTO_VERIFICACAO_JORNADA_FALHA',
        entidade: 'Motorista',
        entidadeId: motoristaId,
        detalhes: { erro: (err as Error).message },
      });
    }
  }

  /**
   * Roda o motor de antifraude (AntifraudeService) dentro da mesma
   * transação , mesmo padrão de avaliarLimitesLegais, mesma tabela de
   * alertas, mesmo fail-open (bug aqui nunca derruba o registro do
   * ponto em si).
   */
  private async avaliarAntifraude(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
    horaRecebimentoServidor: Date,
    flagsIntegridadeDispositivo: string[] | undefined,
  ): Promise<{ tipo: string; severidade: string; mensagem: string }[]> {
    try {
      const historico = await tx.registroJornada.findMany({
        where: { motoristaId },
        orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
      });

      const tiposExistentes = new Set(
        (
          await tx.alertaJornada.findMany({
            where: { motoristaId, registroGeradorId: registroRecemCriado.id },
            select: { tipo: true },
          })
        ).map((a) => a.tipo),
      );

      const alertas = this.antifraude.avaliar(
        historico,
        registroRecemCriado,
        horaRecebimentoServidor,
        flagsIntegridadeDispositivo,
        tiposExistentes,
      );

      for (const alerta of alertas) {
        await tx.alertaJornada.create({
          data: {
            motoristaId,
            tipo: alerta.tipo,
            severidade: alerta.severidade,
            mensagem: alerta.mensagem,
            janelaInicio: alerta.janelaInicio,
            janelaFim: alerta.janelaFim,
            minutosAcumulados: alerta.minutosAcumulados,
            registroGeradorId: registroRecemCriado.id,
            detalhes: (alerta.detalhes ?? undefined) as Prisma.InputJsonValue,
          },
        });

        await this.audit.registrar({
          actorType: ActorType.SISTEMA,
          acao: `ALERTA_ANTIFRAUDE_${alerta.tipo}`,
          entidade: 'AlertaJornada',
          entidadeId: registroRecemCriado.id,
          detalhes: { severidade: alerta.severidade, ...alerta.detalhes },
        });
      }
      return alertas;
    } catch (err) {
      // Fail-open: um bug no motor de antifraude nunca pode travar o
      // registro do ponto do motorista.
      this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_ANTIFRAUDE_FALHA_AVALIACAO',
        entidade: 'RegistroJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { erro: (err as Error).message },
      });
      return [];
    }
  }

  /**
   * Direção simétrica de `FolgaConcedidaService.conceder`: lá, o RH
   * concede folga num dia que já tinha ponto batido; aqui, o motorista
   * bate um ponto num dia que já tinha folga concedida antes. Os dois
   * casos terminam no mesmo lugar , nunca apaga/altera nada (impossível
   * de qualquer forma), só levanta um AlertaJornada pra conferência.
   * Mesmo padrão fail-open das outras duas avaliações.
   */
  private async avaliarFolgaConflitante(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
  ): Promise<{ tipo: string; severidade: string; mensagem: string }[]> {
    try {
      // Rodada 144: o dia da folga é o dia civil de Brasília do ponto
      // (antes era o dia UTC, errado entre 21h e 24h BRT). `data` da
      // folga continua sendo meia-noite UTC do dia civil.
      // Rodada 147: dia civil no fuso do motorista no toque.
      const offsetDoPonto = registroRecemCriado.fusoOffsetMin ?? -180;
      const dia = new Date(
        `${chaveDiaBrt(registroRecemCriado.timestampEvento, offsetDoPonto)}T00:00:00.000Z`,
      );

      const folgaDoDia = await tx.folgaConcedida.findUnique({
        where: { motoristaId_data: { motoristaId, data: dia } },
      });
      if (!folgaDoDia) return [];

      const diaFormatado = dia.toISOString().slice(0, 10);
      const mensagem = `Ponto batido em ${diaFormatado}, dia que já tinha folga concedida , confira o conflito.`;

      await tx.alertaJornada.create({
        data: {
          motoristaId,
          tipo: TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
          severidade: SeveridadeAlerta.ATENCAO,
          mensagem,
          janelaInicio: new Date(dia.getTime() - offsetDoPonto * 60_000),
          janelaFim: new Date(
            dia.getTime() - offsetDoPonto * 60_000 + 24 * 60 * 60 * 1000,
          ),
          minutosAcumulados: 0,
          registroGeradorId: registroRecemCriado.id,
          detalhes: {
            folgaConcedidaId: folgaDoDia.id,
          } as Prisma.InputJsonValue,
        },
      });

      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_JORNADA_PONTO_REGISTRADO_EM_DIA_DE_FOLGA',
        entidade: 'AlertaJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { motoristaId, folgaConcedidaId: folgaDoDia.id },
      });

      return [
        {
          tipo: TipoAlertaJornada.PONTO_REGISTRADO_EM_DIA_DE_FOLGA,
          severidade: SeveridadeAlerta.ATENCAO,
          mensagem,
        },
      ];
    } catch (err) {
      // Fail-open: um bug aqui nunca pode travar o registro do ponto em si.
      this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_JORNADA_FOLGA_FALHA_AVALIACAO',
        entidade: 'RegistroJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { erro: (err as Error).message },
      });
      return [];
    }
  }

  /**
   * "Fim de descarregamento" = uma entrega concluída. Desfaz o vínculo
   * ativo (statusCarga CARREGADO -> VAZIO) do CT-e mais antigo ainda em
   * aberto vinculado a este motorista , FIFO, já que cada CT-e é
   * praticamente uma entrega e a ordem de descarregamento normalmente
   * segue a ordem de carregamento. O motoristaId do documento é
   * MANTIDO (histórico de quem entregou); só o status muda. MDF-e não
   * entra aqui (é o manifesto da viagem inteira, não uma entrega
   * individual). Mesma transação do registro, mas com try/catch
   * próprio , fail-open, igual aos outros avaliadores desta classe: um
   * bug aqui nunca pode travar o registro do ponto em si.
   */
  // Rodada 72 , pedido do usuário: "ao identificar o início de direção
  // sem CT-e vinculado ou emitido a pouco tempo o sistema entende que
  // o motorista está rodando vazio... busca por CT-e em aberto, se
  // houver envia notificação ao gestor e uma msg pelo WhatsApp".
  // Threshold de "vinculado/emitido a pouco tempo": um CT-e recém
  // subido/vinculado a este motorista justifica a direção que está
  // começando agora (foi carregado, vai rodar com carga) , passado
  // esse tempo sem nenhum CT-e novo, não conta mais como "recente".
  private readonly JANELA_CTE_RECENTE_MS = 120 * 60 * 1000; // 2h

  /**
   * Só CRIA o alerta (dentro da mesma transação de `create()`, sem
   * I/O de rede) e devolve a mensagem pronta pro WhatsApp , quem
   * dispara o envio de fato é o próprio `create()`, DEPOIS da
   * transação comitar (mesmo motivo dos outros dois envios: I/O não
   * deve segurar o lock do Postgres). `null` quando não há nada a
   * avisar (motorista realmente rodando vazio sem nenhum CT-e
   * pendente, ou já tem CT-e recente o suficiente pra justificar a
   * direção).
   */
  private async avaliarCteAbertoSemVinculoRecente(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
  ): Promise<string | null> {
    if (registroRecemCriado.tipoEvento !== 'INICIO_DIRECAO') return null;
    try {
      const desde = new Date(
        registroRecemCriado.timestampEvento.getTime() -
          this.JANELA_CTE_RECENTE_MS,
      );
      const cteRecente = await tx.documentoCarga.findFirst({
        where: { motoristaId, tipo: 'CTE', createdAt: { gte: desde } },
        select: { id: true },
      });
      // Já tem CT-e vinculado/emitido há pouco tempo , direção com
      // carga recém-associada, comportamento esperado, nada a avisar.
      if (cteRecente) return null;

      const cteAberto = await tx.documentoCarga.findFirst({
        where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, numero: true, chaveAcesso: true, createdAt: true },
      });
      // Sem CT-e recente E sem nenhum CT-e em aberto: motorista está
      // mesmo rodando vazio (deslocamento sem carga) , situação
      // normal, não é alerta.
      if (!cteAberto) return null;

      // Dedup: não repete o aviso a cada novo "Início de direção"
      // enquanto o MESMO CT-e continuar pendente , usa `janelaInicio`
      // (setado abaixo como o `createdAt` do próprio CT-e) como chave
      // de identidade do documento, sem precisar de query em campo
      // JSON.
      const jaAlertado = await tx.alertaJornada.findFirst({
        where: {
          motoristaId,
          tipo: TipoAlertaJornada.CTE_EM_ABERTO_SEM_VINCULO_RECENTE,
          janelaInicio: cteAberto.createdAt,
        },
        select: { id: true },
      });
      if (jaAlertado) return null;

      const mensagem =
        `Motorista iniciou direção sem nenhum CT-e vinculado/emitido nas últimas ` +
        `${Math.round(this.JANELA_CTE_RECENTE_MS / 60000)} minutos, mas ainda existe um CT-e em aberto` +
        `${cteAberto.numero ? ` (nº ${cteAberto.numero})` : ''}, vinculado desde ${marcarHorario(cteAberto.createdAt)} ` +
        `e ainda sem "Fim de descarregamento" registrado. Confira se essa entrega já foi feita e só não foi baixada no ` +
        `sistema, ou se o motorista está rodando vazio por outro motivo.`;

      const alerta = await tx.alertaJornada.create({
        data: {
          motoristaId,
          tipo: TipoAlertaJornada.CTE_EM_ABERTO_SEM_VINCULO_RECENTE,
          severidade: SeveridadeAlerta.ATENCAO,
          mensagem,
          janelaInicio: cteAberto.createdAt,
          janelaFim: registroRecemCriado.timestampEvento,
          minutosAcumulados: 0,
          registroGeradorId: registroRecemCriado.id,
          detalhes: {
            documentoCargaId: cteAberto.id,
            numero: cteAberto.numero,
            chaveAcesso: cteAberto.chaveAcesso,
          } as Prisma.InputJsonValue,
        },
      });

      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'ALERTA_JORNADA_CTE_EM_ABERTO_SEM_VINCULO_RECENTE',
        entidade: 'AlertaJornada',
        entidadeId: alerta.id,
        detalhes: { motoristaId, documentoCargaId: cteAberto.id },
      });

      return mensagem;
    } catch (err) {
      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'CTE_EM_ABERTO_SEM_VINCULO_RECENTE_FALHA_AVALIACAO',
        entidade: 'RegistroJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { erro: (err as Error).message },
      });
      return null;
    }
  }

  private async avaliarDescarregamento(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
  ): Promise<void> {
    if (registroRecemCriado.tipoEvento !== 'FIM_DESCARREGAMENTO') return;
    try {
      const documento = await tx.documentoCarga.findFirst({
        where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
        orderBy: { createdAt: 'asc' },
      });
      // Nenhum CT-e em aberto pra este motorista agora , não é erro,
      // só não tinha o que desvincular (ex.: motorista bateu o evento
      // sem o gestor ter subido/vinculado o CT-e ainda).
      if (!documento) return;

      await tx.documentoCarga.update({
        where: { id: documento.id },
        data: {
          statusCarga: 'VAZIO',
          entregueEm: registroRecemCriado.timestampEvento,
        },
      });

      await this.audit.registrar({
        actorType: ActorType.MOTORISTA,
        actorId: motoristaId,
        acao: 'DOCUMENTO_CARGA_ENTREGUE',
        entidade: 'DocumentoCarga',
        entidadeId: documento.id,
        detalhes: {
          registroJornadaId: registroRecemCriado.id,
          numero: documento.numero,
          chaveAcesso: documento.chaveAcesso,
        },
      });

      // Cerca virtual: compara a posição do registro com as coordenadas
      // do destinatário (geocodificadas na hora do upload do CT-e).
      // Método próprio, mesmo try/catch fail-open de sempre , um erro
      // aqui nunca desfaz o desvínculo do CT-e que acabou de acontecer.
      await this.avaliarCercaVirtualEntrega(
        tx,
        motoristaId,
        registroRecemCriado,
        documento,
      );
    } catch (err) {
      this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'DOCUMENTO_CARGA_ENTREGA_FALHA_AVALIACAO',
        entidade: 'RegistroJornada',
        entidadeId: registroRecemCriado.id,
        detalhes: { erro: (err as Error).message },
      });
    }
  }

  /**
   * Cerca virtual (geofence) da entrega: se o CT-e desvinculado tem
   * coordenadas do destinatário (geocodificadas automaticamente a
   * partir do endereço do XML , ver GeocodingService e
   * DocumentosCargaService.upload) e o registro de "Fim de
   * descarregamento" tem GPS do aparelho, compara os dois. Mais de
   * `RAIO_CERCA_VIRTUAL_M` de distância gera um AlertaJornada
   * (ATENCAO, nunca bloqueia) pro gestor conferir.
   *
   * Fail-open em dois níveis: se faltar qualquer uma das duas
   * coordenadas (documento sem geocodificação bem-sucedida, ou
   * registro sem GPS , ex.: motoristra sem permissão de localização),
   * simplesmente não avalia nada, sem erro. E o próprio caller
   * (avaliarDescarregamento) já embrulha esta chamada num try/catch que
   * nunca deixa um bug aqui derrubar o registro do ponto.
   *
   * `detalhes.fontePosicao` documenta explicitamente que a posição
   * usada hoje é sempre o GPS do próprio aparelho (`GPS_APARELHO`) ,
   * é o gancho pra, no futuro, comparar ou combinar com a posição
   * triangulada por um rastreador veicular vinculado (ver
   * VeiculoVinculado.idRastreador/tecnologiaRastreador) sem precisar
   * de outro redesenho de schema: bastaria resolver uma posição a
   * partir do rastreador aqui e marcar a fonte como
   * `RASTREADOR_VEICULAR` (ou combinar as duas, se um dia fizer
   * sentido triangular as duas fontes pra mais segurança).
   */
  private async avaliarCercaVirtualEntrega(
    tx: Prisma.TransactionClient,
    motoristaId: string,
    registroRecemCriado: RegistroJornada,
    documento: {
      id: string;
      numero: string | null;
      chaveAcesso: string | null;
      destinatarioLatitude: Prisma.Decimal | null;
      destinatarioLongitude: Prisma.Decimal | null;
    },
  ): Promise<void> {
    const RAIO_CERCA_VIRTUAL_M = 500;

    if (
      documento.destinatarioLatitude == null ||
      documento.destinatarioLongitude == null
    )
      return;
    if (
      registroRecemCriado.latitude == null ||
      registroRecemCriado.longitude == null
    )
      return;

    const distanciaM = this.distanciaHaversineMetros(
      Number(registroRecemCriado.latitude),
      Number(registroRecemCriado.longitude),
      Number(documento.destinatarioLatitude),
      Number(documento.destinatarioLongitude),
    );
    if (distanciaM <= RAIO_CERCA_VIRTUAL_M) return;

    const mensagem =
      `"Fim de descarregamento" registrado a ${Math.round(distanciaM)}m do endereço do destinatário ` +
      `${documento.numero ? `(CT-e ${documento.numero})` : 'do CT-e'} , fora da cerca virtual de ${RAIO_CERCA_VIRTUAL_M}m. ` +
      `Confira se a entrega foi mesmo nesse endereço.`;

    await tx.alertaJornada.create({
      data: {
        motoristaId,
        tipo: TipoAlertaJornada.ENTREGA_FORA_DA_CERCA_VIRTUAL,
        severidade: SeveridadeAlerta.ATENCAO,
        mensagem,
        janelaInicio: registroRecemCriado.timestampEvento,
        janelaFim: registroRecemCriado.timestampEvento,
        minutosAcumulados: 0,
        registroGeradorId: registroRecemCriado.id,
        detalhes: {
          documentoCargaId: documento.id,
          numero: documento.numero,
          chaveAcesso: documento.chaveAcesso,
          distanciaMetros: Math.round(distanciaM),
          raioCercaVirtualM: RAIO_CERCA_VIRTUAL_M,
          fontePosicao: 'GPS_APARELHO',
        } as Prisma.InputJsonValue,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.SISTEMA,
      acao: 'ALERTA_JORNADA_ENTREGA_FORA_DA_CERCA_VIRTUAL',
      entidade: 'AlertaJornada',
      entidadeId: registroRecemCriado.id,
      detalhes: {
        motoristaId,
        documentoCargaId: documento.id,
        distanciaMetros: Math.round(distanciaM),
      },
    });
  }

  /** Distância aproximada (fórmula de Haversine) entre duas coordenadas, em metros. */
  private distanciaHaversineMetros(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const RAIO_TERRA_M = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Confere, antes de qualquer leitura, que o motorista pertence ao grupo de quem está pedindo. */
  private async conferirTenant(
    motoristaId: string,
    grupoIdSolicitante: string,
  ): Promise<void> {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
  }

  /**
   * Consolidação em "Viagem": o que agrupa jornadas diárias na mesma
   * viagem NÃO é mais um intervalo de tempo entre elas , o motorista
   * está sempre "viajando"; o que separa uma viagem da outra é o(s)
   * CT-e(s) que ele carrega (Rodada 16, substitui o agrupamento por
   * gap de 36h da Rodada 2). Regras, confirmadas com o usuário:
   * - Uma viagem começa quando o 1º CT-e é vinculado ao motorista
   *   (upload) e só termina quando TODOS os CT-e daquele grupo forem
   *   entregues ("Fim de descarregamento" , `DocumentoCarga.entregueEm`).
   * - Um CT-e vinculado enquanto ainda há algum do grupo em aberto
   *   entra na MESMA viagem , por isso a mesclagem de intervalos de
   *   cobertura abaixo: intervalos [vínculo, entrega] que se
   *   sobrepõem (ou um deles ainda está em aberto) viram um único
   *   grupo, por menor que seja a chance de dois CT-e não se
   *   relacionarem de verdade.
   * - Uma jornada que não cai dentro da cobertura de nenhum CT-e vira
   *   sua própria viagem, avulsa (1 jornada = 1 viagem) , não se
   *   agrupa com jornadas vizinhas por tempo.
   * MDF-e nunca entra nessa conta (é o manifesto da viagem inteira,
   * não uma entrega individual , mesmo critério já usado no FIFO de
   * desvínculo da Rodada 14). É um relatório computado (não persiste
   * em nenhuma tabela nova) , sempre reflete o ledger e os documentos
   * na hora em que é consultado.
   */
  async consolidarViagens(motoristaId: string, grupoIdSolicitante: string) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);

    const registros = await this.prisma.registroJornada.findMany({
      where: { motoristaId },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
    });
    if (registros.length === 0) return [];

    const gruposDiarios: RegistroJornada[][] = [];
    let grupoAtual: RegistroJornada[] = [];
    for (const r of registros) {
      if (r.tipoEvento === 'INICIO_JORNADA' && grupoAtual.length > 0) {
        gruposDiarios.push(grupoAtual);
        grupoAtual = [];
      }
      grupoAtual.push(r);
    }
    if (grupoAtual.length > 0) gruposDiarios.push(grupoAtual);

    const jornadas = gruposDiarios.map((grupo) =>
      this.resumirJornadaDiaria(grupo),
    );

    const documentosCte = await this.prisma.documentoCarga.findMany({
      where: { motoristaId, tipo: 'CTE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, numero: true, createdAt: true, entregueEm: true },
    });

    // Passo 1: mescla os intervalos de cobertura dos CT-e (vínculo →
    // entrega, ou "sem fim" se ainda não entregue) em grupos disjuntos.
    // Como já vêm ordenados por vínculo, um único passo com o "fim de
    // cobertura corrido até agora" (Infinity enquanto algum CT-e do
    // grupo segue em aberto) resolve a mesclagem.
    interface DocCte {
      id: string;
      numero: string | null;
      createdAt: Date;
      entregueEm: Date | null;
    }
    const gruposCteBrutos: DocCte[][] = [];
    let coberturaFimMs = -Infinity;
    for (const doc of documentosCte) {
      const docFimMs = doc.entregueEm ? doc.entregueEm.getTime() : Infinity;
      if (
        gruposCteBrutos.length > 0 &&
        doc.createdAt.getTime() <= coberturaFimMs
      ) {
        gruposCteBrutos[gruposCteBrutos.length - 1].push(doc);
      } else {
        gruposCteBrutos.push([doc]);
      }
      coberturaFimMs = Math.max(coberturaFimMs, docFimMs);
    }

    interface GrupoCte {
      inicio: Date;
      fim: Date | null; // null = ainda em aberto (algum CT-e do grupo não entregue)
      docs: { id: string; numero: string | null }[];
    }
    const gruposCte: GrupoCte[] = gruposCteBrutos.map((docs) => {
      const algumAberto = docs.some((d) => d.entregueEm === null);
      const fim = algumAberto
        ? null
        : new Date(Math.max(...docs.map((d) => d.entregueEm!.getTime())));
      return {
        inicio: docs[0].createdAt,
        fim,
        docs: docs.map((d) => ({ id: d.id, numero: d.numero })),
      };
    });

    // Passo 2: cada jornada entra no grupo de CT-e cuja cobertura ela
    // sobrepõe (no máximo um, já que os grupos são disjuntos por
    // construção); quem não sobrepõe nenhum vira viagem avulsa.
    const sobrepoe = (jornada: JornadaResumo, grupo: GrupoCte) => {
      const fimGrupoMs = grupo.fim ? grupo.fim.getTime() : Infinity;
      return (
        jornada.inicio.getTime() <= fimGrupoMs &&
        jornada.fim.getTime() >= grupo.inicio.getTime()
      );
    };

    const jornadaParaGrupo = new Map<JornadaResumo, GrupoCte>();
    for (const grupo of gruposCte) {
      for (const jornada of jornadas) {
        if (!jornadaParaGrupo.has(jornada) && sobrepoe(jornada, grupo)) {
          jornadaParaGrupo.set(jornada, grupo);
        }
      }
    }

    const jornadasPorGrupo = new Map<GrupoCte, JornadaResumo[]>();
    for (const jornada of jornadas) {
      const grupo = jornadaParaGrupo.get(jornada);
      if (!grupo) continue;
      if (!jornadasPorGrupo.has(grupo)) jornadasPorGrupo.set(grupo, []);
      jornadasPorGrupo.get(grupo)!.push(jornada);
    }

    const viagens: ViagemConsolidada[] = [];
    for (const [grupo, jornadasDoGrupo] of jornadasPorGrupo) {
      jornadasDoGrupo.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
      const primeira = jornadasDoGrupo[0];
      const ultima = jornadasDoGrupo[jornadasDoGrupo.length - 1];
      viagens.push({
        inicio: primeira.inicio,
        fim: ultima.fim,
        diasCorridos: 0,
        // Em andamento se a última jornada ainda não fechou OU se o
        // grupo de CT-e ainda tem alguma entrega pendente , uma
        // viagem pode estar "em aberto" mesmo com o motorista
        // descansando entre jornadas, esperando a próxima entrega.
        emAndamento: ultima.emAndamento || grupo.fim === null,
        jornadas: jornadasDoGrupo,
        totalDirecaoMin: jornadasDoGrupo.reduce(
          (soma, j) => soma + j.totalDirecaoMin,
          0,
        ),
        totalEsperaMin: jornadasDoGrupo.reduce(
          (soma, j) => soma + j.totalEsperaMin,
          0,
        ),
        totalJornadaMin: jornadasDoGrupo.reduce(
          (soma, j) => soma + j.totalJornadaMin,
          0,
        ),
        ctesRelacionados: grupo.docs,
      });
    }
    for (const jornada of jornadas) {
      if (jornadaParaGrupo.has(jornada)) continue;
      viagens.push({
        inicio: jornada.inicio,
        fim: jornada.fim,
        diasCorridos: 0,
        emAndamento: jornada.emAndamento,
        jornadas: [jornada],
        totalDirecaoMin: jornada.totalDirecaoMin,
        totalEsperaMin: jornada.totalEsperaMin,
        totalJornadaMin: jornada.totalJornadaMin,
        ctesRelacionados: [],
      });
    }

    viagens.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    for (const viagem of viagens) {
      const msPorDia = 24 * 60 * 60 * 1000;
      viagem.diasCorridos = Math.max(
        1,
        Math.ceil((viagem.fim.getTime() - viagem.inicio.getTime()) / msPorDia),
      );
    }

    return viagens.reverse(); // mais recente primeiro
  }

  private resumirJornadaDiaria(grupo: RegistroJornada[]) {
    const inicio = grupo[0].timestampEvento;
    const ultimoRegistro = grupo[grupo.length - 1];
    const emAndamento = ultimoRegistro.tipoEvento !== 'FIM_JORNADA';
    const fim = ultimoRegistro.timestampEvento;

    const direcaoMin = this.somarIntervalosSimples(
      grupo,
      'INICIO_DIRECAO',
      ['FIM_DIRECAO'],
      fim,
    );
    // FIM_DESCARREGAMENTO fecha a espera igual FIM_ESPERA_CARGA_DESCARGA
    // (mesma espera legal, só sinaliza adicionalmente que foi entrega).
    const esperaMin = this.somarIntervalosSimples(
      grupo,
      'ESPERA_CARGA_DESCARGA',
      ['FIM_ESPERA_CARGA_DESCARGA', 'FIM_DESCARREGAMENTO'],
      fim,
    );

    return {
      inicio,
      fim,
      emAndamento,
      totalDirecaoMin: Math.round(direcaoMin),
      totalEsperaMin: Math.round(esperaMin),
      totalJornadaMin: Math.round((fim.getTime() - inicio.getTime()) / 60000),
    };
  }

  /** Soma minutos entre pares tipoInicio→tipoFim dentro de um grupo de registros já ordenados. */
  private somarIntervalosSimples(
    registros: RegistroJornada[],
    tipoInicio: string,
    tiposFim: string[],
    fimAbertoFallback: Date,
  ): number {
    const valoresFim = new Set(tiposFim);
    let totalMin = 0;
    let aberto: Date | null = null;
    for (const r of registros) {
      if (r.tipoEvento === tipoInicio) {
        aberto = r.timestampEvento;
      } else if (valoresFim.has(r.tipoEvento) && aberto) {
        totalMin += (r.timestampEvento.getTime() - aberto.getTime()) / 60000;
        aberto = null;
      }
    }
    if (aberto)
      totalMin += (fimAbertoFallback.getTime() - aberto.getTime()) / 60000;
    return totalMin;
  }

  async listByMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);
    return this.prisma.registroJornada.findMany({
      where: { motoristaId },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
    });
  }

  /**
   * Rodada 141 , o app do motorista (aparelho novo, ou consulta de uma
   * data específica no Histórico) busca os registros que o servidor já
   * tem dele. Só os campos que o app guarda localmente; `idLocal` é o
   * idempotencyKey que o próprio app gerou no toque. Padrão: últimos 30
   * dias (mesma retenção do histórico local).
   */
  async listarParaDispositivo(motoristaId: string, inicio?: Date, fim?: Date) {
    const desde = inicio ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const registros = await this.prisma.registroJornada.findMany({
      where: {
        motoristaId,
        timestampEvento: { gte: desde, ...(fim ? { lte: fim } : {}) },
      },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
      take: 1000,
    });
    return registros.map((r) => ({
      idLocal: r.idempotencyKey ?? r.id,
      tipoEvento: r.tipoEvento,
      timestampEvento: r.timestampEvento.toISOString(),
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      precisaoGpsM: r.precisaoGpsM ?? null,
      observacao: r.observacao ?? null,
      fusoOffsetMin: r.fusoOffsetMin ?? null,
      criadoEm: r.createdAt.toISOString(),
    }));
  }

  /**
   * Um único registro pelo idempotencyKey que o app gerou no momento do
   * toque (é o mesmo identificador guardado localmente no SQLite do
   * celular, então o app não precisa saber o id interno do backend pra
   * pedir o comprovante de UM evento específico). Confere que o
   * registro é mesmo deste motorista antes de devolver , mesmo vindo
   * autenticado por device binding, não custa checar.
   */
  async buscarPorIdempotencyKey(
    motoristaId: string,
    idempotencyKey: string,
  ): Promise<RegistroJornada> {
    const registro = await this.prisma.registroJornada.findUnique({
      where: { idempotencyKey },
    });
    if (!registro || registro.motoristaId !== motoristaId) {
      throw new NotFoundException('Registro não encontrado');
    }
    return registro;
  }

  /** Usado pela geração de comprovante (painel e app) , período opcional, senão pega tudo. */
  listByMotoristaNoPeriodo(
    motoristaId: string,
    inicio?: Date,
    fim?: Date,
    /** Rodada 146: fuso da empresa (min) que define o dia civil do período "só data". */
    offsetEmpresaMin?: number,
  ) {
    return this.prisma.registroJornada.findMany({
      where: {
        motoristaId,
        ...(inicio || fim
          ? {
              timestampEvento: {
                // Rodada 144: "só data" (meia-noite UTC) = dia civil BRT.
                ...(inicio
                  ? { gte: inicioDePeriodoBrt(inicio, offsetEmpresaMin) }
                  : {}),
                ...(fim
                  ? { lte: fimDePeriodoBrt(fim, offsetEmpresaMin) }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [{ timestampEvento: 'asc' }, { sequencial: 'asc' }],
    });
  }

  /**
   * Verificação de integridade: recalcula toda a cadeia de hashes e
   * confere a assinatura digital de cada evento contra o fingerprint
   * do certificado do motorista. Use isto em auditorias, antes de
   * fechar a folha de ponto do mês, ou sob suspeita de adulteração.
   */
  /**
   * Explicação em linguagem de produção (nunca cita número de rodada,
   * nome de arquivo ou detalhe de implementação) pra cada motivo de
   * quebra que `HashChainService.verificarCadeia` pode devolver , pedido
   * do usuário: "em produção... não pode usar o mesmo texto tem que
   * trazer o motivo mais aceito". O texto interno (`motivo`, vindo do
   * hash-chain) continua existindo pra auditoria/depuração técnica; este
   * método só traduz pra uma explicação que faz sentido pra quem não
   * programou o sistema.
   */
  private explicarDivergencia(motivo: string, temGps: boolean): string {
    if (motivo.includes('hashAtual')) {
      if (temGps) {
        return (
          'Causa mais provável: evento com localização GPS registrada. ' +
          'Eventos desse tipo lançados há mais tempo podem ter ficado ' +
          'marcados por uma limitação já corrigida no cálculo da ' +
          'verificação de integridade para coordenadas de GPS , isso NÃO ' +
          'significa, necessariamente, que o conteúdo do evento foi ' +
          'alterado. Revise o evento (data, tipo e local) e, se o ' +
          'conteúdo bater com o que foi realmente registrado, você pode ' +
          'aceitar/regularizar esta divergência abaixo.'
        );
      }
      return (
        'Este evento não tem localização GPS registrada, então foge do ' +
        'padrão mais comum de falso positivo. Antes de aceitar, confira ' +
        'com atenção se o conteúdo deste evento (data, hora, tipo) ' +
        'corresponde exatamente ao que foi de fato registrado.'
      );
    }
    return (
      'A ordem da cadeia de eventos deste motorista está diferente do ' +
      'esperado neste ponto , confira se não há eventos fora de ordem ' +
      'ou algum registro ausente antes de aceitar/regularizar.'
    );
  }

  async verificarIntegridade(
    motoristaId: string,
    actorId: string | undefined,
    grupoIdSolicitante: string,
  ) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const registros = await this.prisma.registroJornada.findMany({
      where: { motoristaId },
      orderBy: { sequencial: 'asc' },
    });

    const resultadoCadeia = this.hashChain.verificarCadeia(
      motorista.hashGenesis,
      registros,
    );

    const pfxDecifrado = this.crypto.decrypt(
      Buffer.from(motorista.certificadoPfxEnc as Buffer),
      motorista.certificadoIv!,
      motorista.certificadoAuthTag!,
      motorista.id,
    );
    const { certificadoPem, fingerprint } = this.certificados.decodificar(
      motorista.id,
      pfxDecifrado,
    );

    const fingerprintOk = fingerprint === motorista.certificadoFingerprint;
    const assinaturasInvalidas: number[] = [];
    for (const registro of registros) {
      if (!registro.assinaturaDigital) {
        assinaturasInvalidas.push(registro.sequencial);
        continue;
      }
      const ok = this.assinaturas.verificar(
        certificadoPem,
        registro.hashAtual,
        registro.assinaturaDigital,
      );
      if (!ok) assinaturasInvalidas.push(registro.sequencial);
    }

    // Pedido do usuário: "se quebrou uma vez... fica ali pra sempre, não
    // tem como ignorar ele pra regularizar" , divergências já aceitas
    // (ver `aceitarDivergenciaIntegridade`) saem da lista de problemas
    // em aberto, mas continuam documentadas (nunca somem do relatório).
    const aceites = await this.prisma.integridadeAceite.findMany({
      where: { motoristaId },
      include: { aceitoPorUsuario: { select: { nome: true } } },
    });
    const aceitePorSequencial = new Map(aceites.map((a) => [a.sequencial, a]));

    const divergencias = resultadoCadeia.quebras.map((quebra) => {
      const evento = registros.find((r) => r.sequencial === quebra.sequencial);
      const temGps =
        !!evento && evento.latitude !== null && evento.longitude !== null;
      const aceite = aceitePorSequencial.get(quebra.sequencial);
      return {
        sequencial: quebra.sequencial,
        motivoTecnico: quebra.motivo,
        explicacao: this.explicarDivergencia(quebra.motivo, temGps),
        tipoEvento: evento?.tipoEvento ?? null,
        timestampEvento: evento?.timestampEvento ?? null,
        criadoEm: evento?.createdAt ?? null,
        temGps,
        aceita: !!aceite,
        aceite: aceite
          ? {
              motivo: aceite.motivo,
              aceitoPorNome: aceite.aceitoPorUsuario.nome,
              aceitoEm: aceite.aceitoEm,
            }
          : null,
      };
    });
    const divergenciasPendentes = divergencias.filter((d) => !d.aceita);

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'VERIFICACAO_INTEGRIDADE_CADEIA',
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: {
        cadeiaValida: resultadoCadeia.valido,
        divergenciasPendentes: divergenciasPendentes.length,
      },
    });

    return {
      motoristaId,
      // "cadeiaValida" reflete só o cálculo cru (sem considerar aceites ,
      // mantido pra não mudar o significado de um campo já existente);
      // quem decide se há PROBLEMA EM ABERTO de verdade é `integro`
      // abaixo, que já desconta o que foi aceito/regularizado.
      cadeiaValida: resultadoCadeia.valido,
      motivoCadeia: resultadoCadeia.motivo,
      primeiraQuebraSequencial: resultadoCadeia.primeiraQuebraSequencial,
      divergencias,
      totalRegistros: resultadoCadeia.totalRegistros,
      certificadoFingerprintOk: fingerprintOk,
      assinaturasInvalidas,
      integro:
        divergenciasPendentes.length === 0 &&
        fingerprintOk &&
        assinaturasInvalidas.length === 0,
    };
  }

  /**
   * Aceita/regulariza UMA divergência específica (um `sequencial`) da
   * verificação de integridade , pedido do usuário: "não tem como
   * ignorar ele para regularizar ou iniciar novamente a integridade
   * normal ou aceita". Nunca apaga nem recalcula hash (o WORM da cadeia
   * continua intocado) , só registra, com motivo e autoria carimbados,
   * que o RH/gestor já revisou aquela divergência específica e decidiu
   * aceitá-la. A partir daí, `verificarIntegridade` para de contar este
   * `sequencial` como problema em aberto (mas continua mostrando ele na
   * lista, marcado como aceito).
   */
  async aceitarDivergenciaIntegridade(
    motoristaId: string,
    sequencial: number,
    motivo: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);
    if (!motivo?.trim()) {
      throw new BadRequestException(
        'Informe o motivo da regularização , fica registrado no histórico de quem aceitou e por quê.',
      );
    }

    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    // Confere de novo, agora, que este sequencial REALMENTE está
    // divergente , evita aceitar um evento que nunca teve problema (ou
    // que já foi resolvido de outra forma).
    const registros = await this.prisma.registroJornada.findMany({
      where: { motoristaId },
      orderBy: { sequencial: 'asc' },
    });
    const resultadoCadeia = this.hashChain.verificarCadeia(
      motorista.hashGenesis,
      registros,
    );
    const divergente = resultadoCadeia.quebras.some(
      (q) => q.sequencial === sequencial,
    );
    if (!divergente) {
      throw new BadRequestException(
        'Este evento não está com nenhuma divergência pendente na verificação de integridade.',
      );
    }

    let aceite;
    try {
      aceite = await this.prisma.integridadeAceite.create({
        data: {
          motoristaId,
          sequencial,
          motivo: motivo.trim(),
          aceitoPorUsuarioId: usuarioId,
        },
        include: { aceitoPorUsuario: { select: { nome: true } } },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Esta divergência já foi aceita/regularizada antes.',
        );
      }
      throw err;
    }

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'INTEGRIDADE_DIVERGENCIA_ACEITA',
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: { sequencial, motivo: motivo.trim() },
    });

    return aceite;
  }

  /**
   * Arredonda pra 7 casas decimais , a mesma escala da coluna
   * `Decimal(10, 7)` de latitude/longitude. Precisa ser chamado ANTES
   * de calcular o hash de um novo registro (ver `criar()`), pra que o
   * valor usado no hash seja idêntico ao que o Postgres vai gravar de
   * fato (senão a verificação de integridade quebra depois, sem
   * nenhuma adulteração real ter ocorrido , bug corrigido nesta
   * rodada).
   */
  private arredondarCoordenada(
    valor: number | undefined | null,
  ): number | null {
    if (valor === undefined || valor === null) return null;
    return Math.round(valor * 1e7) / 1e7;
  }
}
