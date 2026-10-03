import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Não usa @nestjs/mapped-types (PartialType) de propósito , mesmo
// motivo já documentado em regras-sindicais/dto: essa lib não está
// instalada neste projeto. Todos os campos já nascem opcionais aqui.
export class UpdateFeriadoDto {
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(2, 200)
  descricao?: string;

  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsBoolean()
  pagoComoDomingo?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
