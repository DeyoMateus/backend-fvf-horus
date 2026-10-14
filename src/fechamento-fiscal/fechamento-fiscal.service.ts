import { ForbiddenException, Injectable } from '@nestjs/common';
import { agoraDoCliente } from '../common/fuso/fuso-contexto';
import { RelatorioPdf } from '../common/pdf/relatorio-pdf';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { StatusMotorista } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegistrosJornadaService } from '../registros-jornada/registros-jornada.service';
import { RepPService } from '../common/rep-p/rep-p.service';
import { FeriadosService } from '../feriados/feriados.service';
import {
  fimDePeriodoBrt,
  inicioDePeriodoBrt,
  offsetPadraoDaEmpresa,
} from '../common/fuso/fuso-brasil.util';

const INCLUDE_EMPRESA_COM_REGRA_SINDICAL = {
  empresa: {
    select: {
      razaoSocial: true,
      cnpj: true,
      regraSindical: true,
      grupoId: true,
      fusoHorario: true,
    },
  },
  dispositivoVinculado: { select: { deviceUuid: true } },
} as const;

/**
 * "Documentos assinados com os certificados" para uma fiscalização
 * (Rodada 66, pedido do usuário: "Caso vá um fiscal na empresa ele
 * precisa dos documentos assinados com os certificados") , o Espelho
 * de Ponto Eletrônico (REP-P, Portaria 671/2021) já existe MOTORISTA
 * POR MOTORISTA (`GET /registros-jornada/motorista/:id/espelho-rep-p`,
 * assinado com o certificado digital do próprio motorista via
 * `SignatureService`), mas não havia jeito de extrair a frota inteira
 * de uma vez , exatamente o que se precisa mostrar a um fiscal que
 * chega sem aviso.
 *
 * Reaproveita `RepPService.gerarPdf` sem alterar nada nele (documento
 * já legalmente sensível, risco de regressão desnecessário) , gera um
 * PDF assinado por motorista e junta todos com `pdf-lib` (merge de
 * PDFs já prontos, não desenho , `pdfkit` não compartilha um único
 * documento entre chamadas independentes de `gerarPdf`), com uma capa
 * listando quem está incluído.
 */
