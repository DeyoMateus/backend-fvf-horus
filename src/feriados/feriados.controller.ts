import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFeriadoDto } from './dto/create-feriado.dto';
import { UpdateFeriadoDto } from './dto/update-feriado.dto';
import { FeriadosService } from './feriados.service';

// Cadastro de feriados aceitos pela empresa (Rodada 29) , mesmo
// critério de RegrasSindicaisController: só ADMIN mexe (afeta o
// cálculo de horas extras/adicional noturno pra todos os motoristas
// dos CNPJs cobertos), GESTOR só lê.
@Controller('feriados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeriadosController {
  constructor(private readonly feriadosService: FeriadosService) {}

  @Post()
  @Roles(PapelUsuario.ADMIN)
  create(
    @Body() dto: CreateFeriadoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.feriadosService.create(dto, user.grupoId, user.sub);
  }

  @Get()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(@CurrentUser() user: UsuarioAutenticado) {
    return this.feriadosService.list(user.grupoId);
  }

  @Get(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.feriadosService.findById(id, user.grupoId);
  }

  @Patch(':id')
  @Roles(PapelUsuario.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeriadoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.feriadosService.update(id, dto, user.grupoId, user.sub);
  }

  // Nunca DELETE de verdade , só desativa (ver comentário no service).
  @Delete(':id')
  @Roles(PapelUsuario.ADMIN)
  desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.feriadosService.desativar(id, user.grupoId, user.sub);
  }
}
