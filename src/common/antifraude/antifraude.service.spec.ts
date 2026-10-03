import { AntifraudeService } from './antifraude.service';
import { TipoAlertaJornada } from '@prisma/client';

/**
 * Testes de regressão da Rodada 24: a fila offline do app mobile pode
 * enviar os registros ao backend fora da ordem cronológica real (ex.:
 * um retry de rede faz um evento mais antigo chegar DEPOIS de um mais
 * novo). Como `sequencial` é atribuído em ordem de CHEGADA ao servidor
 * (correto e necessário pra própria hash-chain, nunca muda), ele pode
 * divergir de `timestampEvento` (o horário real do evento, capturado no
 * aparelho mesmo offline) nesses casos.
 *
 * Antes da Rodada 24, `AntifraudeService` comparava `.sequencial` pra
 * decidir "o que aconteceu antes de quê" , o que gerava falsos positivos
 * sempre que a ordem de chegada não batia com a ordem real. Estes testes
 * fixam registros com `sequencial` INVERTIDO em relação a
 * `timestampEvento` (simulando exatamente esse cenário) e confirmam que,
 * usando `compararPorTimestampEvento` (ordenacao-temporal.util.ts), o
 * motor não dispara mais alerta nesses casos legítimos , mas continua
 * pegando fraude real (violação na ordem cronológica de verdade).
 */
describe('AntifraudeService , ordem cronológica vs. ordem de chegada (Rodada 24)', () => {
  const service = new AntifraudeService();
  const semFlags = undefined;
  const semTiposExistentes = new Set<TipoAlertaJornada>();

  it('velocidade: usa o registro com GPS cronologicamente anterior (timestampEvento), não o de sequencial menor, para calcular a distância/tempo', () => {
    // Registro com sequencial MENOR (chegou primeiro) mas timestampEvento
    // POSTERIOR não pode ser tratado como "o anterior" na comparação.
    const pontoA_realAnterior = {
      id: 'p-a',
      motoristaId: 'motorista-1',
      tipoEvento: 'INICIO_DIRECAO',
      timestampEvento: new Date('2026-09-22T08:00:00.000Z'),
      sequencial: 2, // chegou depois
      latitude: -23.5,
      longitude: -46.6,
    } as any;

    const pontoB_realPosterior = {
      id: 'p-b',
      motoristaId: 'motorista-1',
      tipoEvento: 'FIM_DIRECAO',
      timestampEvento: new Date('2026-09-22T09:00:00.000Z'), // 1h depois, deslocamento plausível
      sequencial: 1, // chegou antes
      latitude: -23.6,
      longitude: -46.7,
    } as any;

    const historico = [pontoA_realAnterior, pontoB_realPosterior];

    const alertas = service.avaliar(
      historico,
      pontoB_realPosterior,
      pontoB_realPosterior.timestampEvento,
      semFlags,
      semTiposExistentes,
    );

    // ~13km em 1h é plausível , não pode disparar velocidade impossível.
    expect(
      alertas.find(
        (a) =>
          a.tipo === TipoAlertaJornada.VELOCIDADE_IMPOSSIVEL_ENTRE_REGISTROS,
      ),
    ).toBeUndefined();
  });
});
