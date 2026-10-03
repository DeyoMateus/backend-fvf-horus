import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { AuditService } from '../common/audit/audit.service';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto';
export declare class AuditoriaController {
    private readonly audit;
    constructor(audit: AuditService);
    listar(user: UsuarioAutenticado, filtro: ListarAuditoriaDto): Promise<{
        dados: ({
            id: string;
            actorType: import("@prisma/client").$Enums.ActorType;
            actorId: string | null;
            acao: string;
            entidade: string;
            entidadeId: string | null;
            detalhes: import("@prisma/client/runtime/library").JsonValue | null;
            ip: string | null;
            userAgent: string | null;
            createdAt: Date;
            grupoId: string | null;
        } & {
            actorNome: string | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    listarOcorrencias(user: UsuarioAutenticado): Promise<{
        acao: string;
        entidade: string;
    }[]>;
}
