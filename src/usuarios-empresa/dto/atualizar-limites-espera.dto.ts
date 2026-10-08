import { IsInt, Max, Min } from 'class-validator';

/**
 * Rodada 174: limites de espera em carga/descarga (minutos) do grupo.
 * A ordem info < atenção < crítico é validada no serviço.
 */
export class AtualizarLimitesEsperaDto {
  @IsInt()
  @Min(15)
  @Max(1440)
  infoMin!: number;

  @IsInt()
  @Min(15)
  @Max(1440)
  atencaoMin!: number;

  @IsInt()
  @Min(15)
  @Max(1440)
  criticoMin!: number;
}
