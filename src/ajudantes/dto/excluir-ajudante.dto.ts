import { IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class ExcluirAjudanteDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  motivo?: string;
}
