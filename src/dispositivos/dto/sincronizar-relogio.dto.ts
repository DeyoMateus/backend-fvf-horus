import { IsNumber, Min } from 'class-validator';

/**
 * Rodada 92 , corpo de POST /dispositivo/relogio/sincronizar. Só o
 * relógio monotônico do aparelho (`SystemClock.elapsedRealtime()` /
 * `ProcessInfo.systemUptime`) no momento da chamada , nunca o relógio
 * de parede do aparelho, que é exatamente o que não se pode confiar
 * aqui (ver RelogioConfiavelService). A hora "confiável" em si é
 * sempre a do SERVIDOR, capturada no momento em que a requisição chega.
 */
export class SincronizarRelogioDto {
  @IsNumber()
  @Min(0)
  elapsedRealtimeMs!: number;
}
