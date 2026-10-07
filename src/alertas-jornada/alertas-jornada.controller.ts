import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlertasJornadaService } from './alertas-jornada.service';
import { TratarAlertaDto } from './dto/tratar-alerta.dto';

// Painel da empresa (JWT + RBAC) , o app do motorista não lê alertas,
// eles são só para o RH/gestão acompanhar risco de infração.
@Controller('alertas-jornada')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class AlertasJornadaController {
  constructor(private readonly alertasService: AlertasJornadaService) {}

  @Get('motorista/:motoristaId')
  listByMotorista(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('naoVisualizados') naoVisualizados?: string,
  ) {
    return this.alertasService.listByMotorista(
      motoristaId,
      user.grupoId,
      naoVisualizados === 'true',
    );
  }

  // grupoId vem SEMPRE do token JWT, nunca do parâmetro de rota (que
  // existia antes e deixava qualquer gestor autenticado ler o radar de
  // qualquer outro grupo só trocando o id na URL).
  @Get('empresa/minha')
  listByEmpresa(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('naoVisualizados') naoVisualizados?: string,
  ) {
    return this.alertasService.listByGrupo(
      user.grupoId,
      naoVisualizados === 'true',
    );
  }

  @Patch(':alertaId/visualizar')
  marcarVisualizado(
    @Param('alertaId', ParseUUIDPipe) alertaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.alertasService.marcarVisualizado(
      alertaId,
      user.sub,
      user.grupoId,
    );
  }

  @Patch(':alertaId/tratar')
  tratar(
    @Param('alertaId', ParseUUIDPipe) alertaId: string,
    @Body() dto: TratarAlertaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.alertasService.tratar(
      alertaId,
      dto.observacao,
      user.sub,
      user.grupoId,
    );
  }
}
