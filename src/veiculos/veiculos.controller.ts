import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ActorType, PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { VeiculosService } from './veiculos.service';

// Painel (ADMIN/GESTOR) , vincular/trocar a placa em nome do motorista
// (ex.: cadastro feito de uma vez, ou correção de um erro de digitação)
// e ver o histórico de trocas feitas pelo próprio motorista.
@Controller('motoristas/:motoristaId/veiculo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class VeiculosController {
  constructor(private readonly veiculosService: VeiculosService) {}

  @Put()
  atualizar(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Body() dto: AtualizarVeiculoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.veiculosService.atualizar(
      motoristaId,
      dto,
      { tipo: ActorType.USUARIO_EMPRESA, id: user.sub },
      user.grupoId,
    );
  }

  @Get()
  status(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.veiculosService.status(motoristaId, user.grupoId);
  }

  @Get('trocas')
  trocas(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.veiculosService.listarTrocas(motoristaId, user.grupoId);
  }
}
