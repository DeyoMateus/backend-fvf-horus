import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AjudanteDeviceGuard } from '../common/guards/ajudante-device.guard';
import { CreateRegistroJornadaAjudanteDto } from './dto/create-registro-jornada-ajudante.dto';
import { RegistrosJornadaAjudanteService } from './registros-jornada-ajudante.service';

// Usado pelo app do ajudante , mesmo mecanismo de device binding do
// motorista, cabeçalhos próprios (X-Ajudante-Id em vez de
// X-Motorista-Id) , ver AjudanteDeviceGuard.
@Controller('registros-jornada-ajudante')
@UseGuards(AjudanteDeviceGuard)
export class RegistrosJornadaAjudanteController {
  constructor(
    private readonly registrosService: RegistrosJornadaAjudanteService,
  ) {}

  @Post()
  create(
    @Req() req: { ajudante: { id: string }; deviceUuid: string },
    @Body() dto: CreateRegistroJornadaAjudanteDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.registrosService.create(
      req.ajudante.id,
      req.deviceUuid,
      dto,
      ip,
      userAgent,
    );
  }

  @Get('meu-historico')
  meuHistorico(@Req() req: { ajudante: { id: string } }) {
    return this.registrosService.listarPorAjudante(req.ajudante.id);
  }
}
