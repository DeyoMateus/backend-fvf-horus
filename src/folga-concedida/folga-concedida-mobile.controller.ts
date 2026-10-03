import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { FolgaConcedidaService } from './folga-concedida.service';

const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Rodada 58 , pedido do usuário: o mesmo comportamento do
// AutorrelatoFolga (avisar/anular ao bater ponto num dia de folga)
// vale também pra folga CONCEDIDA pela empresa. Usado pelo próprio app
// do motorista , mesmo guard de device binding do resto do app.
@Controller('dispositivo')
@UseGuards(MotoristaDeviceGuard)
export class FolgaConcedidaMobileController {
  constructor(private readonly service: FolgaConcedidaService) {}

  @Get('folgas-concedidas')
  listarMinhas(@Req() req: { motorista: { id: string } }) {
    return this.service.listarMinhas(req.motorista.id);
  }

  // Chamado quando o motorista bate ponto num dia que a empresa
  // concedeu como folga e escolhe continuar mesmo assim (ver
  // `RegistrarPontoScreen.tsx`): anula a folga concedida daquele dia.
  @Delete('folga-concedida/:data')
  anular(
    @Req() req: { motorista: { id: string } },
    @Param('data') data: string,
  ) {
    if (!REGEX_DATA_ISO.test(data)) {
      throw new BadRequestException(
        'Data inválida , use o formato AAAA-MM-DD.',
      );
    }
    return this.service.anular(req.motorista.id, data);
  }
}
