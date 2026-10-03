import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Headers,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { EsqueciSenhaSuperAdminDto } from './dto/esqueci-senha-super-admin.dto';
import { RedefinirSenhaSuperAdminDto } from './dto/redefinir-senha-super-admin.dto';
import {
  definirCookieRefreshSuperAdmin,
  exigirRequisicaoDoFrontend,
  lerCookieRefreshSuperAdmin,
  limparCookieRefreshSuperAdmin,
} from '../common/cookies/refresh-cookie.util';

/**
 * Espelha `AuthController` (UsuarioEmpresa), mas pro super admin da
 * plataforma , cookie/path/token completamente separados (ver
 * `refresh-cookie.util.ts`). Rota própria (`/super-admin/auth/...`),
 * nunca `/auth/...`, pra nunca colidir com o painel de grupo.
 */
@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(
    private readonly superAdminAuthService: SuperAdminAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginSuperAdminDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tokens = await this.superAdminAuthService.login(
      dto.email,
      dto.senha,
      ip,
      userAgent,
    );
    // Rodada 65 não muda o super admin , continua em dias (não é o
    // "painel do gestor" a que o pedido se referia). `definirCookieRefreshSuperAdmin`
    // passou a receber milissegundos (ver refresh-cookie.util.ts), então o
    // valor em dias é convertido aqui, no ponto de chamada.
    definirCookieRefreshSuperAdmin(
      res,
      tokens.refreshToken,
      Number(this.config.get<string>('JWT_REFRESH_TTL_DIAS', '7')) *
        24 *
        60 *
        60 *
        1000,
    );
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!exigirRequisicaoDoFrontend(req)) {
      throw new ForbiddenException(
        'Requisição não reconhecida como vinda do próprio painel',
      );
    }
    const refreshTokenAtual = lerCookieRefreshSuperAdmin(req);
    if (!refreshTokenAtual)
      throw new UnauthorizedException('Sessão expirada, faça login novamente');

    const tokens = await this.superAdminAuthService.refresh(
      refreshTokenAtual,
      ip,
      userAgent,
    );
    definirCookieRefreshSuperAdmin(
      res,
      tokens.refreshToken,
      Number(this.config.get<string>('JWT_REFRESH_TTL_DIAS', '7')) *
        24 *
        60 *
        60 *
        1000,
    );
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!exigirRequisicaoDoFrontend(req)) {
      throw new ForbiddenException(
        'Requisição não reconhecida como vinda do próprio painel',
      );
    }
    const refreshTokenAtual = lerCookieRefreshSuperAdmin(req);
    if (refreshTokenAtual) {
      await this.superAdminAuthService.logout(refreshTokenAtual);
    }
    limparCookieRefreshSuperAdmin(res);
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async esqueciSenha(
    @Body() dto: EsqueciSenhaSuperAdminDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.superAdminAuthService.esqueciSenha(dto.email, ip, userAgent);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async redefinirSenha(
    @Body() dto: RedefinirSenhaSuperAdminDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.superAdminAuthService.redefinirSenha(
      dto.token,
      dto.novaSenha,
      ip,
      userAgent,
    );
  }
}
