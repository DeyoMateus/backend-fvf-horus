import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AncoraIntegridadeService } from './ancora-integridade.service';
import { RegistrosJornadaService } from './registros-jornada.service';

/**
 * Rodada 165: dispara periodicamente a verificação da cadeia de hashes de
 * todos os motoristas (`varrerIntegridadeCadeias`). Sem isto a cadeia só
 * era conferida quando alguém clicava em "Verificar integridade", então
 * uma alteração direta no banco só aparecia depois, se alguém olhasse.
 * Padrão igual ao `MonitoramentoJornadaAbertaService`: `setInterval` puro,
 * trava contra sobreposição, desligado em teste. Intervalo padrão: 1h
 * (`INTERVALO_VERIFICACAO_INTEGRIDADE_MS`); roda também na subida.
 */
@Injectable()
export class MonitoramentoIntegridadeCadeiaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    MonitoramentoIntegridadeCadeiaService.name,
  );
  private timer: NodeJS.Timeout | null = null;
  private emExecucao = false;

  constructor(
    private readonly registrosJornada: RegistrosJornadaService,
    private readonly ancora: AncoraIntegridadeService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const intervaloMs = Number(
      process.env.INTERVALO_VERIFICACAO_INTEGRIDADE_MS ?? 60 * 60 * 1000,
    );
    this.timer = setInterval(() => void this.executar(), intervaloMs);
    // Pequena espera na subida para não competir com o boot do backend.
    setTimeout(() => void this.executar(), 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async executar() {
    if (this.emExecucao) return;
    this.emExecucao = true;
    try {
      const r = await this.registrosJornada.varrerIntegridadeCadeias();
      this.logger.log(
        `Varredura de integridade: ${r.verificados} motorista(s), ${r.comViolacao} com divergência pendente, ${r.alertasCriados} alerta(s) novo(s).`,
      );
    } catch (err) {
      this.logger.warn(
        `Falha na varredura de integridade: ${(err as Error).message}`,
      );
    }
    // Rodada 167: compara com a âncora guardada fora do banco (R2).
    try {
      const a = await this.ancora.executar();
      this.logger.log(
        `Âncora de integridade: ${a.estado}` +
          (a.motoristas !== undefined
            ? ` (${a.motoristas} motorista(s))`
            : '') +
          (a.violacoes ? `, ${a.violacoes} violação(ões)` : '') +
          '.',
      );
    } catch (err) {
      this.logger.warn(
        `Falha na âncora de integridade: ${(err as Error).message}`,
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
