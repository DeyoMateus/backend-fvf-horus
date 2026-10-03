import { PrismaService } from '../prisma/prisma.service';
export declare class RelogioConfiavelService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    registrarAmostraEResolverPendencias(motoristaId: string, deviceUuidUsado: string, elapsedRealtimeMs: number): Promise<{
        horaServidor: Date;
    }>;
}
