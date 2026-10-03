import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { IndicadoresQueryDto } from './dto/indicadores-query.dto';
import { IndicadoresService } from './indicadores.service';

// Painel "Indicadores" (Rodada 36) , mesmo padrão de tenant do resto
// do painel: grupoId sempre vem do JWT, nunca de query/param.
@Controller('indicadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class IndicadoresController {
  constructor(private readonly indicadoresService: IndicadoresService) {}

  @Get()
  painel(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: IndicadoresQueryDto,
  ) {
    return this.indicadoresService.painel(
      user.grupoId,
      new Date(query.inicio),
      new Date(query.fim),
      query.motoristaId,
    );
  }

  // Geração de CSV é cara de IO (percorre todos os motoristas do
  // período) , mesmo limite mais estrito já usado no export de AEJ.
  @Get('exportar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async exportar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: IndicadoresQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.indicadoresService.exportarCsv(
      user.grupoId,
      new Date(query.inicio),
      new Date(query.fim),
      query.motoristaId,
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="indicadores-${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}.csv"`,
    });
    res.send(csv);
  }
}
