import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PapelUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FechamentoHoleriteQueryDto } from './dto/fechamento-holerite.dto';
import { gerarPdfHolerite } from './holerite-pdf.util';
import { HoleriteService } from './holerite.service';
import { criarZip } from '../common/zip/zip.util';

/**
 * "Janela de fechamento" (Rodada 36) , pedido explícito do usuário:
 * o gestor extrair o holerite individual OU em grupo (fechar a frota
 * inteira de uma vez) num único lugar, em vez de precisar abrir o
 * detalhe de cada motorista um por um. `motoristaIds` ausente/vazio =
 * fechamento da frota inteira (todos os motoristas ativos do grupo);
 * uma lista = fechamento só desses motoristas (pode ser um único ,
 * nesse caso o PDF sai igual ao holerite individual de sempre).
 *
 * Rodada 82 , pedido do usuário: "caso o gestor selecione mais de um
 * motorista os arquivos devem ser separados cada motorista com seu
 * relatorio". Antes disto, mais de um motorista virava um único PDF
 * combinado (capa-resumo + seção de cada um, um atrás do outro,
 * `gerarPdfFechamentoLote`). Agora cada motorista ganha o PDF
 * individual de sempre (mesmo `gerarPdfHolerite` de um motorista só),
 * e os PDFs saem todos juntos num .zip , um download só, mas arquivos
 * de verdade separados por motorista, prontos pra distribuir/arquivar
 * cada um por conta própria.
 */
@Controller('holerite-fechamento')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMIN, PapelUsuario.GESTOR)
export class FechamentoHoleriteController {
  constructor(private readonly holeriteService: HoleriteService) {}

  // Geração de PDF em lote é cara de IO/CPU , mesmo limite mais
  // estrito já usado nos outros exports pesados (AEJ, indicadores CSV).
  @Get('pdf')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async pdf(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: FechamentoHoleriteQueryDto,
    @Res() res: Response,
  ) {
    const motoristaIds = query.motoristaIds
      ? query.motoristaIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : null;

    const opcoes = {
      direcaoEspera: query.direcaoEspera !== 'false',
      normalExtra: query.normalExtra !== 'false',
      adicionalNoturno: query.adicionalNoturno !== 'false',
    };
    const dataInicio = new Date(query.inicio);
    const dataFim = new Date(query.fim);

    const itens = await this.holeriteService.calcularEmLote(
      motoristaIds,
      dataInicio,
      dataFim,
      opcoes,
      user.grupoId,
    );

    const sufixoPeriodo = `${query.inicio.slice(0, 10)}-a-${query.fim.slice(0, 10)}`;

    if (itens.length === 1) {
      const pdf = await gerarPdfHolerite(
        itens[0].motorista,
        itens[0].empresa,
        itens[0].resultado,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="holerite-${itens[0].motorista.nome.replace(/\s+/g, '-')}-${sufixoPeriodo}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.send(pdf);
      return;
    }

    // Mais de um motorista: um PDF por motorista (mesmo conteúdo do
    // individual de sempre , resumo diário + log detalhado), todos
    // dentro de um único .zip. `nomesUsados` evita colisão se dois
    // motoristas do grupo tiverem nomes iguais depois de sanitizar.
    const nomesUsados = new Set<string>();
    const arquivos = await Promise.all(
      itens.map(async (item) => {
        const pdf = await gerarPdfHolerite(
          item.motorista,
          item.empresa,
          item.resultado,
        );
        const base = item.motorista.nome.replace(/\s+/g, '-');
        let nome = `holerite-${base}-${sufixoPeriodo}.pdf`;
        let sufixo = 2;
        while (nomesUsados.has(nome)) {
          nome = `holerite-${base}-${sufixoPeriodo}-${sufixo}.pdf`;
          sufixo++;
        }
        nomesUsados.add(nome);
        return { nome, conteudo: pdf };
      }),
    );

    const zip = criarZip(arquivos);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="fechamento-frota-${sufixoPeriodo}.zip"`,
      'Content-Length': zip.length,
    });
    res.send(zip);
  }
}
