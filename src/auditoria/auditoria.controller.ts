import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PapelUsuario, ActorType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from '../common/audit/audit.service';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto';

/**
 * Painel visual de trilha de auditoria (Rodada 66), versão ADMIN/GESTOR
 * , sempre restrito ao grupo de quem está logado (nunca um parâmetro na
 * URL: o grupoId vem do token, igual em todo o resto do painel). A
 * versão SUPER_ADMIN (sem essa restrição, todos os grupos) mora em
 * `SuperAdminController`.
 */
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class AuditoriaController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() filtro: ListarAuditoriaDto,
  ) {
    return this.audit.listar(
      {
        page: filtro.page,
        pageSize: filtro.pageSize,
        actorType: filtro.actorType,
        // Segunda camada de defesa (além do isolamento por grupoId, que já
        // torna ações do super admin estruturalmente invisíveis aqui): mesmo
        // que algum registro de auditoria do super admin algum dia carregue
        // um grupoId não nulo, o admin nunca deve enxergar ações SUPER_ADMIN.
        excluirActorTypes: [ActorType.SUPER_ADMIN],
        acoes: filtro.acoes,
        entidade: filtro.entidade,
        entidadeId: filtro.entidadeId,
        dataInicio: filtro.dataInicio ? new Date(filtro.dataInicio) : undefined,
        dataFim: filtro.dataFim ? new Date(filtro.dataFim) : undefined,
        ordem: filtro.ordem,
      },
      user.grupoId,
    );
  }

  // Alimenta o seletor visual ("selecionando os ocorridos") com os
  // tipos de ocorrência que de fato já existem neste grupo.
  @Get('ocorrencias')
  listarOcorrencias(@CurrentUser() user: UsuarioAutenticado) {
    return this.audit.listarTiposOcorridos(user.grupoId);
  }
}
