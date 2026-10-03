import { TipoAjusteBancoHoras } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { HoleriteService } from '../holerite/holerite.service';
export interface SaldoBancoHoras {
    ativo: boolean;
    creditoExtraMin: number;
    creditoCorrecaoMin: number;
    debitoMin: number;
    saldoMin: number;
}
export declare class BancoHorasService {
    private readonly prisma;
    private readonly tenant;
    private readonly holerite;
    private readonly audit;
    constructor(prisma: PrismaService, tenant: TenantService, holerite: HoleriteService, audit: AuditService);
    estaAtivoParaMotorista(motoristaId: string): Promise<boolean>;
    ajustesDoPeriodo(motoristaId: string, dataInicio: Date, dataFim: Date): Promise<{
        creditoCorrecaoMin: number;
        debitoMin: number;
        ajustes: Array<{
            data: Date;
            tipo: TipoAjusteBancoHoras;
            minutos: number;
        }>;
    }>;
    calcularSaldo(motoristaId: string, dataInicio: Date, dataFim: Date, grupoIdSolicitante: string): Promise<SaldoBancoHoras>;
    listarAjustes(motoristaId: string, grupoIdSolicitante: string): Promise<({
        registradoPorUsuario: {
            nome: string;
            email: string;
        };
    } & {
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAjusteBancoHoras;
        observacao: string | null;
        minutos: number;
        registradoPorUsuarioId: string;
    })[]>;
    registrarAjuste(motoristaId: string, grupoIdSolicitante: string, usuarioId: string, dados: {
        tipo: TipoAjusteBancoHoras;
        minutos: number;
        data: Date;
        observacao?: string;
    }): Promise<{
        data: Date;
        id: string;
        createdAt: Date;
        motoristaId: string;
        tipo: import("@prisma/client").$Enums.TipoAjusteBancoHoras;
        observacao: string | null;
        minutos: number;
        registradoPorUsuarioId: string;
    }>;
}
