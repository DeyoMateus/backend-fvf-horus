"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SuperAdminAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminAuthService = void 0;
const abuse_guard_service_1 = require("../common/throttler/abuse-guard.service");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const audit_service_1 = require("../common/audit/audit.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const email_service_1 = require("../common/email/email.service");
const account_lockout_service_1 = require("../common/account-lockout/account-lockout.service");
const HASH_DUMMY_TEMPO_CONSTANTE = '$2b$12$K3JQ8h7g6qk5f1x9m2p8Ne7yj0dQb3sT1uV4wX6zC8aE0gH2iK4mO';
let SuperAdminAuthService = class SuperAdminAuthService {
    static { SuperAdminAuthService_1 = this; }
    prisma;
    jwt;
    config;
    audit;
    email;
    lockout;
    abuso;
    constructor(prisma, jwt, config, audit, email, lockout, abuso) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
        this.email = email;
        this.lockout = lockout;
        this.abuso = abuso;
    }
    static LOCKOUT_NAMESPACE = 'super-admin';
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    async emitirTokens(superAdmin) {
        const accessTtlSegundos = Number(this.config.get('JWT_ACCESS_TTL_SEGUNDOS', '900'));
        const refreshTtlDias = Number(this.config.get('JWT_REFRESH_TTL_DIAS', '7'));
        const accessToken = await this.jwt.signAsync({ sub: superAdmin.id, email: superAdmin.email, tipo: 'SUPER_ADMIN' }, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: accessTtlSegundos,
        });
        const refreshTokenPlano = (0, crypto_1.randomBytes)(48).toString('hex');
        const expiresAt = new Date(Date.now() + refreshTtlDias * 24 * 60 * 60 * 1000);
        await this.prisma.superAdminRefreshToken.create({
            data: {
                superAdminId: superAdmin.id,
                tokenHash: this.hashToken(refreshTokenPlano),
                expiresAt,
            },
        });
        return {
            accessToken,
            refreshToken: refreshTokenPlano,
            expiresIn: accessTtlSegundos,
        };
    }
    async login(email, senha, ip, userAgent) {
        const segundosBloqueados = await this.lockout.segundosBloqueados(SuperAdminAuthService_1.LOCKOUT_NAMESPACE, email);
        if (segundosBloqueados > 0) {
            throw new common_1.HttpException(`Muitas tentativas de login. Tente novamente em ${Math.ceil(segundosBloqueados / 60)} minuto(s).`, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const superAdmin = await this.prisma.superAdminUsuario.findUnique({
            where: { email },
        });
        const senhaOk = await bcrypt.compare(senha, superAdmin?.senhaHash ?? HASH_DUMMY_TEMPO_CONSTANTE);
        if (!superAdmin || !superAdmin.ativo || !senhaOk) {
            await this.lockout.registrarFalha(SuperAdminAuthService_1.LOCKOUT_NAMESPACE, email);
            await this.abuso.registrarFalhaGlobalDeLogin();
            await this.abuso.atrasarSeEmDefesa();
            await this.audit.registrar({
                actorType: client_1.ActorType.SUPER_ADMIN,
                actorId: superAdmin?.id ?? null,
                acao: 'SUPER_ADMIN_LOGIN_FALHOU',
                entidade: 'SuperAdminUsuario',
                entidadeId: superAdmin?.id ?? null,
                detalhes: { email },
                ip,
                userAgent,
            });
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        }
        await this.lockout.registrarSucesso(SuperAdminAuthService_1.LOCKOUT_NAMESPACE, email);
        const tokens = await this.emitirTokens(superAdmin);
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdmin.id,
            acao: 'SUPER_ADMIN_LOGIN_SUCESSO',
            entidade: 'SuperAdminUsuario',
            entidadeId: superAdmin.id,
            ip,
            userAgent,
        });
        return tokens;
    }
    async refresh(refreshTokenPlano, ip, userAgent) {
        const tokenHash = this.hashToken(refreshTokenPlano);
        const registro = await this.prisma.superAdminRefreshToken.findUnique({
            where: { tokenHash },
            include: { superAdmin: true },
        });
        if (!registro ||
            registro.revokedAt ||
            registro.expiresAt < new Date() ||
            !registro.superAdmin.ativo) {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado');
        }
        await this.prisma.superAdminRefreshToken.update({
            where: { id: registro.id },
            data: { revokedAt: new Date() },
        });
        const tokens = await this.emitirTokens(registro.superAdmin);
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: registro.superAdmin.id,
            acao: 'SUPER_ADMIN_REFRESH_TOKEN_ROTACIONADO',
            entidade: 'SuperAdminUsuario',
            entidadeId: registro.superAdmin.id,
            ip,
            userAgent,
        });
        return tokens;
    }
    async logout(refreshTokenPlano) {
        const tokenHash = this.hashToken(refreshTokenPlano);
        await this.prisma.superAdminRefreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async esqueciSenha(email, ip, userAgent) {
        if (!(await this.abuso.permitirPorIdentidade('esqueci-senha-super-admin', email, 3, 60 * 60_000))) {
            return;
        }
        const superAdmin = await this.prisma.superAdminUsuario.findUnique({
            where: { email },
        });
        if (!superAdmin || !superAdmin.ativo)
            return;
        const tokenPlano = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.prisma.superAdminPasswordResetToken.create({
            data: {
                superAdminId: superAdmin.id,
                tokenHash: this.hashToken(tokenPlano),
                expiresAt,
            },
        });
        const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
        const link = `${frontendUrl}/super-admin/redefinir-senha?token=${tokenPlano}`;
        await this.email.enviar(superAdmin.email, 'Recuperação de senha , FVF Hórus (super admin)', `<p>Foi solicitada uma recuperação de senha para sua conta de super admin no FVF Hórus.</p>` +
            `<p>Se foi você, clique no link abaixo para definir uma nova senha (válido por 1 hora):</p>` +
            `<p><a href="${link}">${link}</a></p>` +
            `<p>Se não foi você, ignore este e-mail , sua senha atual continua válida.</p>`);
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: superAdmin.id,
            acao: 'SUPER_ADMIN_RECUPERACAO_SENHA_SOLICITADA',
            entidade: 'SuperAdminUsuario',
            entidadeId: superAdmin.id,
            ip,
            userAgent,
        });
    }
    async redefinirSenha(tokenPlano, novaSenha, ip, userAgent) {
        const tokenHash = this.hashToken(tokenPlano);
        const registro = await this.prisma.superAdminPasswordResetToken.findUnique({
            where: { tokenHash },
            include: { superAdmin: true },
        });
        if (!registro ||
            registro.usedAt ||
            registro.expiresAt < new Date() ||
            !registro.superAdmin.ativo) {
            throw new common_1.UnauthorizedException('Token de recuperação inválido ou expirado');
        }
        const novoHash = await bcrypt.hash(novaSenha, 12);
        await this.prisma.$transaction([
            this.prisma.superAdminUsuario.update({
                where: { id: registro.superAdminId },
                data: { senhaHash: novoHash },
            }),
            this.prisma.superAdminPasswordResetToken.update({
                where: { id: registro.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.superAdminRefreshToken.updateMany({
                where: { superAdminId: registro.superAdminId, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        await this.audit.registrar({
            actorType: client_1.ActorType.SUPER_ADMIN,
            actorId: registro.superAdminId,
            acao: 'SUPER_ADMIN_SENHA_REDEFINIDA',
            entidade: 'SuperAdminUsuario',
            entidadeId: registro.superAdminId,
            ip,
            userAgent,
        });
    }
};
exports.SuperAdminAuthService = SuperAdminAuthService;
exports.SuperAdminAuthService = SuperAdminAuthService = SuperAdminAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        email_service_1.EmailService,
        account_lockout_service_1.AccountLockoutService,
        abuse_guard_service_1.AbuseGuardService])
], SuperAdminAuthService);
//# sourceMappingURL=super-admin-auth.service.js.map