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
import { EmailService } from '../common/email/email.service';
import { AccountLockoutService } from '../common/account-lockout/account-lockout.service';

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Hash bcrypt de uma senha que nunca é usada de verdade , só existe pra
 * `bcrypt.compare` ser chamado MESMO quando o e-mail não existe no
 * banco. Sem isso, `login()` respondia quase instantâneo pra e-mail
 * inexistente e ~100ms pra e-mail existente (custo do bcrypt real) ,
 * diferença de tempo suficiente pra um atacante enumerar e-mails
 * válidos medindo a latência da resposta, mesmo com a mensagem de erro
 * sendo idêntica nos dois casos. Gerado uma vez, custo 12 (igual ao
 * resto do sistema), de uma senha aleatória que não corresponde a
 * ninguém.
 */
const HASH_DUMMY_TEMPO_CONSTANTE =
  '$2b$12$K3JQ8h7g6qk5f1x9m2p8Ne7yj0dQb3sT1uV4wX6zC8aE0gH2iK4mO';

/**
 * Autenticação dos usuários da empresa (painel de gestão). Padrões
 * bancários aplicados:
 *  - Hash de senha com bcrypt (custo 12) , nunca senha em texto puro.
 *  - Access token JWT de vida curta (15 min) + refresh token de vida
 *    longa (7 dias) armazenado apenas como hash SHA-256 no banco
 *    (rotação a cada uso: refresh antigo é revogado ao emitir um novo).
 *  - Mensagens de erro genéricas em login (não revelam se o e-mail existe).
 *  - Toda tentativa de login (sucesso ou falha) vai para o audit log.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly lockout: AccountLockoutService,
    private readonly abuso: AbuseGuardService,
  ) {}

  private static readonly LOCKOUT_NAMESPACE = 'usuario-empresa';

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Rodada 65 , pedido explícito do usuário: "o login no painel do
   * gestor deve ficar válido até 5 horas sem atividade sem deslogar".
   *
   * O access token continua de vida curta (15min) só por boa prática
   * (é o que viaja em todo request; se vazar, expira rápido). Quem
   * decide "a sessão ainda vale?" é o refresh token , e ele agora usa
   * uma janela DESLIZANTE de inatividade (`JWT_INATIVIDADE_MAX_HORAS`,
   * padrão 5h), não um prazo fixo desde o login: toda vez que
   * `emitirTokens` roda de novo (login OU refresh , o interceptor do
   * frontend chama `/auth/refresh` sozinho sempre que uma chamada
   * qualquer volta 401 por access token vencido), a validade é
   * recalculada como "agora + 5h". Ou seja: enquanto o gestor continuar
   * usando o painel pelo menos uma vez a cada 5h, a sessão nunca
   * expira sozinha; só expira de verdade depois de 5h SEM nenhuma
   * chamada à API.
   */
  private async emitirTokens(usuario: {
    id: string;
    email: string;
    grupoId: string;
    papel: string;
  }): Promise<TokensResponse> {
    const accessTtlSegundos = Number(
      this.config.get<string>('JWT_ACCESS_TTL_SEGUNDOS', '900'),
    );
    const inatividadeMaxHoras = Number(
      this.config.get<string>('JWT_INATIVIDADE_MAX_HORAS', '5'),
    );

    const accessToken = await this.jwt.signAsync(
      {
        sub: usuario.id,
        email: usuario.email,
        grupoId: usuario.grupoId,
        papel: usuario.papel,
      },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSegundos,
      },
    );

    const refreshTokenPlano = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + inatividadeMaxHoras * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
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

  /** Milissegundos usados no `maxAge` do cookie de refresh , mesma janela de `emitirTokens` acima. */
  inatividadeMaxMs(): number {
    return (
      Number(this.config.get<string>('JWT_INATIVIDADE_MAX_HORAS', '5')) *
      60 *
      60 *
      1000
    );
  }

  async login(
    email: string,
    senha: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokensResponse> {
    // Bloqueio de conta (Rodada 35) , checado ANTES de tocar o banco,
    // complementar ao rate limit por IP (@Throttle no controller): esse
    // pega picos rápidos de UM IP, este pega tentativas lentas e
    // distribuídas contra UMA conta específica (credential stuffing).
    // Ver AccountLockoutService para o motivo de ser por e-mail (não
    // por ID), incluindo pra e-mail que nem existe.
    const segundosBloqueados = await this.lockout.segundosBloqueados(
      AuthService.LOCKOUT_NAMESPACE,
      email,
    );
    if (segundosBloqueados > 0) {
      throw new HttpException(
        `Muitas tentativas de login. Tente novamente em ${Math.ceil(segundosBloqueados / 60)} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { email },
    });

    // SEMPRE roda um bcrypt.compare, exista ou não o usuário , contra o
    // hash real quando existe, contra o dummy quando não existe. Isso
    // iguala o tempo de resposta dos dois casos (ver comentário do
    // HASH_DUMMY_TEMPO_CONSTANTE) , nunca pular a comparação com um
    // `if` que já revelaria a existência do e-mail pelo timing.
    const senhaOk = await bcrypt.compare(
      senha,
      usuario?.senhaHash ?? HASH_DUMMY_TEMPO_CONSTANTE,
    );

    if (!usuario || !usuario.ativo || !senhaOk) {
      await this.lockout.registrarFalha(AuthService.LOCKOUT_NAMESPACE, email);
      await this.abuso.registrarFalhaGlobalDeLogin();
      await this.abuso.atrasarSeEmDefesa();
      await this.audit.registrar({
        actorType: ActorType.USUARIO_EMPRESA,
        actorId: usuario?.id ?? null,
        acao: 'LOGIN_FALHOU',
        entidade: 'UsuarioEmpresa',
        entidadeId: usuario?.id ?? null,
        detalhes: { email },
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.lockout.registrarSucesso(AuthService.LOCKOUT_NAMESPACE, email);

    const tokens = await this.emitirTokens(usuario);

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuario.id,
      acao: 'LOGIN_SUCESSO',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuario.id,
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
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (
      !registro ||
      registro.revokedAt ||
      registro.expiresAt < new Date() ||
      !registro.usuario.ativo
    ) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Rotação: o refresh usado é imediatamente revogado.
    await this.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.emitirTokens(registro.usuario);

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: registro.usuario.id,
      acao: 'REFRESH_TOKEN_ROTACIONADO',
      entidade: 'UsuarioEmpresa',
      entidadeId: registro.usuario.id,
      ip,
      userAgent,
    });

    return tokens;
  }

  async logout(refreshTokenPlano: string): Promise<void> {
    const tokenHash = this.hashToken(refreshTokenPlano);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * "Esqueci minha senha" (Rodada 33). Resposta SEMPRE genérica pro
   * chamador (controller nunca diz se o e-mail existe) , aqui dentro,
   * se o e-mail não existir ou o usuário estiver inativo, o método
   * simplesmente não faz nada (não lança, não demora menos nem mais
   * de propósito perceptível). Token de recuperação: 1h de validade,
   * uso único (`usedAt`), guardado só como hash (mesmo padrão do
   * refresh token). Envio real do link fica a cargo do EmailService,
   * que já é fail-open (loga em MODO SIMULADO sem RESEND_API_KEY).
   */
  async esqueciSenha(
    email: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    // Limite por e-mail, independente do IP: evita encher a caixa da vítima
    // (e gastar o envio) com pedidos vindos de muitos IPs. Resposta idêntica.
    if (
      !(await this.abuso.permitirPorIdentidade(
        'esqueci-senha',
        email,
        3,
        60 * 60_000,
      ))
    ) {
      return;
    }
    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { email },
    });
    if (!usuario || !usuario.ativo) return;

    const tokenPlano = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: this.hashToken(tokenPlano),
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const link = `${frontendUrl}/redefinir-senha?token=${tokenPlano}`;

    await this.email.enviar(
      usuario.email,
      'Recuperação de senha , FVF Hórus',
      `<p>Foi solicitada uma recuperação de senha para sua conta no FVF Hórus.</p>` +
        `<p>Se foi você, clique no link abaixo para definir uma nova senha (válido por 1 hora):</p>` +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>Se não foi você, ignore este e-mail , sua senha atual continua válida.</p>`,
    );

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuario.id,
      acao: 'RECUPERACAO_SENHA_SOLICITADA',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuario.id,
      ip,
      userAgent,
    });
  }

  /**
   * Conclui a recuperação de senha: valida o token (existe, não usado,
   * não expirado, usuário ainda ativo), troca a senha, marca o token
   * como usado e revoga TODOS os refresh tokens ativos do usuário ,
   * qualquer sessão aberta em outro dispositivo é derrubada, já que
   * quem tinha acesso ao e-mail acabou de trocar a senha.
   */
  async redefinirSenha(
    tokenPlano: string,
    novaSenha: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(tokenPlano);
    const registro = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (
      !registro ||
      registro.usedAt ||
      registro.expiresAt < new Date() ||
      !registro.usuario.ativo
    ) {
      throw new UnauthorizedException(
        'Token de recuperação inválido ou expirado',
      );
    }

    const novoHash = await bcrypt.hash(novaSenha, 12);

    await this.prisma.$transaction([
      this.prisma.usuarioEmpresa.update({
        where: { id: registro.usuarioId },
        data: { senhaHash: novoHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: registro.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: registro.usuarioId,
      acao: 'SENHA_REDEFINIDA',
      entidade: 'UsuarioEmpresa',
      entidadeId: registro.usuarioId,
      ip,
      userAgent,
    });
  }
}
