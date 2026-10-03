import { StatusMotorista } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CertificateService } from '../common/signature/certificate.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAjudanteDto } from './dto/create-ajudante.dto';
import { AtualizarStatusAjudanteDto } from './dto/atualizar-status-ajudante.dto';
import { VincularDispositivoAjudanteDto } from './dto/vincular-dispositivo-ajudante.dto';
export declare class AjudantesService {
    private readonly prisma;
    private readonly hashChain;
    private readonly certificados;
    private readonly crypto;
    private readonly audit;
    private readonly tenant;
    constructor(prisma: PrismaService, hashChain: HashChainService, certificados: CertificateService, crypto: EnvelopeEncryptionService, audit: AuditService, tenant: TenantService);
    create(dto: CreateAjudanteDto, grupoId: string, actorId?: string): Promise<{
        id: string;
        nome: string;
        cpf: string;
        status: StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
    }>;
    atualizarStatus(id: string, dto: AtualizarStatusAjudanteDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        empresaId: string;
    }>;
    findById(id: string, grupoIdSolicitante: string): Promise<{
        dispositivoVinculado: {
            deviceUuid: string;
            vinculadoEm: Date;
            atualizadoEm: Date;
        } | null;
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        telefone: string | null;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string | null;
        certificadoValidoAte: Date | null;
        excluidoEm: Date | null;
        motivoExclusao: string | null;
    }>;
    listByGrupo(grupoId: string, page?: number, pageSize?: number, busca?: string, incluirExcluidos?: boolean): Promise<{
        dados: {
            dispositivoVinculado: {
                deviceUuid: string;
            } | null;
            id: string;
            createdAt: Date;
            nome: string;
            cpf: string;
            status: import("@prisma/client").$Enums.StatusMotorista;
            certificadoValidoAte: Date | null;
            excluidoEm: Date | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    excluir(id: string, motivo: string | undefined, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        nome: string;
        cpf: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        excluidoEm: Date | null;
    }>;
    vincularDispositivo(ajudanteId: string, dto: VincularDispositivoAjudanteDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        ajudanteId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    statusDispositivo(ajudanteId: string, grupoIdSolicitante: string): Promise<{
        deviceUuid: string;
        vinculadoPorUsuarioId: string;
        vinculadoEm: Date;
        atualizadoEm: Date;
    } | {
        vinculado: boolean;
    }>;
    revogarDispositivo(ajudanteId: string, usuarioId: string, grupoIdSolicitante: string): Promise<void>;
}
