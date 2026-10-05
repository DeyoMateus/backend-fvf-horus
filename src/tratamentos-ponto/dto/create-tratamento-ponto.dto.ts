import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min, IsString, IsUUID, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';
import { TipoEvento } from '@prisma/client';

export class CreateTratamentoPontoDto {
  @IsEnum(TipoEvento)
  tipoEvento!: TipoEvento;

  @IsISO8601()
  timestampEvento!: string;

  @Sanitizar()
  @IsString()
  @Length(10, 1000)
  motivo!: string;

  @IsOptional()
  @IsUUID()
  registroReferenciaId?: string;

  /// Fuso do motorista no instante do ajuste (min a leste do UTC). Sem ele, o
  /// servidor deduz pelos pontos dele.
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  fusoOffsetMin?: number;
}
