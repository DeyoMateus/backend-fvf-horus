import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Length } from 'class-validator';
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
}
