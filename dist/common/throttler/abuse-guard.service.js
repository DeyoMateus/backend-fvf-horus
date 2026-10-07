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
var AbuseGuardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbuseGuardService = void 0;
const common_1 = require("@nestjs/common");
const redis_throttler_storage_service_1 = require("./redis-throttler-storage.service");
let AbuseGuardService = class AbuseGuardService {
    static { AbuseGuardService_1 = this; }
    storage;
    logger = new common_1.Logger(AbuseGuardService_1.name);
    ultimoAvisoDefesaMs = 0;
    tetoFalhasGlobais = Number(process.env.LOGIN_FALHAS_GLOBAIS_5MIN ?? 100);
    static JANELA_GLOBAL_MS = 5 * 60_000;
    static DEFESA_MS = 10 * 60_000;
    static ATRASO_DEFESA_MS = 3_000;
    constructor(storage) {
        this.storage = storage;
    }
    async permitirPorIdentidade(namespace, identidadeBruta, limite, janelaMs) {
        const identidade = identidadeBruta.toLowerCase().trim().slice(0, 254);
        const r = await this.storage.increment(identidade, janelaMs, limite, janelaMs, `abuso-id-${namespace}`);
        return !r.isBlocked;
    }
    async registrarFalhaGlobalDeLogin() {
        const r = await this.storage.increment('global', AbuseGuardService_1.JANELA_GLOBAL_MS, this.tetoFalhasGlobais, AbuseGuardService_1.DEFESA_MS, 'login-falhas-globais');
        if (r.isBlocked &&
            Date.now() - this.ultimoAvisoDefesaMs > AbuseGuardService_1.DEFESA_MS) {
            this.ultimoAvisoDefesaMs = Date.now();
            this.logger.error(`ATAQUE DISTRIBUÍDO SUSPEITO: mais de ${this.tetoFalhasGlobais} falhas de login em 5 min (todas as contas/IPs). Modo defesa ativo por 10 min: tentativas falhas passam a ser atrasadas.`);
        }
    }
    async emModoDefesa() {
        return ((await this.storage.segundosBloqueado('global', 'login-falhas-globais')) >
            0);
    }
    async atrasarSeEmDefesa() {
        if (await this.emModoDefesa()) {
            await new Promise((r) => setTimeout(r, AbuseGuardService_1.ATRASO_DEFESA_MS));
        }
    }
};
exports.AbuseGuardService = AbuseGuardService;
exports.AbuseGuardService = AbuseGuardService = AbuseGuardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_throttler_storage_service_1.RedisThrottlerStorageService])
], AbuseGuardService);
//# sourceMappingURL=abuse-guard.service.js.map