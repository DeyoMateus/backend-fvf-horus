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
var LimpezaTokensService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimpezaTokensService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LimpezaTokensService = LimpezaTokensService_1 = class LimpezaTokensService {
    prisma;
    logger = new common_1.Logger(LimpezaTokensService_1.name);
    timer = null;
    emExecucao = false;
    constructor(prisma) {
        this.prisma = prisma;
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test')
            return;
        const intervaloMs = Number(process.env.INTERVALO_LIMPEZA_TOKENS_MS ?? 24 * 60 * 60 * 1000);
        this.timer = setInterval(() => void this.executar(), intervaloMs);
        void this.executar();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async executar() {
        if (this.emExecucao)
            return;
        this.emExecucao = true;
        try {
            const diasRetencao = Number(process.env.DIAS_RETENCAO_TOKENS_EXPIRADOS ?? 30);
            const limite = new Date(Date.now() - diasRetencao * 24 * 60 * 60 * 1000);
            const [refresh, resetSenha, superAdminRefresh, superAdminResetSenha] = await Promise.all([
                this.prisma.refreshToken.deleteMany({
                    where: { expiresAt: { lt: limite } },
                }),
                this.prisma.passwordResetToken.deleteMany({
                    where: { expiresAt: { lt: limite } },
                }),
                this.prisma.superAdminRefreshToken.deleteMany({
                    where: { expiresAt: { lt: limite } },
                }),
                this.prisma.superAdminPasswordResetToken.deleteMany({
                    where: { expiresAt: { lt: limite } },
                }),
            ]);
            const total = refresh.count +
                resetSenha.count +
                superAdminRefresh.count +
                superAdminResetSenha.count;
            if (total > 0) {
                this.logger.log(`Limpeza de tokens expirados: ${refresh.count} refresh, ${resetSenha.count} reset de senha, ` +
                    `${superAdminRefresh.count} refresh (super admin), ${superAdminResetSenha.count} reset de senha (super admin).`);
            }
        }
        catch (err) {
            this.logger.warn(`Falha na limpeza de tokens expirados: ${err.message}`);
        }
        finally {
            this.emExecucao = false;
        }
    }
};
exports.LimpezaTokensService = LimpezaTokensService;
exports.LimpezaTokensService = LimpezaTokensService = LimpezaTokensService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LimpezaTokensService);
//# sourceMappingURL=limpeza-tokens.service.js.map