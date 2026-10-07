import { AbuseGuardService } from '../common/throttler/abuse-guard.service';
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ActorType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { TokensResponse } from '../auth/auth.service';
import { EmailService } from '../common/email/email.service';
import { AccountLockoutService } from '../common/account-lockout/account-lockout.service';

/**
 * Mesmo hash dummy de `AuthService` (custo constante no `bcrypt.compare`
 * mesmo quando o e-mail não existe) , ver o comentário completo lá.
 * Duplicado aqui de propósito, em vez de importado, porque as duas
 * tabelas (SuperAdminUsuario/UsuarioEmpresa) são independentes e não
 * deveriam ficar acopladas por um detalhe de implementação.
 */
const HASH_DUMMY_TEMPO_CONSTANTE =
  '$2b$12$K3JQ8h7g6qk5f1x9m2p8Ne7yj0dQb3sT1uV4wX6zC8aE0gH2iK4mO';

/**
 * Autenticação do super admin da plataforma (Rodada 31) , dono da FVF
 * Hórus, completamente separado da autenticação de UsuarioEmpresa
 * (`AuthService`): tabela própria (`SuperAdminUsuario`), refresh token
 * próprio (`SuperAdminRefreshToken`), cookie próprio (ver
 * `refresh-cookie.util.ts`), e o JWT emitido não tem `grupoId`/`papel`
 * , só `tipo: 'SUPER_ADMIN'`, o que faz o `TenantContextInterceptor`
 * rodar as chamadas dele como SISTEMA (bypass de RLS) automaticamente.
 * Mesmos padrões de segurança do AuthService: bcrypt custo 12, hash
 * dummy pra tempo constante, refresh rotativo, audit log de toda
 * tentativa (sucesso ou falha).
 */