@Injectable()
export class FechamentoFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrosJornada: RegistrosJornadaService,
    private readonly repP: RepPService,
    private readonly feriados: FeriadosService,
  ) {}

  async gerarEspelhosRepPEmLote(
    grupoId: string,
    dataInicio: Date,
    dataFim: Date,
    motoristaIds: string[] | null,
  ): Promise<Buffer> {
    const motoristas = await this.prisma.motorista.findMany({
      where: {
        empresa: { grupoId },
        excluidoEm: null,
        ...(motoristaIds && motoristaIds.length > 0
          ? { id: { in: motoristaIds } }
          : { status: StatusMotorista.ATIVO }),
      },
      include: INCLUDE_EMPRESA_COM_REGRA_SINDICAL,
      orderBy: { nome: 'asc' },
    });

    if (motoristaIds && motoristaIds.length > 0) {
      const idsEncontrados = new Set(motoristas.map((m) => m.id));
      const idsForaDoGrupo = motoristaIds.filter(
        (id) => !idsEncontrados.has(id),
      );
      if (idsForaDoGrupo.length > 0) {
        throw new ForbiddenException(
          `Motorista(s) fora do seu grupo: ${idsForaDoGrupo.join(', ')}`,
        );
      }
    }

    const periodoInicio = new Date(0);
    const buffers: Buffer[] = [
      await this.gerarCapa(
        motoristas.map((m) => m.nome),
        dataInicio,
        dataFim,
      ),
    ];

    for (const motorista of motoristas) {
      const offsetEmpresaMin = offsetPadraoDaEmpresa(
        motorista.empresa.fusoHorario,
      );
      const [registros, tratamentos, feriadosRaw] = await Promise.all([
        this.registrosJornada.listByMotoristaNoPeriodo(
          motorista.id,
          dataInicio,
          dataFim,
          offsetEmpresaMin,
        ),
        this.prisma.tratamentoPonto.findMany({
          where: {
            motoristaId: motorista.id,
            timestampEvento: {
              gte: inicioDePeriodoBrt(dataInicio, offsetEmpresaMin),
              lte: fimDePeriodoBrt(dataFim, offsetEmpresaMin),
            },
          },
          orderBy: { timestampEvento: 'asc' },
          include: { usuario: { select: { nome: true } } },
        }),
        this.feriados.listarParaRelatorio(
          motorista.empresa.grupoId,
          motorista.empresaId,
          dataInicio,
          dataFim,
        ),
      ]);
      const feriadosNoPeriodo = feriadosRaw.map((f) => ({
        data: f.data.toISOString().slice(0, 10),
        descricao: f.descricao,
        pagoComoDomingo: f.pagoComoDomingo,
      }));

      const pdf = await this.repP.gerarPdf(
        motorista,
        motorista.empresa,
        motorista.empresa.regraSindical,
        registros,
        tratamentos,
        feriadosNoPeriodo,
        { periodoInicio: dataInicio ?? periodoInicio, periodoFim: dataFim },
        motorista.dispositivoVinculado?.deviceUuid ?? null,
      );
      buffers.push(pdf);
    }

    return this.mesclarPdfs(buffers);
  }

  private async gerarCapa(
    nomesMotoristas: string[],
    dataInicio: Date,
    dataFim: Date,
  ): Promise<Buffer> {
    const r = new RelatorioPdf({
      titulo: 'Espelhos de ponto eletrônico (REP-P) para fiscalização',
      rodape: 'Espelhos de ponto (REP-P)',
    });
    r.cabecalho({
      titulo: 'Espelhos de ponto eletrônico (REP-P)',
      subtitulo: 'Para fiscalização',
      campos: [
        [
          // Rodada 97 , mesmo bug/correção do holerite/comprovante: ver comentário completo em holerite-pdf.util.ts.
          'Período',
          `${dataInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até ${dataFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
        ],
        ['Motoristas', String(nomesMotoristas.length)],
        ['Gerado em', agoraDoCliente()],
      ],
      aviso:
        'Cada espelho a seguir é assinado digitalmente com o certificado do próprio motorista (RSA-SHA256, CA ' +
        'interna do FVF Hórus , não é uma assinatura ICP-Brasil A1/PKCS#7 válida; ver claude/bloqueios-dependentes-do-usuario.md ' +
        'sobre o certificado ICP-Brasil e2CNPJ pendente) e traz a cadeia de hash do período, com status de ' +
        'integridade. Para o arquivo AFD oficial (Portaria 671/2021, leiaute binário fixo), use a exportação ' +
        'separada em Empresas.',
    });
    r.doc.moveDown(0.8);
    r.secao('Motoristas incluídos');
    if (nomesMotoristas.length === 0) {
      r.vazio('Nenhum motorista encontrado para este filtro.');
    } else {
      r.tabela(
        [
          { titulo: '#', largura: 1, alinhamento: 'right' },
          { titulo: 'Motorista', largura: 12 },
        ],
        nomesMotoristas.map((nome, i) => [String(i + 1), nome]),
        { tamanhoFonte: 9 },
      );
    }
    return r.finalizar();
  }

  private async mesclarPdfs(buffers: Buffer[]): Promise<Buffer> {
    const combinado = await PdfLibDocument.create();
    for (const buffer of buffers) {
      const origem = await PdfLibDocument.load(buffer);
      const paginas = await combinado.copyPages(
        origem,
        origem.getPageIndices(),
      );
      for (const pagina of paginas) combinado.addPage(pagina);
    }
    const bytes = await combinado.save();
    return Buffer.from(bytes);
  }
}
