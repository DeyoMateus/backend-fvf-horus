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
var AccountLockoutService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountLockoutService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let AccountLockoutService = class AccountLockoutService {
    static { AccountLockoutService_1 = this; }
    logger = new common_1.Logger(AccountLockoutService_1.name);
    redis;
    static LIMITE_TENTATIVAS = 5;
    static DURACAO_BLOQUEIO_SEGUNDOS = 15 * 60;
    static JANELA_CONTAGEM_SEGUNDOS = 15 * 60;
    fallbackLocal = new Map();
    constructor() {
        this.redis = new ioredis_1.Redis({
            host: process.env.REDIS_HOST ?? 'localhost',
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 1,
            retryStrategy: (times) => Math.min(times * 200, 2000),
            lazyConnect: false,
        });
        this.redis.on('error', (erro) => {
            this.logger.warn(`Redis do bloqueio de conta indisponível , usando fallback local: ${erro.message}`);
        });
    }
    chave(namespace, email) {
        return `account-lockout:${namespace}:${email.toLowerCase().trim()}`;
    }
    async segundosBloqueados(namespace, email) {
        const chave = this.chave(namespace, email);
        try {
            const bloqueadoAteStr = await this.redis.hget(chave, 'bloqueadoAte');
            const bloqueadoAte = Number(bloqueadoAteStr ?? 0);
            const restante = Math.ceil((bloqueadoAte - Date.now()) / 1000);
            return Math.max(restante, 0);
        }
        catch {
            const entrada = this.fallbackLocal.get(chave);
            if (!entrada)
                return 0;
            return Math.max(Math.ceil((entrada.bloqueadoAte - Date.now()) / 1000), 0);
        }
    }
    async registrarFalha(namespace, email) {
        const chave = this.chave(namespace, email);
        const agora = Date.now();
        try {
            const janelaMs = AccountLockoutService_1.JANELA_CONTAGEM_SEGUNDOS * 1000;
            const dados = await this.redis.hmget(chave, 'falhas', 'expiraContagemEm');
            let falhas = Number(dados[0] ?? 0);
            const expiraContagemEm = Number(dados[1] ?? 0);
            if (expiraContagemEm <= agora)
                falhas = 0;
            falhas += 1;
            const dadosParaGravar = {
                falhas,
                expiraContagemEm: agora + janelaMs,
            };
            if (falhas >= AccountLockoutService_1.LIMITE_TENTATIVAS) {
                dadosParaGravar.bloqueadoAte =
                    agora + AccountLockoutService_1.DURACAO_BLOQUEIO_SEGUNDOS * 1000;
            }
            await this.redis.hmset(chave, dadosParaGravar);
            await this.redis.pexpire(chave, Math.max(janelaMs, AccountLockoutService_1.DURACAO_BLOQUEIO_SEGUNDOS * 1000));
        }
        catch {
            const entrada = this.fallbackLocal.get(chave) ?? {
                falhas: 0,
                expiraContagemEm: 0,
                bloqueadoAte: 0,
            };
            if (entrada.expiraContagemEm <= agora)
                entrada.falhas = 0;
            entrada.falhas += 1;
            entrada.expiraContagemEm =
                agora + AccountLockoutService_1.JANELA_CONTAGEM_SEGUNDOS * 1000;
            if (entrada.falhas >= AccountLockoutService_1.LIMITE_TENTATIVAS) {
                entrada.bloqueadoAte =
                    agora + AccountLockoutService_1.DURACAO_BLOQUEIO_SEGUNDOS * 1000;
            }
            this.fallbackLocal.set(chave, entrada);
        }
    }
    async registrarSucesso(namespace, email) {
        const chave = this.chave(namespace, email);
        try {
            await this.redis.del(chave);
        }
        catch {
            this.fallbackLocal.delete(chave);
        }
    }
    onModuleDestroy() {
        this.redis.disconnect();
    }
};
exports.AccountLockoutService = AccountLockoutService;
exports.AccountLockoutService = AccountLockoutService = AccountLockoutService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AccountLockoutService);
//# sourceMappingURL=account-lockout.service.js.map