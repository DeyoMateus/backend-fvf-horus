import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTratamentoPontoDto } from './dto/create-tratamento-ponto.dto';
import { TratamentosPontoService } from './tratamentos-ponto.service';
import { contentDispositionAnexo } from '../common/arquivos/arquivo-seguro.util';

const TAMANHO_MAXIMO_EVIDENCIA_BYTES = 25 * 1024 * 1024; // 25MB , Rodada 73

// Só a empresa (ADMIN/GESTOR) lança um tratamento de ponto , nunca o motorista.
@Controller('motoristas/:motoristaId/tratamentos-ponto')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class TratamentosPontoController {
  constructor(private readonly tratamentosService: TratamentosPontoService) {}

  @Post()
  create(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Body() dto: CreateTratamentoPontoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.tratamentosService.create(
      motoristaId,
      dto,
      user.sub,
      user.grupoId,
    );
  }

  // Rodada 139 , quais tipos de evento cabem na jornada do motorista
  // num horário (o painel usa pra só oferecer opções válidas).
  @Get('contexto')
  contexto(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Query('timestamp') timestamp: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const data = new Date(timestamp);
    if (!timestamp || Number.isNaN(data.getTime()))
      throw new BadRequestException('Informe "timestamp" em ISO 8601');
    return this.tratamentosService.contextoDoAjuste(
      motoristaId,
      data,
      user.grupoId,
    );
  }

  @Get()
  list(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.tratamentosService.listByMotorista(motoristaId, user.grupoId);
  }

  // Anexa uma evidência (print de rastreador, print de WhatsApp etc.) a um
  // tratamento já lançado , a lei exige que o fechamento de ponto feito
  // pelo gestor venha com prova junto.
  @Post(':tratamentoId/evidencias')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: TAMANHO_MAXIMO_EVIDENCIA_BYTES },
    }),
  )
  async anexarEvidencia(
    @Param('tratamentoId', ParseUUIDPipe) tratamentoId: string,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    if (!arquivo)
      throw new BadRequestException('Envie o arquivo no campo "arquivo"');
    return this.tratamentosService.anexarEvidencia(
      tratamentoId,
      arquivo,
      user.sub,
      user.grupoId,
    );
  }

  @Get('evidencias/:evidenciaId')
  async baixarEvidencia(
    @Param('evidenciaId', ParseUUIDPipe) evidenciaId: string,
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    await this.tratamentosService.verificarEvidenciaNoGrupo(
      evidenciaId,
      user.grupoId,
    );
    const evidencia =
      await this.tratamentosService.baixarEvidencia(evidenciaId);
    res.set({
      'Content-Type': evidencia.contentType,
      'Content-Disposition': contentDispositionAnexo(evidencia.nomeArquivo),
    });
    res.send(evidencia.conteudo);
  }

  // Rodada 73 , pedido do usuário: remover uma evidência precisa
  // remover dos dois lados, banco E storage externo (nunca só o link,
  // que deixaria o arquivo perdido no bucket sem nenhuma linha
  // apontando pra ele).
  @Delete('evidencias/:evidenciaId')
  async removerEvidencia(
    @Param('evidenciaId', ParseUUIDPipe) evidenciaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    await this.tratamentosService.removerEvidencia(
      evidenciaId,
      user.sub,
      user.grupoId,
    );
    return { ok: true };
  }
}
