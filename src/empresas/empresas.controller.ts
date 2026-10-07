import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AfdService } from '../common/afd/afd.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { EmpresasService } from './empresas.service';

@Controller('empresas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmpresasController {
  constructor(
    private readonly empresasService: EmpresasService,
    private readonly afdService: AfdService,
    private readonly tenant: TenantService,
  ) {}

  // Adiciona mais um CNPJ ao GRUPO de quem está pedindo (um grupo pode
  // ter vários CNPJs sob o mesmo login) , nunca cria grupo novo.
  @Post()
  @Roles(PapelUsuario.ADMIN)
  create(
    @Body() dto: CreateEmpresaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.empresasService.create(dto, user.grupoId, user.sub);
  }

  // Todos os CNPJs do grupo de quem está pedindo.
  @Get()
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  list(@CurrentUser() user: UsuarioAutenticado) {
    return this.empresasService.list(user.grupoId);
  }

  /**
   * AFD oficial (Portaria MTP 671/2021, leiaute REP-P) do período ,
   * ver AfdService pro que está e o que não está coberto ainda
   * (assinatura ICP-Brasil do trailer fica em branco até a empresa
   * ter certificado e-CNPJ). É sempre por CNPJ (a Portaria exige um
   * arquivo por empresa), então precisa saber QUAL Empresa do grupo ,
   * `empresaId` é obrigatório e conferido contra o grupo antes de gerar
   * qualquer coisa (nunca aceito sem essa checagem).
   */
  @Get('afd')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  // Geração de arquivo é cara de CPU/IO , limite mais estrito que o
  // global (por IP), pra uma conta comprometida não conseguir martelar isso.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async afd(
    @Res() res: Response,
    @CurrentUser() user: UsuarioAutenticado,
    @Query('empresaId') empresaId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    if (!empresaId || !inicio || !fim) {
      throw new BadRequestException(
        'Informe os parâmetros de query "empresaId", "inicio" e "fim" (datas ISO).',
      );
    }
    await this.tenant.verificarEmpresaNoGrupo(empresaId, user.grupoId);

    const { nomeArquivo, conteudo } = await this.afdService.gerarArquivo(
      empresaId,
      new Date(inicio),
      new Date(fim),
    );

    res.set({
      'Content-Type': 'text/plain; charset=iso-8859-1',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    });
    res.send(conteudo);
  }

  @Get(':id')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.empresasService.findById(id, user.grupoId);
  }

  // Vincula/desvincula a CCT/ACT deste CNPJ (Rodada 27) , corpo
  // { regraSindicalId: string | null }.
  @Patch(':id/regra-sindical')
  @Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
  vincularRegraSindical(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('regraSindicalId') regraSindicalId: string | null,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.empresasService.vincularRegraSindical(
      id,
      regraSindicalId ?? null,
      user.grupoId,
      user.sub,
    );
  }
}
