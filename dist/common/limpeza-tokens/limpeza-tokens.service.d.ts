import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class LimpezaTokensService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly logger;
    private timer;
    private emExecucao;
    constructor(prisma: PrismaService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private executar;
}
