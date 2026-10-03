import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { RelogioConfiavelService } from '../common/relogio-confiavel/relogio-confiavel.service';
import { AtualizarPushTokenDto } from './dto/atualizar-push-token.dto';
import { SincronizarRelogioDto } from './dto/sincronizar-relogio.dto';
import { DispositivosService } from './dispositivos.service';

// Usado pelo PRÓPRIO app do motorista (device binding), diferente do
// DispositivosController (painel da empresa) , por isso é um
// controller separado, com um guard diferente, mesmo cobrindo o mesmo
// "recurso" (dispositivo vinculado).
@Controller('dispositivo')
@UseGuards(MotoristaDeviceGuard)
export class DispositivosMobileController {
  constructor(
    private readonly dispositivosService: DispositivosService,
    private readonly relogioConfiavel: RelogioConfiavelService,
  ) {}

  @Patch('meu-push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async atualizarMeuPushToken(
    @Req() req: { motorista: { id: string } },
    @Body() dto: AtualizarPushTokenDto,
  ) {
    await this.dispositivosService.atualizarPushToken(
      req.motorista.id,
      dto.pushToken,
    );
  }

  /**
   * Rodada 92 , ver RelogioConfiavelService. Chamado pelo app ao abrir
   * (cold start) e sempre que a conectividade volta, não só ao bater
   * ponto: quanto mais cedo depois de um boot o app conseguir mandar
   * isto, menor a janela em que um toque fica sem nenhuma hora
   * confiável pra comparar na hora (ver checagem nº4 em
   * RegistrosJornadaService.create).
   */
  @Post('relogio/sincronizar')
  async sincronizarRelogio(
    @Req() req: { motorista: { id: string }; deviceUuid: string },
    @Body() dto: SincronizarRelogioDto,
  ): Promise<{ horaServidor: string }> {
    const { horaServidor } =
      await this.relogioConfiavel.registrarAmostraEResolverPendencias(
        req.motorista.id,
        req.deviceUuid,
        dto.elapsedRealtimeMs,
      );
    return { horaServidor: horaServidor.toISOString() };
  }
}
