import { Injectable } from '@nestjs/common';
import { TipoAlertaJornada } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

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
  intervalos: { inicio: string; fim: string }[];
  registroGeradorId: string;
  observacao: string;
  criadoEm: Date;
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
        return {
          alertaId: alerta.id,
          motoristaId: alerta.motorista.id,
          motoristaNome: alerta.motorista.nome,
          motoristaCpf: alerta.motorista.cpf,
          periodoInicio: dossie.periodoInicio,
          periodoFim: dossie.periodoFim,
          minutosTotais: dossie.minutosTotais,
          intervalos: dossie.intervalos,
          registroGeradorId: dossie.registroGeradorId,
          observacao: dossie.observacao,
          criadoEm: alerta.createdAt,
        } satisfies ItemDossieCobranca;
      })
      .filter((item): item is ItemDossieCobranca => item !== null);
  }
}
