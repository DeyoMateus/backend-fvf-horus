import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PapelUsuario } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AejService } from '../common/aej/aej.service';
import { ComprovanteService } from '../common/comprovante/comprovante.service';
import { RepPService } from '../common/rep-p/rep-p.service';
import { FeriadosService } from '../feriados/feriados.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MotoristaDeviceGuard } from '../common/guards/motorista-device.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateRegistroJornadaDto } from './dto/create-registro-jornada.dto';
import { LoteRegistroJornadaDto } from './dto/lote-registro-jornada.dto';
import { RegistrosJornadaService } from './registros-jornada.service';

// Sempre junto do motorista em qualquer consulta que vá parar num
// documento (comprovante, AEJ) , é o CNPJ do vínculo empregatício real
// dele, não necessariamente o único CNPJ do grupo. Ver comentário em
// ComprovanteService sobre por que isso importa quando o grupo tem mais
// de uma Empresa.
const INCLUDE_EMPRESA_DOCUMENTO = {
  empresa: { select: { razaoSocial: true, cnpj: true } },
} as const;

// Mesma inclusão acima, mas trazendo também a CCT/ACT vinculada ao CNPJ
// (Rodada 27) , o Espelho de Ponto REP-P precisa dela pra aplicar os
// percentuais corretos de hora extra/adicional noturno no resumo diário.
const INCLUDE_EMPRESA_COM_REGRA_SINDICAL = {
  empresa: {
    select: {
      razaoSocial: true,
      cnpj: true,
      regraSindical: true,
      grupoId: true,
    },
  },
  dispositivoVinculado: { select: { deviceUuid: true } },
} as const;

