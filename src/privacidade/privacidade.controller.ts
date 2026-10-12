import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  PapelUsuario,
  StatusSolicitacaoTitular,
  TipoSolicitacaoTitular,
} from '@prisma/client';
import type { Motorista } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { PermitirSemCiencia } from '../common/decorators/permitir-sem-ciencia.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AtualizarEncarregadoDto,
  CriarSolicitacaoTitularDto,
  RegistrarAceiteDto,
  ResponderSolicitacaoTitularDto,
} from './dto/privacidade.dto';
import { PrivacidadeService } from './privacidade.service';

type RequisicaoMotorista = { motorista: Motorista; ip?: string };

/** Pública (sem login): a política precisa estar acessível a qualquer pessoa (LGPD art. 9º). */
@Controller('privacidade')
export class PrivacidadePublicaController {
  constructor(private readonly service: PrivacidadeService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('documentos')
  documentos() {
    return this.service.documentosPublicos();
  }
}

/** App do motorista (device binding). */
@Controller('dispositivo/privacidade')
@UseGuards(MotoristaDeviceGuard)
@PermitirSemCiencia()
export class PrivacidadeMobileController {
  constructor(private readonly service: PrivacidadeService) {}

  @Get()
  obter(@Req() req: RequisicaoMotorista) {
    return this.service.obterParaMotorista(req.motorista.id);
  }

  @Post('ciencia')
  ciencia(@Req() req: RequisicaoMotorista, @Body() dto: RegistrarAceiteDto) {
    return this.service.registrarAceite(
      req.motorista.id,
      dto.tipoDocumento,
      dto.versao,
      req.ip,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('solicitacoes')
  criar(
    @Req() req: RequisicaoMotorista,
    @Body() dto: CriarSolicitacaoTitularDto,
  ) {
    return this.service.criarSolicitacao(
      req.motorista.id,
      dto.tipo,
      dto.descricao,
    );
  }

  @Get('solicitacoes')
  minhasSolicitacoes(@Req() req: RequisicaoMotorista) {
    return this.service.listarDoMotorista(req.motorista.id);
  }

  /** Cópia dos dados do próprio motorista (LGPD art. 18, II e V). */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('meus-dados')
  meusDados(@Req() req: RequisicaoMotorista) {
    return this.service.exportarDadosDoMotorista(req.motorista.id);
  }
}

/** Painel da transportadora (JWT): pedidos dos titulares, ciências e encarregado. */
@Controller('privacidade/painel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrivacidadePainelController {
  constructor(private readonly service: PrivacidadeService) {}

  @Get('solicitacoes')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  solicitacoes(
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
    @Query('busca') busca?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('vencidas') vencidas?: string,
    @Query('ordem') ordem?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = (v?: string) => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    return this.service.listarParaPainel({
      status: status as StatusSolicitacaoTitular | undefined,
      tipo: tipo as TipoSolicitacaoTitular | undefined,
      busca: busca?.slice(0, 80),
      dataInicio: data(dataInicio),
      dataFim: data(dataFim),
      vencidas: vencidas === 'true',
      ordem: ordem === 'asc' ? 'asc' : 'desc',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('solicitacoes-pendentes')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  pendentes() {
    return this.service.listarPendentesParaSino();
  }

  @Patch('solicitacoes/:id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  responder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResponderSolicitacaoTitularDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.responderSolicitacao(id, user.grupoId, user.sub, dto);
  }

  @Get('ciencias')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  ciencias() {
    return this.service.situacaoDasCiencias();
  }

  @Get('encarregado')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  encarregado(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.obterEncarregado(user.grupoId);
  }

  @Put('encarregado')
  @Roles(PapelUsuario.ADMIN)
  atualizarEncarregado(
    @Body() dto: AtualizarEncarregadoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.atualizarEncarregado(user.grupoId, user.sub, dto);
  }
}
