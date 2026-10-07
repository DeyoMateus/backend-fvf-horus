import { RedisThrottlerStorageService } from './redis-throttler-storage.service';
export declare class AbuseGuardService {
    private readonly storage;
    private readonly logger;
    private ultimoAvisoDefesaMs;
    private readonly tetoFalhasGlobais;
    private static readonly JANELA_GLOBAL_MS;
    private static readonly DEFESA_MS;
    private static readonly ATRASO_DEFESA_MS;
    constructor(storage: RedisThrottlerStorageService);
    permitirPorIdentidade(namespace: string, identidadeBruta: string, limite: number, janelaMs: number): Promise<boolean>;
    registrarFalhaGlobalDeLogin(): Promise<void>;
    emModoDefesa(): Promise<boolean>;
    atrasarSeEmDefesa(): Promise<void>;
}
