import { PrismaService } from '../prisma/prisma.service';
export declare class TenantService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    verificarEmpresaNoGrupo(empresaId: string, grupoId: string): Promise<void>;
    verificarMotoristaNoGrupo(motoristaId: string, grupoId: string): Promise<{
        empresaId: string;
    }>;
    verificarAjudanteNoGrupo(ajudanteId: string, grupoId: string): Promise<{
        empresaId: string;
    }>;
    verificarMotoristaAtivo(motoristaId: string): Promise<void>;
    verificarDocumentoCargaNoGrupo(documentoId: string, grupoId: string): Promise<{
        empresaId: string;
    }>;
}