@Injectable()
export class SuperAdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly lockout: AccountLockoutService,
    private readonly abuso: AbuseGuardService,
  ) {}

  private static readonly LOCKOUT_NAMESPACE = 'super-admin';

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async emitirTokens(superAdmin: {
    id: string;
    email: string;
  }): Promise<TokensResponse> {
    const accessTtlSegundos = Number(
      this.config.get<string>('JWT_ACCESS_TTL_SEGUNDOS', '900'),
    );
    const refreshTtlDias = Number(
      this.config.get<string>('JWT_REFRESH_TTL_DIAS', '7'),
    );

    const accessToken = await this.jwt.signAsync(
      { sub: superAdmin.id, email: superAdmin.email, tipo: 'SUPER_ADMIN' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSegundos,
      },
    );

    const refreshTokenPlano = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + refreshTtlDias * 24 * 60 * 60 * 1000,
    );

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

  async login(
    email: string,
    senha: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokensResponse> {
    // Bloqueio de conta (Rodada 35) , ver AuthService.login (mesmo
    // motivo, mesma lógica, namespace separado no Redis).
    const segundosBloqueados = await this.lockout.segundosBloqueados(
      SuperAdminAuthService.LOCKOUT_NAMESPACE,
      email,
    );
    if (segundosBloqueados > 0) {
      throw new HttpException(
        `Muitas tentativas de login. Tente novamente em ${Math.ceil(segundosBloqueados / 60)} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const superAdmin = await this.prisma.superAdminUsuario.findUnique({
      where: { email },
    });

    const senhaOk = await bcrypt.compare(
      senha,
      superAdmin?.senhaHash ?? HASH_DUMMY_TEMPO_CONSTANTE,
    );

    if (!superAdmin || !superAdmin.ativo || !senhaOk) {
      await this.lockout.registrarFalha(
        SuperAdminAuthService.LOCKOUT_NAMESPACE,
        email,
      );
      await this.abuso.registrarFalhaGlobalDeLogin();
      await this.abuso.atrasarSeEmDefesa();
      await this.audit.registrar({
        actorType: ActorType.SUPER_ADMIN,
        actorId: superAdmin?.id ?? null,
        acao: 'SUPER_ADMIN_LOGIN_FALHOU',
        entidade: 'SuperAdminUsuario',
        entidadeId: superAdmin?.id ?? null,
        detalhes: { email },
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.lockout.registrarSucesso(
      SuperAdminAuthService.LOCKOUT_NAMESPACE,
      email,
    );

    const tokens = await this.emitirTokens(superAdmin);

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdmin.id,
      acao: 'SUPER_ADMIN_LOGIN_SUCESSO',
      entidade: 'SuperAdminUsuario',
      entidadeId: superAdmin.id,
      ip,
      userAgent,
    });

    return tokens;
  }

  async refresh(
    refreshTokenPlano: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokensResponse> {
    const tokenHash = this.hashToken(refreshTokenPlano);
    const registro = await this.prisma.superAdminRefreshToken.findUnique({
      where: { tokenHash },
      include: { superAdmin: true },
    });

    if (
      !registro ||
      registro.revokedAt ||
      registro.expiresAt < new Date() ||
      !registro.superAdmin.ativo
    ) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    await this.prisma.superAdminRefreshToken.update({
      where: { id: registro.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.emitirTokens(registro.superAdmin);

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: registro.superAdmin.id,
      acao: 'SUPER_ADMIN_REFRESH_TOKEN_ROTACIONADO',
      entidade: 'SuperAdminUsuario',
      entidadeId: registro.superAdmin.id,
      ip,
      userAgent,
    });

    return tokens;
  }

  async logout(refreshTokenPlano: string): Promise<void> {
    const tokenHash = this.hashToken(refreshTokenPlano);
    await this.prisma.superAdminRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Espelha `AuthService.esqueciSenha` , ver o comentário completo lá
   * (resposta genérica, token de 1h de uso único, e-mail via
   * EmailService fail-open). Duplicado aqui em vez de compartilhado
   * pelo mesmo motivo do resto deste arquivo: nunca acoplar a conta do
   * super admin à de UsuarioEmpresa.
   */
  async esqueciSenha(
    email: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    if (
      !(await this.abuso.permitirPorIdentidade(
        'esqueci-senha-super-admin',
        email,
        3,
        60 * 60_000,
      ))
    ) {
      return;
    }
    const superAdmin = await this.prisma.superAdminUsuario.findUnique({
      where: { email },
    });
    if (!superAdmin || !superAdmin.ativo) return;

    const tokenPlano = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.superAdminPasswordResetToken.create({
      data: {
        superAdminId: superAdmin.id,
        tokenHash: this.hashToken(tokenPlano),
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const link = `${frontendUrl}/super-admin/redefinir-senha?token=${tokenPlano}`;

    await this.email.enviar(
      superAdmin.email,
      'Recuperação de senha , FVF Hórus (super admin)',
      `<p>Foi solicitada uma recuperação de senha para sua conta de super admin no FVF Hórus.</p>` +
        `<p>Se foi você, clique no link abaixo para definir uma nova senha (válido por 1 hora):</p>` +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>Se não foi você, ignore este e-mail , sua senha atual continua válida.</p>`,
    );

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdmin.id,
      acao: 'SUPER_ADMIN_RECUPERACAO_SENHA_SOLICITADA',
      entidade: 'SuperAdminUsuario',
      entidadeId: superAdmin.id,
      ip,
      userAgent,
    });
  }

  /** Espelha `AuthService.redefinirSenha` , ver o comentário completo lá. */
  async redefinirSenha(
    tokenPlano: string,
    novaSenha: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(tokenPlano);
    const registro = await this.prisma.superAdminPasswordResetToken.findUnique({
      where: { tokenHash },
      include: { superAdmin: true },
    });

    if (
      !registro ||
      registro.usedAt ||
      registro.expiresAt < new Date() ||
      !registro.superAdmin.ativo
    ) {
      throw new UnauthorizedException(
        'Token de recuperação inválido ou expirado',
      );
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
      actorType: ActorType.SUPER_ADMIN,
      actorId: registro.superAdminId,
      acao: 'SUPER_ADMIN_SENHA_REDEFINIDA',
      entidade: 'SuperAdminUsuario',
      entidadeId: registro.superAdminId,
      ip,
      userAgent,
    });
  }
}
