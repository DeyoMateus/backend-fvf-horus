import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CardPainel,
  ChaveIndicadorTendencia,
  DashboardService,
} from './dashboard.service';

const CARDS_VALIDOS: CardPainel[] = [
  'ativos',
  'em-direcao',
  'em-descanso',
  'em-espera',
  'jornada-aberta-sem-sub-evento',
  'sem-jornada-aberta',
  'sem-nenhum-registro',
  'alertas-criticos',
  'alertas-atencao',
  'alertas-24h',
  'risco-fraude-7d',
];

const INDICADORES_TENDENCIA_VALIDOS: ChaveIndicadorTendencia[] = [
  'registros',
  'alertasCritico',
  'alertasAtencao',
  'alertasInfo',
  'riscoFraude',
  'horasDirecao',
  'horasEspera',
  'horasIndefinido',
];

const REGEX_DIA = /^\d{4}-\d{2}-\d{2}$/;

// Painel do grupo (JWT + RBAC) , grupoId SEMPRE vem do token, nunca
// de parâmetro de rota (mesmo padrão do AlertasJornadaController, ver o
// comentário lá sobre o vazamento de tenant que isso corrigiu).
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo')
  resumo(@CurrentUser() user: UsuarioAutenticado) {
    return this.dashboardService.resumo(user.grupoId);
  }

  @Get('tendencia')
  tendencia(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('dias') dias?: string,
    // Pedido do usuário: além dos atalhos de 7/30/90 dias, poder
    // extrair os dados por um período que o próprio usuário define
    // (AAAA-MM-DD). Quando `desde`/`ate` vêm os dois juntos, prevalecem
    // sobre `dias`.
    @Query('desde') desde?: string,
    @Query('ate') ate?: string,
    // Fuso do computador de quem vê (min a leste do UTC).
    @Query('fusoOffsetMin') fusoOffsetMin?: string,
  ) {
    return this.dashboardService.tendencia(user.grupoId, {
      dias: dias ? Number(dias) : 30,
      desde,
      ate,
      fusoOffsetMin:
        fusoOffsetMin !== undefined ? Number(fusoOffsetMin) : undefined,
    });
  }

  /**
   * Detalhe por trás de um card do painel (clicar no card "Em direção"
   * abre a lista de motoristas em direção agora, por exemplo). `card`
   * é validado contra uma lista fechada , um valor desconhecido não
   * derruba a query, só volta uma lista vazia (ver default em
   * DashboardService.detalheCard).
   */
  @Get('detalhe')
  detalhe(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('card') card: string,
  ) {
    const cardValido = CARDS_VALIDOS.includes(card as CardPainel)
      ? (card as CardPainel)
      : ('' as CardPainel);
    return this.dashboardService.detalheCard(user.grupoId, cardValido);
  }

  /**
   * Detalhe por trás de um PONTO do gráfico de evolução (dia + indicador)
   * , clicar numa barra/ponto abre a lista das ações reais daquele dia,
   * mesmo espírito do `detalhe` acima só que por data em vez de estado
   * atual (drill-through, como no Power BI). `dia`/`indicador` inválidos
   * nunca derrubam a query , voltam uma lista vazia (mesmo padrão do
   * `card` inválido acima).
   */
  @Get('tendencia-detalhe')
  tendenciaDetalhe(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('dia') dia: string,
    @Query('indicador') indicador: string,
    @Query('fusoOffsetMin') fusoOffsetMin?: string,
  ) {
    const diaValido = REGEX_DIA.test(dia ?? '') ? dia : '1970-01-01';
    const indicadorValido = INDICADORES_TENDENCIA_VALIDOS.includes(
      indicador as ChaveIndicadorTendencia,
    )
      ? (indicador as ChaveIndicadorTendencia)
      : ('registros' as ChaveIndicadorTendencia);
    return this.dashboardService.tendenciaDetalhe(
      user.grupoId,
      diaValido,
      indicadorValido,
      fusoOffsetMin !== undefined ? Number(fusoOffsetMin) : undefined,
    );
  }
}
