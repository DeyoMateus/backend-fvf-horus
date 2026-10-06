import { RedisThrottlerStorageService } from './redis-throttler-storage.service';
export declare class DeviceAuthLimiterService {
    private readonly storage;
    private static readonly JANELA_FALHAS_MS;
    private static readonly LIMITE_FALHAS_IP;
    private static readonly LIMITE_FALHAS_IDENTIDADE_IP;
    private static readonly BLOQUEIO_MS;
    private readonly limiteUsoPorMinuto;
    constructor(storage: RedisThrottlerStorageService);
    private erro429;
    exigirNaoBloqueado(ip: string): Promise<void>;
    registrarFalha(ip: string, identidadeBruta: string): Promise<void>;
    limitarUso(identidade: string): Promise<void>;
}
