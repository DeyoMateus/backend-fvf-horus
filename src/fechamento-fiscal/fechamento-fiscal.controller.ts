import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FechamentoFiscalQueryDto } from './dto/fechamento-fiscal.dto';
import { FechamentoFiscalService } from './fechamento-fiscal.service';

/**
 * Extração em lote dos documentos assinados (REP-P) para uma
 * fiscalização , ver comentário completo em FechamentoFiscalService.
 */
@Controller('fechamento-fiscal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class FechamentoFiscalController {
  constructor(
    private readonly fechamentoFiscalService: FechamentoFiscalService,
  ) {}

  // Geração em lote é cara de IO/CPU (um PDF completo por motorista +
  // merge) , mesmo limite mais estrito já usado nos outros exports
  // pesados (AEJ, holerite-fechamento, indicadores CSV).
  @Get('espelhos-rep-p/pdf')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async espelhosRepPPdf(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: FechamentoFiscalQueryDto,
    @Res() res: Response,
  ) {
    const motoristaIds = query.motoristaIds
      ? query.motoristaIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : null;
    const dataInicio = new Date(query.inicio);
    const dataFim = new Date(query.fim);

    const pdf = await this.fechamentoFiscalService.gerarEspelhosRepPEmLote(
      user.grupoId,
      dataInicio,
      dataFim,
      motoristaIds,
    );

    const sufixoPeriodo = `${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fiscalizacao-espelhos-rep-p-${sufixoPeriodo}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
