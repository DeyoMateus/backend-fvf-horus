import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { SolicitarTrocaDispositivoDto } from './dto/solicitar-troca-dispositivo.dto';
export declare class DispositivosService {
    private readonly prisma;
    private readonly audit;
    private readonly tenant;
    constructor(prisma: PrismaService, audit: AuditService, tenant: TenantService);
    vincular(motoristaId: string, dto: VincularDispositivoDto, usuarioId: string, grupoIdSolicitante: string): Promise<{
        motoristaId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    revogar(motoristaId: string, usuarioId: string, grupoIdSolicitante: string): Promise<void>;
    status(motoristaId: string, grupoIdSolicitante: string): Promise<{
        deviceUuid: string;
        vinculadoPorUsuarioId: string;
        vinculadoEm: Date;
        atualizadoEm: Date;
    } | {
        vinculado: boolean;
    }>;
    private conferirTenant;
    atualizarPushToken(motoristaId: string, pushToken: string): Promise<void>;
    solicitarTroca(dto: SolicitarTrocaDispositivoDto): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    }>;
    listarSolicitacoesPendentes(grupoId: string): Promise<({
        motorista: {
            id: string;
            nome: string;
            cpf: string;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    })[]>;
    aprovarTroca(solicitacaoId: string, usuarioId: string, grupoId: string): Promise<{
        motoristaId: string;
        deviceUuid: string;
        vinculadoEm: Date;
        deviceApiKey: string;
    }>;
    rejeitarTroca(solicitacaoId: string, usuarioId: string, motivo: string, grupoId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.StatusSolicitacaoDispositivo;
        motoristaId: string;
        deviceUuidSolicitado: string;
        modeloAparelho: string | null;
        sistemaOperacional: string | null;
        observacaoMotorista: string | null;
        revisadoPorUsuarioId: string | null;
        revisadoEm: Date | null;
        motivoRejeicao: string | null;
        criadoEm: Date;
    }>;
}
