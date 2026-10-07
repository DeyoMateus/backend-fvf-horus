import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { GerarHoleriteQueryDto } from './dto/gerar-holerite.dto';
import { gerarPdfHolerite } from './holerite-pdf.util';
import { HoleriteService } from './holerite.service';

const INCLUDE_EMPRESA_DOCUMENTO = {
  empresa: { select: { razaoSocial: true, cnpj: true } },
} as const;

// Só a empresa (ADMIN/GESTOR) gera o holerite , nunca o motorista (ele
// tem o próprio comprovante de pontos e, separadamente, o histórico de
// ajustes do gestor em dispositivo/meus-ajustes).
@Controller('motoristas/:motoristaId/holerite')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class HoleriteController {
  constructor(
    private readonly holeriteService: HoleriteService,
    private readonly prisma: PrismaService,
  ) {}

  // JSON , usado pela tela do painel pra mostrar a prévia antes de baixar o PDF.
  @Get()
  async calcular(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Query() query: GerarHoleriteQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.holeriteService.calcular(
      motoristaId,
      new Date(query.inicio),
      new Date(query.fim),
      {
        direcaoEspera: query.direcaoEspera !== 'false',
        normalExtra: query.normalExtra !== 'false',
        adicionalNoturno: query.adicionalNoturno !== 'false',
      },
      user.grupoId,
    );
  }

  @Get('pdf')
  async baixarPdf(
    @Param('motoristaId', ParseUUIDPipe) motoristaId: string,
    @Query() query: GerarHoleriteQueryDto,
    @CurrentUser() user: UsuarioAutenticado,
    @Res() res: Response,
  ) {
    const opcoes = {
      direcaoEspera: query.direcaoEspera !== 'false',
      normalExtra: query.normalExtra !== 'false',
      adicionalNoturno: query.adicionalNoturno !== 'false',
    };
    const resultado = await this.holeriteService.calcular(
      motoristaId,
      new Date(query.inicio),
      new Date(query.fim),
      opcoes,
      user.grupoId,
    );

    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: INCLUDE_EMPRESA_DOCUMENTO,
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const pdf = await gerarPdfHolerite(motorista, motorista.empresa, resultado);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="holerite-${motorista.nome.replace(/\s+/g, '-')}-${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
