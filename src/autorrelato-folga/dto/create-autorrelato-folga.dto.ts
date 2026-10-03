import { IsDateString, IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class CreateAutorrelatoFolgaDto {
  /** Dia calendário (AAAA-MM-DD) a que a folga se refere , sempre interpretado como data, sem horário. */
  @IsDateString()
  data!: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 300)
  observacao?: string;
}
