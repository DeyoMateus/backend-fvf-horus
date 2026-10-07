import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFolgaConcedidaDto } from './dto/create-folga-concedida.dto';
import { FolgaConcedidaService } from './folga-concedida.service';

// Só a empresa (ADMIN/GESTOR) concede uma folga , nunca o motorista
// (isso é o AutorrelatoFolga, um fluxo separado e sem aprovação).
@Controller('motoristas/:motoristaId/folgas-concedidas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class FolgaConcedidaController {
  constructor(private readonly folgaConcedidaService: FolgaConcedidaService) {}

  @Post()
  conceder(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Body() dto: CreateFolgaConcedidaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.folgaConcedidaService.conceder(
      motoristaId,
      dto,
      user.sub,
      user.grupoId,
    );
  }

  @Get()
  listar(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.folgaConcedidaService.listarPorMotorista(
      motoristaId,
      user.grupoId,
    );
  }
}