@Controller('registros-jornada')
export class RegistrosJornadaController {
  constructor(
    private readonly registrosService: RegistrosJornadaService,
    private readonly comprovanteService: ComprovanteService,
    private readonly aejService: AejService,
    private readonly repPService: RepPService,
    private readonly feriadosService: FeriadosService,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Usado pelo app do motorista. Autenticação por device binding
  // (X-Motorista-Id / X-Device-Key / X-Device-Uuid) , se o aparelho não
  // for o vinculado, o MotoristaDeviceGuard já rejeita antes de chegar aqui.
  @Post()
  @UseGuards(MotoristaDeviceGuard)
  create(
    @Req() req: { motorista: { id: string }; deviceUuid: string },
    @Body() dto: CreateRegistroJornadaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.registrosService.create(
      req.motorista.id,
      req.deviceUuid,
      dto,
      ip,
      userAgent,
    );
  }

  // Envio em lote (Rodada 66) , o app manda de uma vez todos os eventos
  // acumulados offline ao reconectar. Resposta síncrona, item por item
  // (ver ResultadoItemLote), pra o app saber exatamente o que já pode
  // remover da fila local de sync e o que precisa tentar de novo.
  @Post('lote')
  @UseGuards(MotoristaDeviceGuard)
  criarLote(
    @Req() req: { motorista: { id: string }; deviceUuid: string },
    @Body() dto: LoteRegistroJornadaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.registrosService.processarLote(
      req.motorista.id,
      req.deviceUuid,
      dto.eventos,
      ip,
      userAgent,
    );
  }

  // Usado pelo próprio app do motorista, pra baixar o comprovante do
  // seu período (compartilhar/imprimir) sem precisar do painel.
  @Get('meu-comprovante')
  @UseGuards(MotoristaDeviceGuard)
  async meuComprovante(
    @Req() req: { motorista: { id: string } },
    @Res() res: Response,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    await this.responderComprovante(res, req.motorista.id, inicio, fim);
  }

  // Usado pelo próprio app do motorista, pra baixar o comprovante de UM
  // único registro (o motorista seleciona na tela de Histórico) em vez
  // do extrato acumulado do período inteiro. idLocal = idempotencyKey
  // gerado pelo app no momento do toque, já guardado no SQLite local.
  @Get(':idLocal/meu-comprovante')
  @UseGuards(MotoristaDeviceGuard)
  async meuComprovanteRegistro(
    @Req() req: { motorista: { id: string } },
    @Res() res: Response,
    @Param('idLocal') idLocal: string,
  ) {
    const registro = await this.registrosService.buscarPorIdempotencyKey(
      req.motorista.id,
      idLocal,
    );
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: req.motorista.id },
      include: INCLUDE_EMPRESA_DOCUMENTO,
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const pdf = await this.comprovanteService.gerarPdfRegistros(
      motorista,
      motorista.empresa,
      [registro],
      registro.timestampEvento,
      registro.timestampEvento,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprovante-${registro.sequencial}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  // Usado pelo painel da empresa (autenticação JWT + RBAC).
  @Get('motorista/:motoristaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.registrosService.listByMotorista(motoristaId, user.grupoId);
  }

  @Get('motorista/:motoristaId/verificar-integridade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  verificarIntegridade(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.registrosService.verificarIntegridade(
      motoristaId,
      user.sub,
      user.grupoId,
    );
  }

  /** Pedido do usuário: aceitar/regularizar uma divergência específica da verificação de integridade, em vez de ela ficar marcada como problema pra sempre. */
  @Patch('motorista/:motoristaId/integridade/:sequencial/aceitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  aceitarDivergenciaIntegridade(
    @Param('motoristaId') motoristaId: string,
    @Param('sequencial') sequencial: string,
    @Body('motivo') motivo: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.registrosService.aceitarDivergenciaIntegridade(
      motoristaId,
      Number(sequencial),
      motivo,
      user.sub,
      user.grupoId,
    );
  }

  /** Fechamento diário consolidado em "Viagem" multi-dia , ver §16 do ARCHITECTURE.md. */
  @Get('motorista/:motoristaId/viagens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  viagens(
    @Param('motoristaId') motoristaId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.registrosService.consolidarViagens(motoristaId, user.grupoId);
  }

  /**
   * AEJ próprio em CSV , ver o comentário no topo de `AejService` sobre
   * o que isto é (export estruturado, todos os campos legalmente
   * relevantes) e o que NÃO é (não é o layout binário oficial do AFD /
   * Portaria 671, cuja especificação byte a byte não temos como
   * verificar aqui com segurança).
   */
  @Get('motorista/:motoristaId/aej')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  // Geração de CSV é cara de IO , limite mais estrito que o global (por IP).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async aej(
    @Param('motoristaId') motoristaId: string,
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(motoristaId, user.grupoId);
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: INCLUDE_EMPRESA_DOCUMENTO,
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const registros = await this.registrosService.listByMotoristaNoPeriodo(
      motoristaId,
      inicio ? new Date(inicio) : undefined,
      fim ? new Date(fim) : undefined,
    );
    const csv = this.aejService.gerarCsv(
      motorista,
      motorista.empresa,
      registros,
    );

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aej-${motoristaId}.csv"`,
    });
    res.send(csv);
  }

  @Get('motorista/:motoristaId/comprovante')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  // Geração de PDF é cara de CPU , limite mais estrito que o global (por IP).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async comprovante(
    @Param('motoristaId') motoristaId: string,
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    await this.responderComprovante(
      res,
      motoristaId,
      inicio,
      fim,
      user.grupoId,
    );
  }

  /**
   * Espelho de Ponto Eletrônico (REP-P), Rodada 27 , ver `RepPService`
   * pro que este relatório é e o que ele deliberadamente NÃO afirma
   * (ICP-Brasil A1, validação NTP formal, etc.). Usado pelo painel
   * (RH/gestor, com RBAC) e pelo próprio app do motorista (device
   * binding, sem RBAC , é o registro dele mesmo).
   */
  @Get('motorista/:motoristaId/espelho-rep-p')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async espelhoRepP(
    @Param('motoristaId') motoristaId: string,
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    await this.responderEspelhoRepP(
      res,
      motoristaId,
      inicio,
      fim,
      user.grupoId,
    );
  }

  @Get('meu-espelho-rep-p')
  @UseGuards(MotoristaDeviceGuard)
  async meuEspelhoRepP(
    @Req() req: { motorista: { id: string } },
    @Res() res: Response,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    await this.responderEspelhoRepP(res, req.motorista.id, inicio, fim);
  }

  private async responderEspelhoRepP(
    res: Response,
    motoristaId: string,
    inicio?: string,
    fim?: string,
    grupoIdSolicitante?: string,
  ) {
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
    }
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: INCLUDE_EMPRESA_COM_REGRA_SINDICAL,
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const dataInicio = inicio ? new Date(inicio) : undefined;
    const dataFim = fim ? new Date(fim) : undefined;
    const periodoInicio = dataInicio ?? new Date(0);
    const periodoFim = dataFim ?? new Date();

    const [registros, tratamentos, feriadosRaw] = await Promise.all([
      this.registrosService.listByMotoristaNoPeriodo(
        motoristaId,
        dataInicio,
        dataFim,
      ),
      this.prisma.tratamentoPonto.findMany({
        where: {
          motoristaId,
          timestampEvento: { gte: periodoInicio, lte: periodoFim },
        },
        orderBy: { timestampEvento: 'asc' },
        include: { usuario: { select: { nome: true } } },
      }),
      // Rodada 29: feriados que o RH cadastrou pro grupo/CNPJ deste
      // motorista, dentro do período , substitui a antiga checagem de
      // "só domingo conta" no cálculo do resumo diário do REP-P.
      this.feriadosService.listarParaRelatorio(
        motorista.empresa.grupoId,
        motorista.empresaId,
        periodoInicio,
        periodoFim,
      ),
    ]);
    const feriadosNoPeriodo = feriadosRaw.map((f) => ({
      data: f.data.toISOString().slice(0, 10),
      descricao: f.descricao,
      pagoComoDomingo: f.pagoComoDomingo,
    }));

    const pdf = await this.repPService.gerarPdf(
      motorista,
      motorista.empresa,
      motorista.empresa.regraSindical,
      registros,
      tratamentos,
      feriadosNoPeriodo,
      {
        periodoInicio:
          dataInicio ?? registros[0]?.timestampEvento ?? new Date(),
        periodoFim: dataFim ?? new Date(),
      },
      motorista.dispositivoVinculado?.deviceUuid ?? null,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="espelho-rep-p-${motoristaId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  private async responderComprovante(
    res: Response,
    motoristaId: string,
    inicio?: string,
    fim?: string,
    grupoIdSolicitante?: string,
  ) {
    // Só confere tenant quando quem pediu foi o painel (grupoIdSolicitante
    // presente) , a rota do próprio app (meuComprovante) já usa o id do
    // motorista autenticado pelo device binding, não precisa desta checagem.
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
    }
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: INCLUDE_EMPRESA_DOCUMENTO,
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const dataInicio = inicio ? new Date(inicio) : undefined;
    const dataFim = fim ? new Date(fim) : undefined;

    const registros = await this.registrosService.listByMotoristaNoPeriodo(
      motoristaId,
      dataInicio,
      dataFim,
    );

    const pdf = await this.comprovanteService.gerarPdfRegistros(
      motorista,
      motorista.empresa,
      registros,
      dataInicio ?? registros[0]?.timestampEvento ?? new Date(),
      dataFim ?? new Date(),
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprovante-${motoristaId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
