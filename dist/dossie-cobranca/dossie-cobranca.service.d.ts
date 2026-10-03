import { PrismaService } from '../common/prisma/prisma.service';
export interface ItemDossieCobranca {
    alertaId: string;
    motoristaId: string;
    motoristaNome: string;
    motoristaCpf: string;
    periodoInicio: string;
    periodoFim: string;
    minutosTotais: number;
    intervalos: {
        inicio: string;
        fim: string;
    }[];
    registroGeradorId: string;
    observacao: string;
    criadoEm: Date;
}
export declare class DossieCobrancaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listar(grupoId: string, inicio: Date, fim: Date, motoristaId?: string): Promise<ItemDossieCobranca[]>;
}
