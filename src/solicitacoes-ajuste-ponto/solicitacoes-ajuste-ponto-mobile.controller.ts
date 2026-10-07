import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { CreateSolicitacaoAjusteDto } from './dto/create-solicitacao-ajuste.dto';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';

const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024;

// App do motorista: pedir um ajuste ("esqueci de bater") e acompanhar o
// que já pediu. Nunca aprova/rejeita , isso é só do RH pelo painel.
// Identidade sempre de req.motorista.id (device binding), nunca de
// parâmetro de rota.
@Controller('dispositivo/minhas-solicitacoes-ajuste')
@UseGuards(MotoristaDeviceGuard)
export class SolicitacoesAjustePontoMobileController {
  constructor(
    private readonly solicitacoesService: SolicitacoesAjustePontoService,
  ) {}

  @Post()
  criar(
    @Req() req: { motorista: { id: string } },
    @Body() dto: CreateSolicitacaoAjusteDto,
  ) {
    return this.solicitacoesService.criar(req.motorista.id, dto);
  }

  @Get()
  listarMinhas(@Req() req: { motorista: { id: string } }) {
    return this.solicitacoesService.listarMinhas(req.motorista.id);
  }

  @Post(':solicitacaoId/evidencias')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: TAMANHO_MAXIMO_EVIDENCIA_BYTES },
    }),
  )
  async anexarEvidencia(
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Req() req: { motorista: { id: string } },
  ) {
    if (!arquivo)
      throw new BadRequestException('Envie o arquivo no campo "arquivo"');
    return this.solicitacoesService.anexarEvidenciaDoMotorista(
      solicitacaoId,
      req.motorista.id,
      arquivo,
    );
  }

  @Get('evidencias/:evidenciaId')
  async baixarEvidencia(
    @Param('evidenciaId', ParseUUIDPipe) evidenciaId: string,
    @Req() req: { motorista: { id: string } },
    @Res() res: Response,
  ) {
    const evidencia = await this.solicitacoesService.baixarEvidenciaDoMotorista(
      evidenciaId,
      req.motorista.id,
    );
    res.set({
      'Content-Type': evidencia.contentType,
      'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
    });
    res.send(evidencia.conteudo);
  }

  @Delete('evidencias/:evidenciaId')
  async removerEvidencia(
    @Param('evidenciaId', ParseUUIDPipe) evidenciaId: string,
    @Req() req: { motorista: { id: string } },
  ) {
    await this.solicitacoesService.removerEvidenciaDoMotorista(
      evidenciaId,
      req.motorista.id,
    );
    return { ok: true };
  }
}
