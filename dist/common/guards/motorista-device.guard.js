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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MotoristaDeviceGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoristaDeviceGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permitir_sem_ciencia_decorator_1 = require("../decorators/permitir-sem-ciencia.decorator");
const client_1 = require("@prisma/client");
const privacidade_textos_1 = require("../../privacidade/privacidade.textos");
const crypto_1 = require("crypto");
const device_key_hash_util_1 = require("../crypto/device-key-hash.util");
const device_auth_limiter_service_1 = require("../throttler/device-auth-limiter.service");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_context_1 = require("../tenant/tenant-context");
let MotoristaDeviceGuard = class MotoristaDeviceGuard {
    static { MotoristaDeviceGuard_1 = this; }
    prisma;
    limiter;
    reflector;
    constructor(prisma, limiter, reflector) {
        this.prisma = prisma;
        this.limiter = limiter;
        this.reflector = reflector;
    }
    static cienciasConfirmadas = new Set();
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip ?? 'desconhecido';
        await this.limiter.exigirNaoBloqueado(ip);
        const motoristaId = request.headers['x-motorista-id'];
        const deviceKey = request.headers['x-device-key'];
        const deviceUuid = request.headers['x-device-uuid'];
        if (!motoristaId ||
            !deviceKey ||
            !deviceUuid ||
            typeof motoristaId !== 'string' ||
            typeof deviceKey !== 'string' ||
            typeof deviceUuid !== 'string') {
            await this.limiter.registrarFalha(ip, 'sem-credenciais');
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
            await this.limiter.registrarFalha(ip, motoristaId);
            throw new common_1.UnauthorizedException('Dispositivo não autorizado');
        }
        const vinculo = motorista.dispositivoVinculado;
        const uuidRecebido = (0, crypto_1.createHash)('sha256').update(deviceUuid).digest();
        const uuidVinculado = (0, crypto_1.createHash)('sha256')
            .update(vinculo.deviceUuid)
            .digest();
        const uuidOk = (0, crypto_1.timingSafeEqual)(uuidRecebido, uuidVinculado);
        const { ok: chaveOk, precisaMigrar } = (0, device_key_hash_util_1.conferirChaveDispositivo)(deviceKey, vinculo.deviceApiKeyHash);
        if (!uuidOk || !chaveOk) {
            await this.limiter.registrarFalha(ip, motoristaId);
            throw new common_1.UnauthorizedException('Dispositivo não autorizado');
        }
        if (precisaMigrar) {
            void tenant_context_1.TenantContext.paraSistema(() => this.prisma.dispositivoVinculado.update({
                where: { id: vinculo.id },
                data: { deviceApiKeyHash: (0, device_key_hash_util_1.hashChaveDispositivo)(deviceKey) },
            })).catch(() => undefined);
        }
        await this.limiter.limitarUso(motoristaId);
        await this.exigirCienciaPrivacidade(context, motorista.id);
        request.motorista = motorista;
        request.deviceUuid = vinculo.deviceUuid;
        request.grupoId = motorista.empresa.grupoId;
        return true;
    }
    async exigirCienciaPrivacidade(context, motoristaId) {
        if (process.env.EXIGIR_CIENCIA_PRIVACIDADE === 'false')
            return;
        const liberada = this.reflector?.getAllAndOverride(permitir_sem_ciencia_decorator_1.PERMITIR_SEM_CIENCIA_KEY, [context.getHandler(), context.getClass()]);
        if (liberada)
            return;
        const chave = `${motoristaId}:${privacidade_textos_1.VERSAO_DOCUMENTOS}`;
        if (MotoristaDeviceGuard_1.cienciasConfirmadas.has(chave))
            return;
        const total = await tenant_context_1.TenantContext.paraSistema(() => this.prisma.aceitePrivacidade.count({
            where: { motoristaId, versao: privacidade_textos_1.VERSAO_DOCUMENTOS },
        }));
        if (total >= Object.values(client_1.TipoDocumentoPrivacidade).length) {
            if (MotoristaDeviceGuard_1.cienciasConfirmadas.size > 20000) {
                MotoristaDeviceGuard_1.cienciasConfirmadas.clear();
            }
            MotoristaDeviceGuard_1.cienciasConfirmadas.add(chave);
            return;
        }
        throw new common_1.HttpException({
            statusCode: 428,
            code: 'CIENCIA_PRIVACIDADE_PENDENTE',
            message: 'É necessário ler e dar ciência da Política de Privacidade e dos termos para usar o aplicativo.',
        }, 428);
    }
};
exports.MotoristaDeviceGuard = MotoristaDeviceGuard;
exports.MotoristaDeviceGuard = MotoristaDeviceGuard = MotoristaDeviceGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        device_auth_limiter_service_1.DeviceAuthLimiterService,
        core_1.Reflector])
], MotoristaDeviceGuard);
//# sourceMappingURL=motorista-device.guard.js.map