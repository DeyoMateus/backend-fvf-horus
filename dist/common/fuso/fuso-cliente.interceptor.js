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
var FusoClienteInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusoClienteInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const fuso_contexto_1 = require("./fuso-contexto");
const prisma_service_1 = require("../prisma/prisma.service");
const fuso_brasil_util_1 = require("./fuso-brasil.util");
let FusoClienteInterceptor = FusoClienteInterceptor_1 = class FusoClienteInterceptor {
    prisma;
    logger = new common_1.Logger(FusoClienteInterceptor_1.name);
    ultimoPorUsuario = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    intercept(context, next) {
        let offsetDaRequisicao = null;
        try {
            const req = context.switchToHttp().getRequest();
            const usuarioId = req.user?.grupoId && req.user?.sub ? req.user.sub : undefined;
            const bruto = req.headers?.['x-fuso-offset-min'];
            const offset = typeof bruto === 'string' ? Number(bruto) : NaN;
            if ((0, fuso_brasil_util_1.offsetValido)(offset))
                offsetDaRequisicao = offset;
            if (usuarioId &&
                (0, fuso_brasil_util_1.offsetValido)(offset) &&
                this.ultimoPorUsuario.get(usuarioId) !== offset) {
                this.ultimoPorUsuario.set(usuarioId, offset);
                void this.prisma.usuarioEmpresa
                    .updateMany({
                    where: { id: usuarioId, NOT: { fusoOffsetMin: offset } },
                    data: { fusoOffsetMin: offset },
                })
                    .catch((err) => this.logger.warn(`Não salvou fuso do usuário: ${String(err)}`));
            }
        }
        catch {
        }
        if (offsetDaRequisicao === null)
            return next.handle();
        const off = offsetDaRequisicao;
        return new rxjs_1.Observable((subscriber) => {
            (0, fuso_contexto_1.executarComFusoDoCliente)(off, () => {
                next.handle().subscribe(subscriber);
            });
        });
    }
};
exports.FusoClienteInterceptor = FusoClienteInterceptor;
exports.FusoClienteInterceptor = FusoClienteInterceptor = FusoClienteInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FusoClienteInterceptor);
//# sourceMappingURL=fuso-cliente.interceptor.js.map