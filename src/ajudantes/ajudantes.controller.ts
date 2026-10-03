import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AjudantesService } from './ajudantes.service';
import { CreateAjudanteDto } from './dto/create-ajudante.dto';
import { AtualizarStatusAjudanteDto } from './dto/atualizar-status-ajudante.dto';
import { ExcluirAjudanteDto } from './dto/excluir-ajudante.dto';
import { VincularDispositivoAjudanteDto } from './dto/vincular-dispositivo-ajudante.dto';

@Controller('ajudantes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AjudantesController {
  constructor(private readonly ajudantesService: AjudantesService) {}

  @Post()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  create(@Body() dto: CreateAjudanteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.ajudantesService.create(dto, user.grupoId, user.sub);
  }

  @Get()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('busca') busca?: string,
    @Query('incluirExcluidos') incluirExcluidos?: string,
  ) {
    return this.ajudantesService.listByGrupo(
      user.grupoId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
      busca,
      incluirExcluidos === 'true',
    );
  }

  @Get(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  findOne(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.ajudantesService.findById(id, user.grupoId);
  }

  @Patch(':id/status')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  atualizarStatus(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusAjudanteDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.ajudantesService.atualizarStatus(id, dto, user.sub, user.grupoId);
  }

  @Delete(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  excluir(@Param('id') id: string, @Body() dto: ExcluirAjudanteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.ajudantesService.excluir(id, dto.motivo, user.sub, user.grupoId);
  }

  // ===== Device binding =====

  @Post(':id/dispositivo')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  vincularDispositivo(
    @Param('id') id: string,
    @Body() dto: VincularDispositivoAjudanteDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.ajudantesService.vincularDispositivo(id, dto, user.sub, user.grupoId);
  }

  @Get(':id/dispositivo')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  statusDispositivo(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.ajudantesService.statusDispositivo(id, user.grupoId);
  }

  @Delete(':id/dispositivo')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  revogarDispositivo(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.ajudantesService.revogarDispositivo(id, user.sub, user.grupoId);
  }
}
