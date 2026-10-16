import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';

/**
 * Rodada 267: de hora em hora, nega os pedidos de folga que o RH não
 * respondeu até o dia pedido passar ("Não atendido no prazo"). Mesmo
 * padrão dos outros monitoramentos: `setInterval` puro, trava contra
 * sobreposição, desligado em teste, roda também pouco depois da subida.
 * Intervalo configurável em `INTERVALO_EXPIRACAO_FOLGA_MS`. Falha aqui
 * nunca afeta o motorista nem o ponto.
 */
@Injectable()
export class ExpiracaoSolicitacoesFolgaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExpiracaoSolicitacoesFolgaService.name);
  private timer: NodeJS.Timeout | null = null;
  private inicial: NodeJS.Timeout | null = null;
  private emExecucao = false;

  constructor(private readonly solicitacoes: SolicitacoesFolgaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const intervaloMs = Number(
      process.env.INTERVALO_EXPIRACAO_FOLGA_MS ?? 60 * 60 * 1000,
    );
    this.timer = setInterval(() => void this.executar(), intervaloMs);
    this.inicial = setTimeout(() => void this.executar(), 45_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.inicial) clearTimeout(this.inicial);
  }

  async executar(): Promise<number> {
    if (this.emExecucao) return 0;
    this.emExecucao = true;
    try {
      const negados = await TenantContext.paraSistema(() =>
        this.solicitacoes.negarPendentesVencidos(),
      );
      if (negados > 0) {
        this.logger.log(
          `${negados} pedido(s) de folga negado(s) automaticamente (não atendido no prazo).`,
        );
      }
      return negados;
    } catch (err) {
      this.logger.warn(
        `Falha ao expirar pedidos de folga: ${(err as Error).message}`,
      );
      return 0;
    } finally {
      this.emExecucao = false;
    }
  }
}
