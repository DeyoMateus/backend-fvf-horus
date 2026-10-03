import { PrismaService } from '../prisma/prisma.service';
import { NsrService } from '../nsr/nsr.service';
export declare class AfdService {
    private readonly prisma;
    private readonly nsr;
    constructor(prisma: PrismaService, nsr: NsrService);
    gerarArquivo(empresaId: string, inicio: Date, fim: Date): Promise<{
        nomeArquivo: string;
        conteudo: string;
    }>;
    private linhaTipo1;
    private linhaTipo5Inclusao;
    private linhaTipo7Marcacao;
    private linhaTipo9;
    private padN;
    private padA;
    private fmtData;
    private fmtDataHora;
    private crc16Hex;
}
