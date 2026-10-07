import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DispositivosService } from './dispositivos.service';
import { RejeitarSolicitacaoTrocaDto } from './dto/rejeitar-solicitacao-troca.dto';
import { SolicitarTrocaDispositivoDto } from './dto/solicitar-troca-dispositivo.dto';

@Controller('solicitacoes-troca-dispositivo')
export class SolicitacoesTrocaDispositivoController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  // De propósito SEM guard: é exatamente o caso em que o motorista
  // perdeu/trocou de aparelho e não tem mais credencial de device
  // válida pra se autenticar de nenhum outro jeito. Não concede acesso
  // nenhum por si só , só cria um pedido que fica esperando o gestor.
  // Protegido na borda por rate limiting agressivo, não por auth.
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  solicitar(@Body() dto: SolicitarTrocaDispositivoDto) {
    return this.dispositivosService.solicitarTroca(dto);
  }

  // A partir daqui, só ADMIN/GESTOR do próprio grupo (JWT). Note que
  // grupoId vem do token, nunca de um parâmetro que o cliente
  // poderia adulterar pra ver a fila de outro grupo.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  listarPendentes(@CurrentUser() user: UsuarioAutenticado) {
    return this.dispositivosService.listarSolicitacoesPendentes(user.grupoId);
  }

  @Patch(':id/aprovar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  aprovar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.dispositivosService.aprovarTroca(id, user.sub, user.grupoId);
  }

  @Patch(':id/rejeitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  rejeitar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeitarSolicitacaoTrocaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.dispositivosService.rejeitarTroca(
      id,
      user.sub,
      dto.motivo,
      user.grupoId,
    );
  }
}
