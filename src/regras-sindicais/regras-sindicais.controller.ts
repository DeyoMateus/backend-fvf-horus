import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRegraSindicalDto } from './dto/create-regra-sindical.dto';
import { UpdateRegraSindicalDto } from './dto/update-regra-sindical.dto';
import { RegrasSindicaisService } from './regras-sindicais.service';

// CCT/ACT , cadastro/edição é coisa de quem administra a conta (só
// ADMIN, não GESTOR): impacta como horas extras e adicional noturno são
// contados pra TODOS os motoristas dos CNPJs vinculados.
@Controller('regras-sindicais')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegrasSindicaisController {
  constructor(private readonly regrasService: RegrasSindicaisService) {}

  @Post()
  @Roles(PapelUsuario.ADMIN)
  create(
    @Body() dto: CreateRegraSindicalDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.regrasService.create(dto, user.grupoId, user.sub);
  }

  @Get()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(@CurrentUser() user: UsuarioAutenticado) {
    return this.regrasService.list(user.grupoId);
  }

  @Get(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  findOne(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.regrasService.findById(id, user.grupoId);
  }

  @Patch(':id')
  @Roles(PapelUsuario.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRegraSindicalDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.regrasService.update(id, dto, user.grupoId, user.sub);
  }

  // Nunca DELETE de verdade , só desativa (ver comentário no service).
  @Delete(':id')
  @Roles(PapelUsuario.ADMIN)
  desativar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.regrasService.desativar(id, user.grupoId, user.sub);
  }
}
