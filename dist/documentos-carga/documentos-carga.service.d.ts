import { Queue } from 'bullmq';
import { AuditService } from '../common/audit/audit.service';
import { GeocodingService } from '../common/geocoding/geocoding.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateDocumentoCargaDto } from './dto/create-documento-carga.dto';
import { JobRetentarUploadR2 } from './storage-queue/documento-carga-storage.queue';
export declare class DocumentosCargaService {
    private readonly prisma;
    private readonly audit;
    private readonly storage;
    private readonly geocoding;
    private readonly tenant;
    private readonly filaArmazenamento;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService, storage: StorageService, geocoding: GeocodingService, tenant: TenantService, filaArmazenamento: Queue<JobRetentarUploadR2>);
    upload(grupoId: string, usuarioId: string, dto: CreateDocumentoCargaDto, arquivo: {
        buffer: Buffer;
        originalname: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        motoristaId: string | null;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        observacao: string | null;
    }>;
    listByGrupo(grupoId: string, page?: number, pageSize?: number, ordem?: 'asc' | 'desc', filtro?: {
        tipo?: 'CTE' | 'MDFE';
        statusCarga?: 'CARREGADO' | 'VAZIO';
        motoristaId?: string;
        numero?: string;
        chaveAcesso?: string;
    }): Promise<{
        dados: {
            motorista: {
                nome: string;
            } | null;
            id: string;
            createdAt: Date;
            motoristaId: string | null;
            tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
            numero: string | null;
            chaveAcesso: string | null;
            statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
            entregueEm: Date | null;
            enderecoDestinatario: string | null;
            destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
            destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
            observacao: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    listByMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        observacao: string | null;
    }[]>;
    statusAtualPorMotorista(motoristaId: string, grupoIdSolicitante: string): Promise<{
        cteEmAberto: number;
        createdAt: Date;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
    } | {
        cteEmAberto: number;
        statusCarga: null;
    }>;
    remover(documentoId: string, usuarioId: string, grupoIdSolicitante: string): Promise<{
        ok: boolean;
    }>;
    baixarXml(documentoId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        empresaId: string;
        motoristaId: string | null;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        geocodificadoEm: Date | null;
        xmlOriginal: import("@prisma/client/runtime/library").Bytes | null;
        xmlStorageKey: string | null;
        observacao: string | null;
        uploadedPorUsuarioId: string;
    } | {
        xmlOriginal: Buffer<ArrayBufferLike>;
        id: string;
        createdAt: Date;
        empresaId: string;
        motoristaId: string | null;
        tipo: import("@prisma/client").$Enums.TipoDocumentoCarga;
        numero: string | null;
        chaveAcesso: string | null;
        statusCarga: import("@prisma/client").$Enums.StatusCargaViagem;
        entregueEm: Date | null;
        enderecoDestinatario: string | null;
        destinatarioLatitude: import("@prisma/client/runtime/library").Decimal | null;
        destinatarioLongitude: import("@prisma/client/runtime/library").Decimal | null;
        geocodificadoEm: Date | null;
        xmlStorageKey: string | null;
        observacao: string | null;
        uploadedPorUsuarioId: string;
    }>;
}
