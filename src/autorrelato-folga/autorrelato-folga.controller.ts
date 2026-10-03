import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AutorrelatoFolgaService } from './autorrelato-folga.service';

// Leitura pelo painel (empresa). O motorista só CRIA (ver
// AutorrelatoFolgaMobileController) , quem consulta é sempre a empresa.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutorrelatoFolgaController {
  constructor(private readonly service: AutorrelatoFolgaService) {}

  @Get('motoristas/:id/autorrelatos-folga')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  listarPorMotorista(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.listarPorMotorista(id, user.grupoId);
  }

  /**
   * "Radar" de dias sem interação , nenhum ponto batido e nenhuma folga
   * autorrelatada num dia. `dias` (padrão 7, máx. 90) é o tamanho da
   * janela pra trás, sem contar hoje (ainda não terminou).
   */
  @Get('motoristas/relatorios/dias-sem-interacao')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  diasSemInteracao(
    @Query('dias') dias: string | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.diasSemInteracao(
      user.grupoId,
      dias ? Number(dias) : undefined,
    );
  }
}
