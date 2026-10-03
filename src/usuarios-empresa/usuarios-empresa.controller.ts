import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AtualizarStatusUsuarioEmpresaDto } from './dto/atualizar-status-usuario-empresa.dto';
import { UpdatePerfilProprioDto } from './dto/update-perfil-proprio.dto';
import { UsuariosEmpresaService } from './usuarios-empresa.service';

/**
 * Rodada 38: criar/ativar/desativar funcionário (ADMIN/GESTOR) de uma
 * empresa cliente passou a ser feito também pelo super admin da
 * plataforma (`SuperAdminController`,
 * `POST/PATCH super-admin/grupos/:grupoId/usuarios...`) , útil quando o
 * próprio grupo ainda não tem ninguém ativo pra fazer isso.
 *
 * Rodada 109: a listagem e o ativar/desativar foram reabertos aqui
 * também pro ADMIN do próprio grupo, sem depender do super admin ,
 * sempre restrito ao próprio `grupoId` (nunca aceita grupoId no
 * corpo/rota) e só pra ADMIN; GESTOR não tem acesso a nenhuma rota
 * deste controller além de `/me`.
 *
 * Rodada 110: cadastrar um usuário novo NÃO foi reaberto aqui (pedido
 * do usuário) , continua exclusividade do super admin. `criar()`
 * saiu deste controller; `UsuariosEmpresaService.create` continua
 * existindo (tem teste cobrindo) caso essa decisão mude de novo.
 */
@Controller('usuarios-empresa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosEmpresaController {
  constructor(
    private readonly usuariosEmpresaService: UsuariosEmpresaService,
  ) {}

  @Get()
  @Roles(PapelUsuario.ADMIN)
  listar(@CurrentUser() user: UsuarioAutenticado) {
    return this.usuariosEmpresaService.list(user.grupoId);
  }

  @Patch(':id/status')
  @Roles(PapelUsuario.ADMIN)
  atualizarStatus(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusUsuarioEmpresaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosEmpresaService.atualizarStatus(
      id,
      dto,
      user.grupoId,
      user.sub,
    );
  }

  @Get('me')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  obterMeuPerfil(@CurrentUser() user: UsuarioAutenticado) {
    return this.usuariosEmpresaService.obterMeuPerfil(user.sub);
  }

  @Patch('me')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  atualizarMeuPerfil(
    @Body() dto: UpdatePerfilProprioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.usuariosEmpresaService.atualizarMeuPerfil(user.sub, dto);
  }
}
