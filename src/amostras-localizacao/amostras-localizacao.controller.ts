import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { AmostrasLocalizacaoService } from './amostras-localizacao.service';
import { CreateAmostrasLocalizacaoDto } from './dto/create-amostras-localizacao.dto';

// Usado pelo próprio app do motorista (captura periódica em segundo
// plano, "luneta") , mesmo guard de device binding do resto do app.
@Controller('dispositivo')
@UseGuards(MotoristaDeviceGuard)
export class AmostrasLocalizacaoController {
  constructor(private readonly service: AmostrasLocalizacaoService) {}

  @Post('amostras-localizacao')
  registrar(
    @Req() req: { motorista: { id: string } },
    @Body() dto: CreateAmostrasLocalizacaoDto,
  ) {
    return this.service.registrarLote(req.motorista.id, dto.amostras);
  }
}
