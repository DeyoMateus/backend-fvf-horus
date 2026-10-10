import { TipoTratamentoDiaSemInteracao } from '@prisma/client';
import { IsEnum, IsISO8601, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class TratarDiaSemInteracaoDto {
  /** Dia calendário tratado (ex.: "2026-10-04"). */
  @IsISO8601()
  data!: string;

  /** FOLGA, FALTA, ATESTADO ou OUTRO ("sem sinal/esquecimento" não passa por aqui: vai para o tratamento de ponto). */
  @IsEnum(TipoTratamentoDiaSemInteracao)
  tipo!: TipoTratamentoDiaSemInteracao;

  /** O que o gestor apurou. */
  @Sanitizar()
  @IsString()
  @Length(10, 400)
  observacao!: string;
}
