import { PrismaService } from '../prisma/prisma.service';
export declare class NsrService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    obterOuCriar(chaveOrigem: string, tipoRegistro: number): Promise<number>;
}
