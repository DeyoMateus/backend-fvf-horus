import { Injectable } from '@nestjs/common';
import { TipoAlertaJornada } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  construirLinhaDoTempoFuso,
  offsetNoInstante,
} from '../common/fuso/fuso-brasil.util';

/**
 * "Dossiê de Cobrança" , Lei 13.103/2015 (Lei do Motorista), Art. 235-A
 * §9º: passado o limiar de 5h de espera em carga/descarga no mesmo
 * dia, o excedente pode ser cobrado do embarcador/contratante do
 * frete. O motor de limites legais (`JornadaLegalService`) já detecta
 * esse limiar e grava os dados de apoio no próprio `AlertaJornada`
 * (`detalhes.dossieDeCobranca`) desde antes desta rodada , mas não
 * havia nenhum jeito de EXTRAIR isso: nem listagem, nem PDF. Esta
 * rodada (66) adiciona exatamente essa extração, sem alterar em nada
 * o motor que já gera o dado.
 */
export interface ItemDossieCobranca {
  alertaId: string;
  motoristaId: string;
  motoristaNome: string;
  motoristaCpf: string;
  periodoInicio: string;
  periodoFim: string;
  minutosTotais: number;
  intervalos: {
    inicio: string;
    fim: string;
    /** Fuso do motorista (min a leste do UTC) no início/fim da espera: onde ele estava. */
    fusoInicioMin?: number;
    fusoFimMin?: number;
  }[];
  registroGeradorId: string;
  observacao: string;
  criadoEm: Date;
  /** Fuso do motorista no início/fim da janela e na detecção. */
  fusoPeriodoInicioMin?: number;
  fusoPeriodoFimMin?: number;
  fusoCriadoEmMin?: number;
}

@Injectable()
export class DossieCobrancaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `grupoId` NUNCA vem de um parâmetro de rota , sempre do token JWT
   * de quem está pedindo (mesmo raciocínio de `AlertasJornadaService.listByGrupo`).
   * `motoristaId` opcional filtra pra um motorista só.
   */
  async listar(
    grupoId: string,
    inicio: Date,
    fim: Date,
    motoristaId?: string,
  ): Promise<ItemDossieCobranca[]> {
    const alertas = await this.prisma.alertaJornada.findMany({
      where: {
        tipo: TipoAlertaJornada.ESPERA_LIMITE_LEGAL_ATINGIDO,
        motorista: {
          empresa: { grupoId },
          ...(motoristaId ? { id: motoristaId } : {}),
        },
        createdAt: { gte: inicio, lte: fim },
      },
      include: { motorista: { select: { id: true, nome: true, cpf: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Rodada 150: cada horário sai no fuso em que o MOTORISTA estava naquele
    // instante (linha do tempo dos fusos gravados nos pontos dele), nunca no
    // de quem gera o documento.
    const linhaPorMotorista = await this.linhasDeFuso(alertas);

    return alertas
      .map((alerta) => {
        const dossie = (alerta.detalhes as Record<string, unknown> | null)
          ?.dossieDeCobranca as
          | {
              periodoInicio: string;
              periodoFim: string;
              minutosTotais: number;
              intervalos: { inicio: string; fim: string }[];
              registroGeradorId: string;
              observacao: string;
            }
          | undefined;
        if (!dossie) return null;
        const linha = linhaPorMotorista.get(alerta.motorista.id) ?? [];
        const offEm = (iso: string | Date) =>
          offsetNoInstante(linha, new Date(iso).getTime());
        return {
          alertaId: alerta.id,
          motoristaId: alerta.motorista.id,
          motoristaNome: alerta.motorista.nome,
          motoristaCpf: alerta.motorista.cpf,
          periodoInicio: dossie.periodoInicio,
          periodoFim: dossie.periodoFim,
          minutosTotais: dossie.minutosTotais,
          intervalos: dossie.intervalos.map((i) => ({
            ...i,
            fusoInicioMin: offEm(i.inicio),
            fusoFimMin: offEm(i.fim),
          })),
          fusoPeriodoInicioMin: offEm(dossie.periodoInicio),
          fusoPeriodoFimMin: offEm(dossie.periodoFim),
          fusoCriadoEmMin: offEm(alerta.createdAt),
          registroGeradorId: dossie.registroGeradorId,
          observacao: dossie.observacao,
          criadoEm: alerta.createdAt,
        } satisfies ItemDossieCobranca;
      })
      .filter((item): item is ItemDossieCobranca => item !== null);
  }

  /** Linha do tempo de fuso de cada motorista dos alertas (a partir dos pontos batidos). */
  private async linhasDeFuso(
    alertas: { motorista: { id: string }; createdAt: Date; detalhes: unknown }[],
  ) {
    const resultado = new Map<string, ReturnType<typeof construirLinhaDoTempoFuso>>();
    if (alertas.length === 0) return resultado;
    const ids = [...new Set(alertas.map((a) => a.motorista.id))];
    const instantes = alertas.flatMap((a) => {
      const d = (a.detalhes as { dossieDeCobranca?: { periodoInicio?: string; periodoFim?: string } } | null)
        ?.dossieDeCobranca;
      return [a.createdAt.getTime(), d?.periodoInicio ? new Date(d.periodoInicio).getTime() : NaN, d?.periodoFim ? new Date(d.periodoFim).getTime() : NaN].filter((n) => !Number.isNaN(n));
    });
    const margem = 7 * 24 * 3_600_000;
    const registros = await this.prisma.registroJornada.findMany({
      where: {
        motoristaId: { in: ids },
        timestampEvento: {
          gte: new Date(Math.min(...instantes) - margem),
          lte: new Date(Math.max(...instantes) + margem),
        },
      },
      select: { motoristaId: true, timestampEvento: true, fusoOffsetMin: true },
    });
    for (const id of ids) {
      resultado.set(
        id,
        construirLinhaDoTempoFuso(
          registros
            .filter((r) => r.motoristaId === id)
            .map((r) => ({
              t: r.timestampEvento.getTime(),
              offsetMin: r.fusoOffsetMin ?? null,
            })),
          [],
        ),
      );
    }
    return resultado;
  }
}
