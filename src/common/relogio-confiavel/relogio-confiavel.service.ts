import { Injectable, Logger } from '@nestjs/common';
import { SeveridadeAlerta, TipoAlertaJornada } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN,
  calcularDivergenciaRelogioConfiavelMin,
} from './relogio-confiavel.util';

/**
 * Rodada 92 , "relógio confiável": fecha, de forma retroativa, a
 * lacuna documentada na Rodada 91 (reiniciar o aparelho e mexer no
 * relógio de parede antes do primeiro toque pós-boot passava batido,
 * porque não existia nenhuma referência externa , só o próprio
 * aparelho , pra comparar).
 *
 * Mecanismo, em 3 passos:
 *  1) O app manda uma "amostra de hora confiável" (elapsedRealtimeMs do
 *     aparelho + nada mais) sempre que tem uma chance barata de
 *     confirmar a hora com uma fonte que o motorista não controla: ao
 *     abrir o app e sempre que a conectividade volta , não só quando
 *     bate ponto. O SERVIDOR responde com a própria hora (`new Date()`)
 *     e grava o par (elapsedRealtimeMs do aparelho, hora do servidor)
 *     em `AmostraHoraConfiavel`.
 *  2) Em `RegistrosJornadaService.create` (checagem nº4), todo evento
 *     que traz `elapsedRealtimeMs` é comparado contra a amostra mais
 *     recente do MESMO boot (se existir) , igual à checagem nº3, mas
 *     com uma ponta vinda do servidor em vez do próprio aparelho, o que
 *     finalmente permite detectar manipulação MESMO logo após reiniciar.
 *     Se não existir nenhuma amostra ainda daquele boot (aparelho
 *     reiniciou e nunca teve chance de sincronizar antes deste toque),
 *     o evento é aceito mesmo assim (não dá pra bloquear um uso offline
 *     legítimo) mas fica registrado em `VerificacaoRelogioPendente`.
 *  3) Quando a próxima amostra daquele boot finalmente chegar (ver
 *     `resolverPendencias`), qualquer pendência comparável é reavaliada
 *     , se divergente, vira um alerta
 *     `RELOGIO_DIVERGENTE_DETECTADO_RETROATIVAMENTE` pro gestor
 *     investigar (o registro em si nunca é alterado/apagado , WORM).
 */
@Injectable()
export class RelogioConfiavelService {
  private readonly logger = new Logger(RelogioConfiavelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra a amostra e resolve toda pendência do mesmo device que
   * passa a ser comparável com ela (mesmo boot , ver
   * `buscarAmostraMesmoBoot` para o raciocínio de "mesmo boot").
   *
   * De propósito NÃO roda dentro de uma única transação (diferente de
   * `RegistrosJornadaService.create`): nada aqui é parte do ledger
   * imutável, então uma falha no meio do caminho só deixa alguma
   * pendência pra ser resolvida na próxima amostra , autocurativo, sem
   * risco de corromper nada.
   */
  async registrarAmostraEResolverPendencias(
    motoristaId: string,
    deviceUuidUsado: string,
    elapsedRealtimeMs: number,
  ): Promise<{ horaServidor: Date }> {
    const horaServidor = new Date();

    await this.prisma.amostraHoraConfiavel.create({
      data: {
        motoristaId,
        deviceUuidUsado,
        elapsedRealtimeMsNoMomento: elapsedRealtimeMs,
        horaServidorNoMomento: horaServidor,
      },
    });

    const pendencias = await this.prisma.verificacaoRelogioPendente.findMany({
      where: { deviceUuidUsado, elapsedRealtimeMs: { lte: elapsedRealtimeMs } },
    });

    for (const pendencia of pendencias) {
      try {
        const divergenciaMin = calcularDivergenciaRelogioConfiavelMin(
          pendencia.timestampEvento,
          pendencia.elapsedRealtimeMs,
          {
            horaServidorNoMomento: horaServidor,
            elapsedRealtimeMsNoMomento: elapsedRealtimeMs,
          },
        );

        if (divergenciaMin > TOLERANCIA_DIVERGENCIA_RELOGIO_CONFIAVEL_MIN) {
          await this.prisma.alertaJornada.create({
            data: {
              motoristaId,
              tipo: TipoAlertaJornada.RELOGIO_DIVERGENTE_DETECTADO_RETROATIVAMENTE,
              severidade: SeveridadeAlerta.CRITICO,
              mensagem:
                'Divergência de relógio detectada retroativamente: este registro foi aceito logo após o ' +
                'aparelho reiniciar, sem nenhuma hora confiável daquele boot disponível na hora. Comparando ' +
                'agora com a primeira hora confiável que chegou desse mesmo boot, o relógio de parede e o ' +
                'relógio monotônico do aparelho não batem , forte indício de que a data/hora do aparelho foi ' +
                'alterada manualmente antes deste registro.',
              janelaInicio: pendencia.timestampEvento,
              janelaFim: pendencia.timestampEvento,
              minutosAcumulados: Math.round(divergenciaMin),
              registroGeradorId: pendencia.registroJornadaId,
              detalhes: {
                deviceUuidUsado,
                divergenciaMin: Math.round(divergenciaMin),
                elapsedRealtimeMsDoRegistro: pendencia.elapsedRealtimeMs,
                elapsedRealtimeMsDaAmostra: elapsedRealtimeMs,
              },
            },
          });
        }
      } catch (err) {
        // Nunca deixa uma falha ao gerar o ALERTA impedir a resolução
        // da pendência (senão ela ficaria presa pra sempre) , só loga.
        this.logger.warn(
          `Falha ao resolver verificação de relógio pendente ${pendencia.id}: ${(err as Error).message}`,
        );
      }

      await this.prisma.verificacaoRelogioPendente.delete({
        where: { id: pendencia.id },
      });
    }

    return { horaServidor };
  }
}
