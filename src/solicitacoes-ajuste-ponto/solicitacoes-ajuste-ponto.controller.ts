import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { DecidirSolicitacaoDto } from './dto/decidir-solicitacao.dto';
import { SolicitacoesAjustePontoService } from './solicitacoes-ajuste-ponto.service';

// Painel (RH/gestor): ver e decidir os pedidos de ajuste que os
// motoristas mandaram pelo app. Só ADMIN/GESTOR , nunca o motorista.
// Rotas por motorista , dentro do namespace de Motoristas, igual a
// TratamentosPontoController.
@Controller('motoristas/:motoristaId/solicitacoes-ajuste-ponto')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class SolicitacoesAjustePontoPorMotoristaController {
  constructor(
    private readonly solicitacoesService: SolicitacoesAjustePontoService,
  ) {}

  @Get()
  list(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.solicitacoesService.listarPorMotorista(
      motoristaId,
      user.grupoId,
    );
  }
}

// Rotas gerais (não presas a um motorista específico) , a "caixa de
// entrada" de pendentes do RH, e as decisões.
@Controller('solicitacoes-ajuste-ponto')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class SolicitacoesAjustePontoGeralController {
  constructor(
    private readonly solicitacoesService: SolicitacoesAjustePontoService,
  ) {}

  @Get('pendentes')
  pendentes(@CurrentUser() user: UsuarioAutenticado) {
    return this.solicitacoesService.listarPendentesDoGrupo(user.grupoId);
  }

  // Pedido do usuário: histórico do que já foi decidido (aprovado ou
  // rejeitado), paginado , a caixa de entrada acima (`pendentes`) só
  // mostra o que ainda precisa de decisão.
  @Get('historico')
  historico(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ordem') ordem?: 'asc' | 'desc',
  ) {
    return this.solicitacoesService.listarHistoricoDoGrupo(
      user.grupoId,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
      ordem,
    );
  }

  // Cada decisão só mexe nesta solicitação , nunca em lote, nunca reabre
  // outra já decidida (ver comentário no service).
  @Patch(':id/aprovar')
  aprovar(
    @Param('id') id: string,
    @Body() dto: DecidirSolicitacaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.solicitacoesService.aprovar(
      id,
      dto.motivoDecisao,
      user.sub,
      user.grupoId,
    );
  }

  @Patch(':id/rejeitar')
  rejeitar(
    @Param('id') id: string,
    @Body() dto: DecidirSolicitacaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.solicitacoesService.rejeitar(
      id,
      dto.motivoDecisao ?? '',
      user.sub,
      user.grupoId,
    );
  }

  @Get('evidencias/:evidenciaId')
  async baixarEvidencia(
    @Param('evidenciaId') evidenciaId: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Res() res: Response,
  ) {
    const evidencia = await this.solicitacoesService.baixarEvidenciaDoPainel(
      evidenciaId,
      user.grupoId,
    );
    res.set({
      'Content-Type': evidencia.contentType,
      'Content-Disposition': `attachment; filename="${evidencia.nomeArquivo}"`,
    });
    res.send(evidencia.conteudo);
  }

  @Delete('evidencias/:evidenciaId')
  async removerEvidencia(
    @Param('evidenciaId') evidenciaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    await this.solicitacoesService.removerEvidenciaDoPainel(
      evidenciaId,
      user.grupoId,
    );
    return { ok: true };
  }
}
