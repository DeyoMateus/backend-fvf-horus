import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { CreateSolicitacaoFolgaDto } from './dto/create-solicitacao-folga.dto';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';

// App do motorista: pedir folga e acompanhar a resposta do RH. Nunca
// decide , isso é só do painel. Identidade sempre de req.motorista.id.
@Controller('dispositivo/minhas-solicitacoes-folga')
@UseGuards(MotoristaDeviceGuard)
export class SolicitacoesFolgaMobileController {
  constructor(private readonly service: SolicitacoesFolgaService) {}

  @Post()
  criar(
    @Req() req: { motorista: { id: string } },
    @Body() dto: CreateSolicitacaoFolgaDto,
  ) {
    return this.service.criar(req.motorista.id, dto);
  }

  @Get()
  listarMinhas(@Req() req: { motorista: { id: string } }) {
    return this.service.listarMinhas(req.motorista.id);
  }
}
