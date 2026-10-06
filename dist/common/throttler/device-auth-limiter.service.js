"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DeviceAuthLimiterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceAuthLimiterService = void 0;
const common_1 = require("@nestjs/common");
const redis_throttler_storage_service_1 = require("./redis-throttler-storage.service");
let DeviceAuthLimiterService = class DeviceAuthLimiterService {
    static { DeviceAuthLimiterService_1 = this; }
    storage;
    static JANELA_FALHAS_MS = 15 * 60_000;
    static LIMITE_FALHAS_IP = 30;
    static LIMITE_FALHAS_IDENTIDADE_IP = 10;
    static BLOQUEIO_MS = 15 * 60_000;
    limiteUsoPorMinuto = Number(process.env.DEVICE_RATE_LIMIT_PER_MIN ?? 120);
    constructor(storage) {
        this.storage = storage;
    }
    erro429(segundos) {
        return new common_1.HttpException({
            statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
            message: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
            retryAfterSeconds: segundos,
        }, common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
    async exigirNaoBloqueado(ip) {
        const s = await this.storage.segundosBloqueado(ip, 'dispositivo-falha-ip');
        if (s > 0)
            throw this.erro429(s);
    }
    async registrarFalha(ip, identidadeBruta) {
        const identidade = identidadeBruta.slice(0, 64);
        await this.storage.increment(ip, DeviceAuthLimiterService_1.JANELA_FALHAS_MS, DeviceAuthLimiterService_1.LIMITE_FALHAS_IP, DeviceAuthLimiterService_1.BLOQUEIO_MS, 'dispositivo-falha-ip');
        await this.storage.increment(`${identidade}|${ip}`, DeviceAuthLimiterService_1.JANELA_FALHAS_MS, DeviceAuthLimiterService_1.LIMITE_FALHAS_IDENTIDADE_IP, DeviceAuthLimiterService_1.BLOQUEIO_MS, 'dispositivo-falha-id');
    }
    async limitarUso(identidade) {
        const r = await this.storage.increment(identidade, 60_000, this.limiteUsoPorMinuto, 60_000, 'dispositivo-uso');
        if (r.isBlocked)
            throw this.erro429(Math.max(r.timeToBlockExpire, 1));
    }
};
exports.DeviceAuthLimiterService = DeviceAuthLimiterService;
exports.DeviceAuthLimiterService = DeviceAuthLimiterService = DeviceAuthLimiterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_throttler_storage_service_1.RedisThrottlerStorageService])
], DeviceAuthLimiterService);
//# sourceMappingURL=device-auth-limiter.service.js.map