import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { MonitoramentoOperacionalService } from './monitoramento-operacional.service';

/**
 * Rodada 213: endpoint para o monitor EXTERNO (UptimeRobot, Better Stack...).
 * Responde 200 se tudo vai bem e 503 se banco, Redis ou WhatsApp falharem.
 * Público de propósito (monitores externos não autenticam) e sem detalhe
 * sensível: só rótulos curtos por verificação.
 */
@Controller('health')
export class MonitoramentoController {
  constructor(private readonly monitoramento: MonitoramentoOperacionalService) {}

  @Get('completo')
  @HttpCode(HttpStatus.OK)
  async completo() {
    const estado = await this.monitoramento.verificar();
    const corpo = {
      status: estado.saudavel ? 'ok' : 'erro',
      verificadoEm: estado.verificadoEm,
      verificacoes: Object.fromEntries(
        estado.verificacoes.map((v) => [v.chave, v.ok ? 'ok' : 'erro']),
      ),
    };
    if (!estado.saudavel) throw new ServiceUnavailableException(corpo);
    return corpo;
  }
}
