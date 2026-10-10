import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { TratamentosPontoService } from './tratamentos-ponto.service';
import { contentDispositionAnexo } from '../common/arquivos/arquivo-seguro.util';

// Usado pelo app do motorista: ele vê os ajustes que a empresa lançou no
// próprio ponto (fechamentos, correções), baixa os comprovantes/evidências
// e pode dar ciência de que já leu , mas nunca contesta por aqui (isso se
// resolve conversando com a empresa, de propósito, ver Rodada 26). Só os
// ajustes dele mesmo, nunca de outro motorista , garantido pelo device
// binding (req.motorista.id vem do guard, nunca de parâmetro de rota).
@Controller('dispositivo/meus-ajustes')
@UseGuards(MotoristaDeviceGuard)
export class TratamentosPontoMobileController {
  constructor(private readonly tratamentosService: TratamentosPontoService) {}

  @Get()
  listarMeusAjustes(@Req() req: { motorista: { id: string } }) {
    return this.tratamentosService.listarMeusAjustes(req.motorista.id);
  }

  @Patch(':tratamentoId/ciencia')
  darCiencia(
    @Param('tratamentoId', ParseUUIDPipe) tratamentoId: string,
    @Req() req: { motorista: { id: string } },
  ) {
    return this.tratamentosService.darCiencia(tratamentoId, req.motorista.id);
  }

  @Get('evidencias/:evidenciaId')
  async baixarEvidencia(
    @Param('evidenciaId', ParseUUIDPipe) evidenciaId: string,
    @Req() req: { motorista: { id: string } },
    @Res() res: Response,
  ) {
    const evidencia = await this.tratamentosService.baixarEvidenciaDoMotorista(
      evidenciaId,
      req.motorista.id,
    );
    res.set({
      'Content-Type': evidencia.contentType,
      'Content-Disposition': contentDispositionAnexo(evidencia.nomeArquivo),
    });
    res.send(evidencia.conteudo);
  }
}
