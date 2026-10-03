import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListarDossieCobrancaDto } from './dto/listar-dossie-cobranca.dto';
import { DossieCobrancaService } from './dossie-cobranca.service';
import { gerarPdfDossieCobranca } from './dossie-cobranca-pdf.util';

/**
 * Extração do Dossiê de Cobrança (Rodada 66, pedido do usuário: "em
 * fechamento precisa do recurso de extração do dossiê de cobrança") ,
 * ver comentário completo em DossieCobrancaService.
 */
@Controller('dossie-cobranca')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class DossieCobrancaController {
  constructor(
    private readonly dossieService: DossieCobrancaService,
    private readonly prisma: PrismaService,
  ) {}

  // Preview na tela (painel "Fechamento") antes de decidir extrair o PDF.
  @Get()
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: ListarDossieCobrancaDto,
  ) {
    return this.dossieService.listar(
      user.grupoId,
      new Date(query.inicio),
      new Date(query.fim),
      query.motoristaId,
    );
  }

  @Get('pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async pdf(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: ListarDossieCobrancaDto,
    @Res() res: Response,
  ) {
    const dataInicio = new Date(query.inicio);
    const dataFim = new Date(query.fim);
    const itens = await this.dossieService.listar(
      user.grupoId,
      dataInicio,
      dataFim,
      query.motoristaId,
    );

    // Empresa "de referência" pra cabeçalho do PDF , quando o grupo tem
    // vários CNPJs, usa o primeiro só pra identificação visual (o
    // dossiê é sempre por motorista, cada um já mostra o próprio nome).
    const empresa = await this.prisma.empresa.findFirst({
      where: { grupoId: user.grupoId },
      select: { razaoSocial: true },
    });

    const pdf = await gerarPdfDossieCobranca(
      itens,
      empresa?.razaoSocial ?? 'Empresa',
      dataInicio,
      dataFim,
    );
    const sufixoPeriodo = `${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dossie-cobranca-${sufixoPeriodo}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
