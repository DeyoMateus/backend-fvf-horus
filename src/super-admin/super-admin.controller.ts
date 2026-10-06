import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentSuperAdmin } from '../common/decorators/current-user.decorator';
import type { SuperAdminAutenticado } from '../common/decorators/current-user.decorator';
import { CreateEmpresaMaeDto } from './dto/create-empresa-mae.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { AtualizarStatusEmpresaDto } from './dto/atualizar-status-empresa.dto';
import { DestinatariosWhatsappUsuarioDto } from './dto/destinatarios-whatsapp-usuario.dto';
import { UpdateUsuarioSuperAdminDto } from './dto/update-usuario-super-admin.dto';
import { CreateUsuarioGrupoDto } from './dto/create-usuario-grupo.dto';
import { AtualizarStatusUsuarioEmpresaDto } from '../usuarios-empresa/dto/atualizar-status-usuario-empresa.dto';
import { SuperAdminService } from './super-admin.service';
import { AuditService } from '../common/audit/audit.service';
import { ListarAuditoriaDto } from '../auditoria/dto/listar-auditoria.dto';

/**
 * Área do super admin (Rodada 31) , dono da plataforma FVF Hórus.
 * Provisiona clientes novos (Grupo + primeiro CNPJ + primeiro ADMIN),
 * acompanha todos os grupos cadastrados (quantos CNPJs, quantos
 * gestores e quantos motoristas cada um tem) e, desde a Rodada 32,
 * também edita esses cadastros depois de criados (razão social do
 * grupo/CNPJ, ativar/desativar um CNPJ, corrigir nome/e-mail de um
 * usuário). `SuperAdminGuard` garante que só um token de super admin
 * (nunca um de UsuarioEmpresa) chega até aqui.
 */
@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly audit: AuditService,
  ) {}

  @Post('grupos')
  criarEmpresaMae(
    @Body() dto: CreateEmpresaMaeDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.criarEmpresaMae(dto, superAdmin.sub);
  }

  @Get('grupos')
  listarGrupos() {
    return this.superAdminService.listarGrupos();
  }

  @Get('grupos/:id')
  obterGrupo(@Param('id') id: string) {
    return this.superAdminService.obterGrupo(id);
  }

  @Patch('grupos/:id')
  atualizarGrupo(
    @Param('id') id: string,
    @Body() dto: UpdateGrupoDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarGrupo(id, dto, superAdmin.sub);
  }

  @Patch('empresas/:id')
  atualizarEmpresa(
    @Param('id') id: string,
    @Body() dto: UpdateEmpresaDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarEmpresa(id, dto, superAdmin.sub);
  }

  @Patch('empresas/:id/status')
  atualizarStatusEmpresa(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusEmpresaDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarStatusEmpresa(
      id,
      dto.ativo,
      superAdmin.sub,
    );
  }

  /** Rodada 164: quem recebe alerta por WhatsApp. */
  @Patch('usuarios/:id/whatsapp-alertas')
  atualizarDestinatariosWhatsapp(
    @Param('id') id: string,
    @Body() dto: DestinatariosWhatsappUsuarioDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarDestinatariosWhatsapp(
      id,
      dto,
      superAdmin.sub,
    );
  }

  @Patch('usuarios/:id')
  atualizarUsuario(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioSuperAdminDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarUsuario(id, dto, superAdmin.sub);
  }

  // Rodada 38: criar/ativar/desativar funcionário (ADMIN/GESTOR) de um
  // grupo já existente virou exclusividade do super admin , o painel
  // da própria empresa perdeu a tela de Usuários.
  @Post('grupos/:grupoId/usuarios')
  criarUsuarioParaGrupo(
    @Param('grupoId') grupoId: string,
    @Body() dto: CreateUsuarioGrupoDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.criarUsuarioParaGrupo(
      grupoId,
      dto,
      superAdmin.sub,
    );
  }

  @Patch('grupos/:grupoId/usuarios/:usuarioId/status')
  atualizarStatusUsuarioGrupo(
    @Param('grupoId') grupoId: string,
    @Param('usuarioId') usuarioId: string,
    @Body() dto: AtualizarStatusUsuarioEmpresaDto,
    @CurrentSuperAdmin() superAdmin: SuperAdminAutenticado,
  ) {
    return this.superAdminService.atualizarStatusUsuarioGrupo(
      grupoId,
      usuarioId,
      dto,
      superAdmin.sub,
    );
  }

  // Painel visual de trilha de auditoria (Rodada 66), versão SUPER_ADMIN
  // , sem restrição de grupo por padrão (vê a plataforma inteira,
  // grupoId nulo incluso); `grupoId` na query deixa investigar um grupo
  // específico sem ter que logar como ele.
  @Get('auditoria')
  listarAuditoria(@Query() filtro: ListarAuditoriaDto) {
    return this.audit.listar(
      {
        page: filtro.page,
        pageSize: filtro.pageSize,
        actorType: filtro.actorType,
        acoes: filtro.acoes,
        entidade: filtro.entidade,
        entidadeId: filtro.entidadeId,
        dataInicio: filtro.dataInicio ? new Date(filtro.dataInicio) : undefined,
        dataFim: filtro.dataFim ? new Date(filtro.dataFim) : undefined,
        ordem: filtro.ordem,
      },
      filtro.grupoId ?? null,
    );
  }

  @Get('auditoria/ocorrencias')
  listarOcorrenciasAuditoria(@Query('grupoId') grupoId?: string) {
    return this.audit.listarTiposOcorridos(grupoId ?? null);
  }
}
