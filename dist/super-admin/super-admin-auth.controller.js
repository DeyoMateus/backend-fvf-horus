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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminAuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const config_1 = require("@nestjs/config");
const super_admin_auth_service_1 = require("./super-admin-auth.service");
const login_super_admin_dto_1 = require("./dto/login-super-admin.dto");
const esqueci_senha_super_admin_dto_1 = require("./dto/esqueci-senha-super-admin.dto");
const redefinir_senha_super_admin_dto_1 = require("./dto/redefinir-senha-super-admin.dto");
const refresh_cookie_util_1 = require("../common/cookies/refresh-cookie.util");
let SuperAdminAuthController = class SuperAdminAuthController {
    superAdminAuthService;
    config;
    constructor(superAdminAuthService, config) {
        this.superAdminAuthService = superAdminAuthService;
        this.config = config;
    }
    async login(dto, ip, res, userAgent) {
        const tokens = await this.superAdminAuthService.login(dto.email, dto.senha, ip, userAgent);
        (0, refresh_cookie_util_1.definirCookieRefreshSuperAdmin)(res, tokens.refreshToken, Number(this.config.get('JWT_REFRESH_TTL_DIAS', '7')) *
            24 *
            60 *
            60 *
            1000);
        return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
    }
    async refresh(req, ip, res, userAgent) {
        if (!(0, refresh_cookie_util_1.exigirRequisicaoDoFrontend)(req)) {
            throw new common_1.ForbiddenException('Requisição não reconhecida como vinda do próprio painel');
        }
        const refreshTokenAtual = (0, refresh_cookie_util_1.lerCookieRefreshSuperAdmin)(req);
        if (!refreshTokenAtual)
            throw new common_1.UnauthorizedException('Sessão expirada, faça login novamente');
        const tokens = await this.superAdminAuthService.refresh(refreshTokenAtual, ip, userAgent);
        (0, refresh_cookie_util_1.definirCookieRefreshSuperAdmin)(res, tokens.refreshToken, Number(this.config.get('JWT_REFRESH_TTL_DIAS', '7')) *
            24 *
            60 *
            60 *
            1000);
        return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
    }
    async logout(req, res) {
        if (!(0, refresh_cookie_util_1.exigirRequisicaoDoFrontend)(req)) {
            throw new common_1.ForbiddenException('Requisição não reconhecida como vinda do próprio painel');
        }
        const refreshTokenAtual = (0, refresh_cookie_util_1.lerCookieRefreshSuperAdmin)(req);
        if (refreshTokenAtual) {
            await this.superAdminAuthService.logout(refreshTokenAtual);
        }
        (0, refresh_cookie_util_1.limparCookieRefreshSuperAdmin)(res);
    }
    async esqueciSenha(dto, ip, userAgent) {
        await this.superAdminAuthService.esqueciSenha(dto.email, ip, userAgent);
    }
    async redefinirSenha(dto, ip, userAgent) {
        await this.superAdminAuthService.redefinirSenha(dto.token, dto.novaSenha, ip, userAgent);
    }
};
exports.SuperAdminAuthController = SuperAdminAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_super_admin_dto_1.LoginSuperAdminDto, String, Object, String]),
    __metadata("design:returntype", Promise)
], SuperAdminAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, String]),
    __metadata("design:returntype", Promise)
], SuperAdminAuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminAuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('esqueci-senha'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [esqueci_senha_super_admin_dto_1.EsqueciSenhaSuperAdminDto, String, String]),
    __metadata("design:returntype", Promise)
], SuperAdminAuthController.prototype, "esqueciSenha", null);
__decorate([
    (0, common_1.Post)('redefinir-senha'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [redefinir_senha_super_admin_dto_1.RedefinirSenhaSuperAdminDto, String, String]),
    __metadata("design:returntype", Promise)
], SuperAdminAuthController.prototype, "redefinirSenha", null);
exports.SuperAdminAuthController = SuperAdminAuthController = __decorate([
    (0, common_1.Controller)('super-admin/auth'),
    __metadata("design:paramtypes", [super_admin_auth_service_1.SuperAdminAuthService,
        config_1.ConfigService])
], SuperAdminAuthController);
//# sourceMappingURL=super-admin-auth.controller.js.map