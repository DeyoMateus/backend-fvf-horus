import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { AutorrelatoFolgaService } from './autorrelato-folga.service';
import { CreateAutorrelatoFolgaDto } from './dto/create-autorrelato-folga.dto';

const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Usado pelo próprio app do motorista , mesmo guard de device binding
// do resto do app (nunca o painel manda isto por ele).
@Controller('dispositivo')
@UseGuards(MotoristaDeviceGuard)
export class AutorrelatoFolgaMobileController {
  constructor(private readonly service: AutorrelatoFolgaService) {}

  @Post('autorrelato-folga')
  autorrelatar(
    @Req() req: { motorista: { id: string } },
    @Body() dto: CreateAutorrelatoFolgaDto,
  ) {
    return this.service.autorrelatar(req.motorista.id, dto);
  }

  // Rodada 57 , o motorista consegue conferir, no próprio app, os
  // avisos de folga que ele mandou ("meus pedidos"), pra além de
  // avisar. Ver `HorasScreen.tsx`/`HistoricoScreen.tsx` no mobile.
  @Get('autorrelatos-folga')
  listarMinhas(@Req() req: { motorista: { id: string } }) {
    return this.service.listarMinhas(req.motorista.id);
  }

  // Rodada 57 , chamado quando o motorista bate ponto num dia que ele
  // mesmo tinha avisado como folga e escolhe continuar mesmo assim (ver
  // `RegistrarPontoScreen.tsx`): anula o autorrelato daquele dia.
  @Delete('autorrelato-folga/:data')
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
