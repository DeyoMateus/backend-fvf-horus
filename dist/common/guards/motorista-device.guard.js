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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoristaDeviceGuard = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_context_1 = require("../tenant/tenant-context");
let MotoristaDeviceGuard = class MotoristaDeviceGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const motoristaId = request.headers['x-motorista-id'];
        const deviceKey = request.headers['x-device-key'];
        const deviceUuid = request.headers['x-device-uuid'];
        if (!motoristaId ||
            !deviceKey ||
            !deviceUuid ||
            typeof motoristaId !== 'string' ||
            typeof deviceKey !== 'string' ||
            typeof deviceUuid !== 'string') {
            throw new common_1.UnauthorizedException('Credenciais de dispositivo ausentes');
        }
        const motorista = await tenant_context_1.TenantContext.paraSistema(() => this.prisma.motorista.findUnique({
            where: { id: motoristaId },
            include: {
                dispositivoVinculado: true,
                empresa: { select: { grupoId: true } },
            },
        }));
        if (!motorista ||
            motorista.status !== 'ATIVO' ||
            !motorista.dispositivoVinculado) {
            throw new common_1.UnauthorizedException('Dispositivo não autorizado');
        }
        const vinculo = motorista.dispositivoVinculado;
        const uuidRecebido = (0, crypto_1.createHash)('sha256').update(deviceUuid).digest();
        const uuidVinculado = (0, crypto_1.createHash)('sha256')
            .update(vinculo.deviceUuid)
            .digest();
        const uuidOk = (0, crypto_1.timingSafeEqual)(uuidRecebido, uuidVinculado);
        const chaveRecebida = (0, crypto_1.createHash)('sha256').update(deviceKey).digest();
        const chaveArmazenada = Buffer.from(vinculo.deviceApiKeyHash, 'hex');
        const chaveOk = chaveRecebida.length === chaveArmazenada.length &&
            (0, crypto_1.timingSafeEqual)(chaveRecebida, chaveArmazenada);
        if (!uuidOk || !chaveOk) {
            throw new common_1.UnauthorizedException('Dispositivo não autorizado');
        }
        request.motorista = motorista;
        request.deviceUuid = vinculo.deviceUuid;
        request.grupoId = motorista.empresa.grupoId;
        return true;
    }
};
exports.MotoristaDeviceGuard = MotoristaDeviceGuard;
exports.MotoristaDeviceGuard = MotoristaDeviceGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MotoristaDeviceGuard);
//# sourceMappingURL=motorista-device.guard.js.map