import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CreateDocumentoCargaDto } from './dto/create-documento-carga.dto';
import { DocumentosCargaService } from './documentos-carga.service';

const TAMANHO_MAXIMO_XML_BYTES = 5 * 1024 * 1024; // 5MB , um CT-e/MDF-e real tem no máximo algumas centenas de KB

@Controller('documentos-carga')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class DocumentosCargaController {
  constructor(private readonly service: DocumentosCargaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: TAMANHO_MAXIMO_XML_BYTES },
    }),
  )
  upload(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Body() dto: CreateDocumentoCargaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    if (!arquivo)
      throw new BadRequestException('Envie o arquivo XML no campo "arquivo"');
    if (!arquivo.originalname.toLowerCase().endsWith('.xml')) {
      throw new BadRequestException('Só arquivos .xml são aceitos');
    }
    // Confere o CONTEÚDO, não só a extensão do nome (que o cliente
    // escolhe livremente) , um binário qualquer renomeado pra .xml não
    // passa mais disso. Ainda é uma checagem best-effort (não valida
    // schema oficial do CT-e/MDF-e, só que É um XML de verdade), igual
    // ao resto da extração de metadados desta feature.
    const inicioArquivo = arquivo.buffer
      .subarray(0, 512)
      .toString('utf-8')
      .trimStart();
    if (!inicioArquivo.startsWith('<?xml') && !inicioArquivo.startsWith('<')) {
      throw new BadRequestException(
        'O conteúdo do arquivo não parece ser um XML válido',
      );
    }
    return this.service.upload(user.grupoId, user.sub, dto, arquivo);
  }

  @Get()
  list(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ordem') ordem?: 'asc' | 'desc',
    @Query('tipo') tipo?: 'CTE' | 'MDFE',
    @Query('statusCarga') statusCarga?: 'CARREGADO' | 'VAZIO',
    @Query('motoristaId') motoristaId?: string,
    @Query('numero') numero?: string,
    @Query('chaveAcesso') chaveAcesso?: string,
  ) {
    return this.service.listByGrupo(
      user.grupoId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
      ordem,
      { tipo, statusCarga, motoristaId, numero, chaveAcesso },
    );
  }

  @Get('motorista/:motoristaId')
  listByMotorista(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.listByMotorista(motoristaId, user.grupoId);
  }

  @Get('motorista/:motoristaId/status-atual')
  statusAtual(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.statusAtualPorMotorista(motoristaId, user.grupoId);
  }

  @Delete(':id')
  remover(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.remover(id, user.sub, user.grupoId);
  }

  @Get(':id/xml')
  async baixarXml(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('inline') inline?: string,
  ) {
    const documento = await this.service.baixarXml(id, user.grupoId);
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `${inline === 'true' ? 'inline' : 'attachment'}; filename="${documento.tipo.toLowerCase()}-${documento.numero ?? documento.id}.xml"`,
    });
    res.send(documento.xmlOriginal);
  }
}
