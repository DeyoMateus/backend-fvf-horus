import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class CreateFolgaConcedidaDto {
  /** Dia calendário coberto pela folga (data ISO, ex.: "2026-10-01"). */
  @IsISO8601()
  data!: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  motivo?: string;
}
