import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BancoHorasService } from './banco-horas.service';
import { CriarAjusteBancoHorasDto } from './dto/criar-ajuste-banco-horas.dto';
import { SaldoBancoHorasQueryDto } from './dto/saldo-banco-horas-query.dto';

// Só a empresa (ADMIN/GESTOR) vê/gerencia o banco de horas , mesmo
// padrão do resto do painel de gestão de motorista.
@Controller('motoristas/:motoristaId/banco-horas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class BancoHorasController {
  constructor(private readonly bancoHorasService: BancoHorasService) {}

  @Get()
  saldo(
    @Param('motoristaId') motoristaId: string,
    @Query() query: SaldoBancoHorasQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.bancoHorasService.calcularSaldo(
      motoristaId,
      new Date(query.inicio),
      new Date(query.fim),
      user.grupoId,
    );
  }

  @Get('ajustes')
  ajustes(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.bancoHorasService.listarAjustes(motoristaId, user.grupoId);
  }

  @Post('ajustes')
  registrarAjuste(
    @Param('motoristaId') motoristaId: string,
    @Body() dto: CriarAjusteBancoHorasDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.bancoHorasService.registrarAjuste(
      motoristaId,
      user.grupoId,
      user.sub,
      {
        tipo: dto.tipo,
        minutos: dto.minutos,
        data: new Date(dto.data),
        observacao: dto.observacao,
      },
    );
  }
}
