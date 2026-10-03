import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { AlertasJornadaService } from './alertas-jornada.service';

// Usado pelo app do motorista: ele também pode ver os próprios alertas
// (além de receber push nos críticos) , só os dele, nunca de outro
// motorista, garantido pelo device binding (req.motorista.id vem do
// guard, nunca de um parâmetro de rota que o cliente poderia adulterar).
@Controller('dispositivo/meus-alertas')
@UseGuards(MotoristaDeviceGuard)
export class AlertasJornadaMobileController {
  constructor(private readonly alertasService: AlertasJornadaService) {}

  @Get()
  listarMeusAlertas(
    @Req() req: { motorista: { id: string } },
    @Query('naoVisualizados') naoVisualizados?: string,
  ) {
    // Sem grupoIdSolicitante de propósito: a identidade já foi garantida
    // pelo guard (req.motorista é ele mesmo), então não há checagem de
    // tenant a fazer , o motorista sempre pode ver os próprios alertas.
    return this.alertasService.listByMotorista(
      req.motorista.id,
      undefined,
      naoVisualizados === 'true',
    );
  }

  // Rodada 126 , pedido do usuário: o motorista também pode dar ciência
  // de que viu o alerta no próprio app. Idempotente; nunca remove nem
  // esconde o alerta (ele sempre permanece na listagem).
  @Patch(':alertaId/visualizar')
  marcarVisualizado(
    @Param('alertaId') alertaId: string,
    @Req() req: { motorista: { id: string } },
  ) {
    return this.alertasService.marcarVisualizadoPeloMotorista(
      alertaId,
      req.motorista.id,
    );
  }
}
