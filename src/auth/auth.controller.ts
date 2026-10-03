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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import {
  definirCookieRefresh,
  exigirRequisicaoDoFrontend,
  lerCookieRefresh,
  limparCookieRefresh,
} from '../common/cookies/refresh-cookie.util';

/**
 * Refresh token viaja só como cookie httpOnly (não mais no corpo JSON) ,
 * ver comentário em `refresh-cookie.util.ts` sobre por quê e sobre a
 * mitigação de CSRF que isso exige. `/auth/refresh` e `/auth/logout`
 * exigem o header anti-CSRF; `/auth/login` não precisa (é o próprio
 * ato de autenticar, não uma ação que se apoia numa sessão já aberta).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Anti-brute-force: no máximo 5 tentativas por minuto por IP neste endpoint.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tokens = await this.authService.login(
      dto.email,
      dto.senha,
      ip,
      userAgent,
    );
    definirCookieRefresh(
      res,
      tokens.refreshToken,
      this.authService.inatividadeMaxMs(),
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
    const refreshTokenAtual = lerCookieRefresh(req);
    if (!refreshTokenAtual)
      throw new UnauthorizedException('Sessão expirada, faça login novamente');

    const tokens = await this.authService.refresh(
      refreshTokenAtual,
      ip,
      userAgent,
    );
    definirCookieRefresh(
      res,
      tokens.refreshToken,
      this.authService.inatividadeMaxMs(),
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
    const refreshTokenAtual = lerCookieRefresh(req);
    if (refreshTokenAtual) {
      await this.authService.logout(refreshTokenAtual);
    }
    limparCookieRefresh(res);
  }

  // Resposta sempre 204 genérica, exista ou não o e-mail , a lógica de
  // não revelar isso mora no AuthService.esqueciSenha (ver lá).
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async esqueciSenha(
    @Body() dto: EsqueciSenhaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.esqueciSenha(dto.email, ip, userAgent);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async redefinirSenha(
    @Body() dto: RedefinirSenhaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.redefinirSenha(
      dto.token,
      dto.novaSenha,
      ip,
      userAgent,
    );
  }
}
