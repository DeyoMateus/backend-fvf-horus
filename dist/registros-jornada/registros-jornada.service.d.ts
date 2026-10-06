import { Prisma, RegistroJornada } from '@prisma/client';
import { AntifraudeService } from '../common/antifraude/antifraude.service';
import { JornadaLegalService } from '../common/jornada-legal/jornada-legal.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { WhatsappNotificationsService } from '../common/notifications/whatsapp-notifications.service';
import { AuditService } from '../common/audit/audit.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { CertificateService } from '../common/signature/certificate.service';
import { SignatureService } from '../common/signature/signature.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import type { Queue } from 'bullmq';
import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';
import { VerificacaoJornadaAgendadaService } from './verificacao-agendada.service';
import { JobLoteRegistroJornada, ResultadoItemLote } from './lote-registros-jornada.constants';
export type JornadaResumo = ReturnType<RegistrosJornadaService['resumirJornadaDiaria']>;
export interface ViagemConsolidada {
    inicio: Date;
    fim: Date;
    diasCorridos: number;
    emAndamento: boolean;
    jornadas: JornadaResumo[];
    totalDirecaoMin: number;
    totalEsperaMin: number;
    totalJornadaMin: number;
    ctesRelacionados: {
        id: string;
        numero: string | null;
    }[];
}
export declare class RegistrosJornadaService {
    private readonly prisma;
    private readonly hashChain;
    private readonly crypto;
    private readonly certificados;
    private readonly assinaturas;
    private readonly audit;
    private readonly jornadaLegal;
    private readonly antifraude;
    private readonly pushNotifications;
    private readonly whatsapp;
    private readonly tenant;
    private readonly verificacaoAgendada?;
    private readonly filaLote?;
    private static readonly TOLERANCIA_RELOGIO_FUTURO_MIN;
    private static readonly TOLERANCIA_DIVERGENCIA_RELOGIO_MONOTONICO_MIN;
    constructor(prisma: PrismaService, hashChain: HashChainService, crypto: EnvelopeEncryptionService, certificados: CertificateService, assinaturas: SignatureService, audit: AuditService, jornadaLegal: JornadaLegalService, antifraude: AntifraudeService, pushNotifications: PushNotificationsService, whatsapp: WhatsappNotificationsService, tenant: TenantService, verificacaoAgendada?: VerificacaoJornadaAgendadaService | undefined, filaLote?: Queue<JobLoteRegistroJornada> | undefined);
    private readonly logger;
    private queueEventsLote?;
    private obterQueueEventsLote;
    create(motoristaId: string, deviceUuidUsado: string, dto: CreateRegistroJornadaDto, ip?: string, userAgent?: string): Promise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
        precisaoGpsM: number | null;
        odometro: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        elapsedRealtimeMs: number | null;
        idempotencyKey: string | null;
    }>;
    processarLoteSequencial(motoristaId: string, deviceUuid: string, eventos: CreateRegistroJornadaDto[], ip?: string, userAgent?: string): Promise<ResultadoItemLote[]>;
    processarLote(motoristaId: string, deviceUuid: string, eventos: CreateRegistroJornadaDto[], ip?: string, userAgent?: string): Promise<ResultadoItemLote[]>;
    private avaliarLimitesLegais;
    verificarJornadasAbertasProativamente(): Promise<number>;
    verificarEAgendarProximoMotorista(motoristaId: string): Promise<void>;
    private agendarProximaVerificacaoSeAplicavel;
    private avaliarAntifraude;
    private avaliarFolgaConflitante;
    private readonly JANELA_CTE_RECENTE_MS;
    private avaliarCteAbertoSemVinculoRecente;
    private avaliarDescarregamento;
    private avaliarCercaVirtualEntrega;
    private distanciaHaversineMetros;
    private conferirTenant;
    consolidarViagens(motoristaId: string, grupoIdSolicitante: string): Promise<ViagemConsolidada[]>;
    private resumirJornadaDiaria;
    private somarIntervalosSimples;
    listByMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
        precisaoGpsM: number | null;
        odometro: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        elapsedRealtimeMs: number | null;
        idempotencyKey: string | null;
    }[]>;
    listarParaDispositivo(motoristaId: string, inicio?: Date, fim?: Date): Promise<{
        idLocal: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: string;
        latitude: number | null;
        longitude: number | null;
        precisaoGpsM: number | null;
        observacao: string | null;
        fusoOffsetMin: number | null;
        criadoEm: string;
    }[]>;
    buscarPorIdempotencyKey(motoristaId: string, idempotencyKey: string): Promise<RegistroJornada>;
    listByMotoristaNoPeriodo(motoristaId: string, inicio?: Date, fim?: Date, offsetEmpresaMin?: number): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        fusoOffsetMin: number | null;
        motoristaId: string;
        observacao: string | null;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
        precisaoGpsM: number | null;
        odometro: number | null;
        sequencial: number;
        hashAnterior: string;
        hashAtual: string;
        assinaturaDigital: string | null;
        algoritmoAssinatura: string;
        deviceUuidUsado: string;
        elapsedRealtimeMs: number | null;
        idempotencyKey: string | null;
    }[]>;
    private explicarDivergencia;
    verificarIntegridade(motoristaId: string, actorId: string | undefined, grupoIdSolicitante: string): Promise<{
        motoristaId: string;
        cadeiaValida: boolean;
        motivoCadeia: string | undefined;
        primeiraQuebraSequencial: number | undefined;
        divergencias: {
            sequencial: number;
            motivoTecnico: string;
            explicacao: string;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento | null;
            timestampEvento: Date | null;
            criadoEm: Date | null;
            temGps: boolean;
            aceita: boolean;
            aceite: {
                motivo: string;
                aceitoPorNome: string;
                aceitoEm: Date;
            } | null;
        }[];
        totalRegistros: number;
        certificadoFingerprintOk: boolean;
        assinaturasInvalidas: number[];
        integro: boolean;
    }>;
    varrerIntegridadeCadeias(): Promise<{
        verificados: number;
        comViolacao: number;
        alertasCriados: number;
    }>;
    analisarEventoIntegridade(motoristaId: string, sequencial: number, grupoIdSolicitante: string): Promise<{
        motoristaId: string;
        divergente: boolean;
        explicacao: string;
        evento: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
            latitude: number | null;
            longitude: number | null;
            precisaoGpsM: number | null;
            odometro: number | null;
            observacao: string | null;
            fusoOffsetMin: number | null;
            deviceUuidUsado: string;
        };
        anterior: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
        } | null;
        proximo: {
            sequencial: number;
            tipoEvento: import("@prisma/client").$Enums.TipoEvento;
            timestampEvento: Date;
            criadoEm: Date;
        } | null;
        verificacao: {
            hashAnteriorConfere: boolean;
            hashAnteriorGravado: string;
            hashAnteriorEsperado: string;
            hashConfere: boolean;
            hashGravado: string;
            hashRecalculado: string;
            payloadCanonico: string;
            tentativas: {
                descricao: string;
                bate: boolean;
            }[];
            variacaoQueBate: string | null;
        };
        aceite: {
            motivo: string;
            aceitoPorNome: string;
            aceitoEm: Date;
        } | null;
    }>;
    aceitarDivergenciaIntegridade(motoristaId: string, sequencial: number, motivo: string, usuarioId: string, grupoIdSolicitante: string): Promise<{
        aceitoPorUsuario: {
            nome: string;
        };
    } & {
        id: string;
        motoristaId: string;
        sequencial: number;
        motivo: string;
        aceitoPorUsuarioId: string;
        aceitoEm: Date;
    }>;
    private arredondarCoordenada;
}
