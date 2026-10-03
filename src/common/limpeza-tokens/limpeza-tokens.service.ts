import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Limpeza periódica das tabelas de token (Rodada 80, pedido do
 * usuário: "manter essas informações não seria encher o banco de
 * dados sem necessidade?"). Até esta rodada, `refresh_tokens`,
 * `password_reset_tokens` e as duas equivalentes do super admin
 * (`super_admin_refresh_tokens`, `super_admin_password_reset_tokens`)
 * nunca perdiam linha nenhuma: cada login cria uma, e nem o logout
 * apaga (só marca `revokedAt`) , cresce pra sempre sem limite.
 *
 * Não apaga no MOMENTO em que expira/é revogado/é usado , mantém uma
 * margem (`DIAS_RETENCAO_TOKENS_EXPIRADOS`, 30 dias por padrão) pra
 * dar tempo de auditar uma sessão recente antes da linha sumir (ex.:
 * "quando essa sessão foi revogada mesmo?"). Só apaga o que já perdeu
 * toda utilidade: `expiresAt` no passado há mais que essa margem ,
 * cobre token revogado, usado (reset de senha) ou simplesmente nunca
 * usado até expirar, sem precisar de uma condição por tabela.
 *
 * Mesmo padrão de `MonitoramentoJornadaAbertaService`: `setInterval`
 * puro (não `@nestjs/schedule`, pra não somar dependência nova),
 * trava simples contra sobreposição, desligado em teste.
 */
@Injectable()
export class LimpezaTokensService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LimpezaTokensService.name);
  private timer: NodeJS.Timeout | null = null;
  private emExecucao = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const intervaloMs = Number(
      process.env.INTERVALO_LIMPEZA_TOKENS_MS ?? 24 * 60 * 60 * 1000,
    ); // 1x/dia por padrão
    this.timer = setInterval(() => void this.executar(), intervaloMs);
    // Roda uma vez já na subida do backend também, sem esperar o
    // primeiro intervalo inteiro , mesmo raciocínio do monitoramento
    // de jornada aberta.
    void this.executar();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async executar() {
    if (this.emExecucao) return; // trava contra sobreposição se a limpeza anterior ainda não terminou
    this.emExecucao = true;
    try {
      const diasRetencao = Number(
        process.env.DIAS_RETENCAO_TOKENS_EXPIRADOS ?? 30,
      );
      const limite = new Date(Date.now() - diasRetencao * 24 * 60 * 60 * 1000);

      const [refresh, resetSenha, superAdminRefresh, superAdminResetSenha] =
        await Promise.all([
          this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: limite } },
          }),
          this.prisma.passwordResetToken.deleteMany({
            where: { expiresAt: { lt: limite } },
          }),
          this.prisma.superAdminRefreshToken.deleteMany({
            where: { expiresAt: { lt: limite } },
          }),
          this.prisma.superAdminPasswordResetToken.deleteMany({
            where: { expiresAt: { lt: limite } },
          }),
        ]);

      const total =
        refresh.count +
        resetSenha.count +
        superAdminRefresh.count +
        superAdminResetSenha.count;
      if (total > 0) {
        this.logger.log(
          `Limpeza de tokens expirados: ${refresh.count} refresh, ${resetSenha.count} reset de senha, ` +
            `${superAdminRefresh.count} refresh (super admin), ${superAdminResetSenha.count} reset de senha (super admin).`,
        );
      }
    } catch (err) {
      // Fail-open: um erro aqui nunca pode derrubar o processo do backend.
      this.logger.warn(
        `Falha na limpeza de tokens expirados: ${(err as Error).message}`,
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
