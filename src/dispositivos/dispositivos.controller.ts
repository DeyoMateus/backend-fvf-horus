import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DispositivosService } from './dispositivos.service';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';

// Vínculo/revogação de dispositivo do motorista , só a empresa
// (ADMIN/GESTOR) pode fazer isso, nunca o próprio motorista.
@Controller('motoristas/:motoristaId/dispositivo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  vincular(
    @Param('motoristaId') motoristaId: string,
    @Body() dto: VincularDispositivoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.dispositivosService.vincular(
      motoristaId,
      dto,
      user.sub,
      user.grupoId,
    );
  }

  @Get()
  status(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.dispositivosService.status(motoristaId, user.grupoId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  revogar(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.dispositivosService.revogar(
      motoristaId,
      user.sub,
      user.grupoId,
    );
  }
}
