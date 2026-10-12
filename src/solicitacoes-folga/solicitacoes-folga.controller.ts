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
import { DecidirSolicitacaoFolgaDto } from './dto/decidir-solicitacao-folga.dto';
import { SolicitacoesFolgaService } from './solicitacoes-folga.service';

@Controller('motoristas/:motoristaId/solicitacoes-folga')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class SolicitacoesFolgaPorMotoristaController {
  constructor(private readonly service: SolicitacoesFolgaService) {}

  @Get()
  list(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.listarPorMotorista(motoristaId, user.grupoId);
  }
}

@Controller('solicitacoes-folga')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class SolicitacoesFolgaGeralController {
  constructor(private readonly service: SolicitacoesFolgaService) {}

  @Get('pendentes')
  pendentes(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.listarPendentesDoGrupo(user.grupoId);
  }

  @Get('pendentes/contagem')
  contagem(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.contarPendentesDoGrupo(user.grupoId);
  }

  @Get('historico')
  historico(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ordem') ordem?: 'asc' | 'desc',
  ) {
    return this.service.listarHistoricoDoGrupo(
      user.grupoId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
      ordem,
    );
  }

  @Patch(':id/aprovar')
  aprovar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecidirSolicitacaoFolgaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.aprovar(id, dto.motivoDecisao, user.sub, user.grupoId);
  }

  @Patch(':id/negar')
  negar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecidirSolicitacaoFolgaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.negar(
      id,
      dto.motivoDecisao ?? '',
      user.sub,
      user.grupoId,
    );
  }
}
