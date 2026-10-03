import { Prisma, StatusMotorista } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CertificateService } from '../common/signature/certificate.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { AtualizarStatusMotoristaDto } from './dto/atualizar-status-motorista.dto';
import { AtualizarCadastroMotoristaDto } from './dto/atualizar-cadastro-motorista.dto';
import { AtualizarPerfilMotoristaDto } from './dto/atualizar-perfil-motorista.dto';
export declare class MotoristasService {
    private readonly prisma;
    private readonly hashChain;
    private readonly certificados;
    private readonly crypto;
    private readonly audit;
    private readonly tenant;
    constructor(prisma: PrismaService, hashChain: HashChainService, certificados: CertificateService, crypto: EnvelopeEncryptionService, audit: AuditService, tenant: TenantService);
    create(dto: CreateMotoristaDto, grupoId: string, actorId?: string): Promise<{
        id: string;
        nome: string;
        cpf: string;
        cnh: string;
        status: StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
    }>;
    atualizarStatus(id: string, dto: AtualizarStatusMotoristaDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        empresaId: string;
    }>;
    atualizarCadastro(id: string, dto: AtualizarCadastroMotoristaDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        telefone: string | null;
        empresaId: string;
    }>;
    findById(id: string, grupoIdSolicitante: string): Promise<{
        dispositivoVinculado: {
            deviceUuid: string;
            vinculadoEm: Date;
            atualizadoEm: Date;
        } | null;
        veiculoVinculado: {
            atualizadoEm: Date;
            placa: string;
            idRastreador: string | null;
            tecnologiaRastreador: import("@prisma/client").$Enums.TecnologiaRastreador | null;
        } | null;
        id: string;
        createdAt: Date;
        nome: string;
        updatedAt: Date;
        cpf: string;
        cnh: string;
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
            veiculoVinculado: {
                placa: string;
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
        cnh: string;
        status: import("@prisma/client").$Enums.StatusMotorista;
        excluidoEm: Date | null;
    }>;
    obterPerfilProprio(motoristaId: string): Promise<{
        id: string;
        nome: string;
        cpf: string;
        telefone: string | null;
    }>;
    atualizarPerfilProprio(motoristaId: string, dto: AtualizarPerfilMotoristaDto): Promise<{
        id: string;
        nome: string;
        cpf: string;
        telefone: string | null;
    }>;
    listarAlertasIntegridadeDispositivo(motoristaId: string, grupoIdSolicitante: string): Promise<{
        id: string;
        actorType: import("@prisma/client").$Enums.ActorType;
        actorId: string | null;
        acao: string;
        entidade: string;
        entidadeId: string | null;
        detalhes: Prisma.JsonValue | null;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
        grupoId: string | null;
    }[]>;
}
