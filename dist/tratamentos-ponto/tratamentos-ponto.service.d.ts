import { AuditService } from '../common/audit/audit.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { RegistrosJornadaService } from '../registros-jornada/registros-jornada.service';
import { CreateTratamentoPontoDto } from './dto/create-tratamento-ponto.dto';
export declare class TratamentosPontoService {
    private readonly prisma;
    private readonly hashChain;
    private readonly audit;
    private readonly tenant;
    private readonly storage;
    private readonly push;
    private readonly registrosJornada;
    constructor(prisma: PrismaService, hashChain: HashChainService, audit: AuditService, tenant: TenantService, storage: StorageService, push: PushNotificationsService, registrosJornada: RegistrosJornadaService);
    create(motoristaId: string, dto: CreateTratamentoPontoDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
    criarRegistroAncorado(motoristaId: string, tipoEvento: CreateTratamentoPontoDto['tipoEvento'], timestampEvento: Date, motivo: string, usuarioId: string, registroReferenciaId?: string): Promise<{
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
    listByMotorista(motoristaId: string, grupoIdSolicitante?: string): Promise<({
        usuario: {
            id: string;
            nome: string;
            email: string;
        };
        evidencias: {
            id: string;
            createdAt: Date;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
    } & {
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    })[]>;
    anexarEvidencia(tratamentoId: string, arquivo: Express.Multer.File, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
    }>;
    removerEvidencia(evidenciaId: string, usuarioId: string, grupoIdSolicitante: string): Promise<void>;
    baixarEvidencia(evidenciaId: string): Promise<{
        conteudo: Buffer<ArrayBufferLike>;
        id: string;
        createdAt: Date;
        tratamentoId: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
        chaveStorage: string | null;
    }>;
    verificarTratamentoNoGrupo(tratamentoId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
    verificarEvidenciaNoGrupo(evidenciaId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        tratamentoId: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
        chaveStorage: string | null;
        conteudo: import("@prisma/client/runtime/library").Bytes | null;
    }>;
    listarMeusAjustes(motoristaId: string): Promise<({
        usuario: {
            nome: string;
        };
        evidencias: {
            id: string;
            nomeArquivo: string;
            contentType: string;
            tamanhoBytes: number;
        }[];
    } & {
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    })[]>;
    baixarEvidenciaDoMotorista(evidenciaId: string, motoristaId: string): Promise<{
        conteudo: Buffer<ArrayBufferLike>;
        id: string;
        createdAt: Date;
        tratamentoId: string;
        nomeArquivo: string;
        contentType: string;
        tamanhoBytes: number;
        chaveStorage: string | null;
    }>;
    darCiencia(tratamentoId: string, motoristaId: string): Promise<{
        id: string;
        motoristaId: string;
        tipoEvento: import("@prisma/client").$Enums.TipoEvento;
        timestampEvento: Date;
        createdAt: Date;
        motivo: string;
        usuarioId: string;
        registroReferenciaId: string | null;
        hashReferencia: string;
        hashRegistro: string;
        motoristaCienciaEm: Date | null;
    }>;
}
