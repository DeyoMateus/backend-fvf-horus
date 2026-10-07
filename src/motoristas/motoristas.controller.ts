import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { AtualizarStatusMotoristaDto } from './dto/atualizar-status-motorista.dto';
import { AtualizarCadastroMotoristaDto } from './dto/atualizar-cadastro-motorista.dto';
import { ExcluirMotoristaDto } from './dto/excluir-motorista.dto';
import { MotoristasService } from './motoristas.service';

@Controller('motoristas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MotoristasController {
  constructor(private readonly motoristasService: MotoristasService) {}

  @Post()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  create(
    @Body() dto: CreateMotoristaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    // grupoId vem do token, nunca do corpo da requisição , ver o
    // comentário em CreateMotoristaDto e em MotoristasService.create.
    return this.motoristasService.create(dto, user.grupoId, user.sub);
  }

  @Get()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('busca') busca?: string,
    @Query('incluirExcluidos') incluirExcluidos?: string,
  ) {
    // grupoId vem SEMPRE do token JWT, nunca de um parâmetro que o
    // cliente poderia trocar , do contrário qualquer usuário autenticado
    // poderia listar os motoristas de outro grupo só editando a URL.
    // Paginado (ver pagination.util) , sem limite, um grupo com
    // milhares de motoristas carregaria tudo de uma vez a cada acesso.
    return this.motoristasService.listByGrupo(
      user.grupoId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
      busca,
      incluirExcluidos === 'true',
    );
  }

  @Get(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.motoristasService.findById(id, user.grupoId);
  }

  /**
   * Edição dos dados cadastrais (nome/telefone) , Rodada 74. De
   * propósito é uma rota separada de `:id/status`: mexem em coisas
   * bem diferentes (identidade vs. situação do motorista) e ficam
   * mais fáceis de auditar separadas. CPF/CNH não entram aqui, ver
   * comentário em AtualizarCadastroMotoristaDto.
   */
  @Patch(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  atualizarCadastro(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarCadastroMotoristaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.motoristasService.atualizarCadastro(
      id,
      dto,
      user.sub,
      user.grupoId,
    );
  }

  @Patch(':id/status')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  atualizarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarStatusMotoristaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.motoristasService.atualizarStatus(
      id,
      dto,
      user.sub,
      user.grupoId,
    );
  }

  /**
   * "Excluir cadastro" (Rodada 65) , NÃO apaga a linha do motorista no
   * banco (ver MotoristasService.excluir): só tira da listagem normal
   * do painel. Todo o histórico (registros de jornada, alertas, folgas,
   * documentos de carga) continua intacto e encontrável, exatamente
   * como pedido.
   */
  @Delete(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  excluir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExcluirMotoristaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.motoristasService.excluir(
      id,
      dto.motivo,
      user.sub,
      user.grupoId,
    );
  }

  @Get(':id/alertas-integridade-dispositivo')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  alertasIntegridadeDispositivo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.motoristasService.listarAlertasIntegridadeDispositivo(
      id,
      user.grupoId,
    );
  }
}
