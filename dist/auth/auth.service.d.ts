import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { AccountLockoutService } from '../common/account-lockout/account-lockout.service';
export interface TokensResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly audit;
    private readonly email;
    private readonly lockout;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, audit: AuditService, email: EmailService, lockout: AccountLockoutService);
    private static readonly LOCKOUT_NAMESPACE;
    private hashToken;
    private emitirTokens;
    inatividadeMaxMs(): number;
    login(email: string, senha: string, ip?: string, userAgent?: string): Promise<TokensResponse>;
    refresh(refreshTokenPlano: string, ip?: string, userAgent?: string): Promise<TokensResponse>;
    logout(refreshTokenPlano: string): Promise<void>;
    esqueciSenha(email: string, ip?: string, userAgent?: string): Promise<void>;
    redefinirSenha(tokenPlano: string, novaSenha: string, ip?: string, userAgent?: string): Promise<void>;
}
