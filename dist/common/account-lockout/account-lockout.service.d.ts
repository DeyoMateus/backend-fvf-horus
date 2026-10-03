import { OnModuleDestroy } from '@nestjs/common';
export declare class AccountLockoutService implements OnModuleDestroy {
    private readonly logger;
    private readonly redis;
    private static readonly LIMITE_TENTATIVAS;
    private static readonly DURACAO_BLOQUEIO_SEGUNDOS;
    private static readonly JANELA_CONTAGEM_SEGUNDOS;
    private readonly fallbackLocal;
    constructor();
    private chave;
    segundosBloqueados(namespace: string, email: string): Promise<number>;
    registrarFalha(namespace: string, email: string): Promise<void>;
    registrarSucesso(namespace: string, email: string): Promise<void>;
    onModuleDestroy(): void;
}
