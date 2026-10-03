import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { VeiculosService } from './veiculos.service';

// Usado pelo próprio app do motorista , mesmo guard de device binding
// do resto do app. O motorista pode trocar a própria placa direto
// (sem aprovação do gestor), mas toda troca vira um alerta visível pro
// gestor no painel (ver VeiculosService.atualizar).
@Controller('dispositivo/veiculo')
@UseGuards(MotoristaDeviceGuard)
export class VeiculosMobileController {
  constructor(private readonly veiculosService: VeiculosService) {}

  @Put()
  atualizar(
    @Req() req: { motorista: { id: string } },
    @Body() dto: AtualizarVeiculoDto,
  ) {
    return this.veiculosService.atualizar(req.motorista.id, dto, {
      tipo: ActorType.MOTORISTA,
      id: req.motorista.id,
    });
  }

  @Get()
  status(@Req() req: { motorista: { id: string } }) {
    return this.veiculosService.status(req.motorista.id);
  }
}
