import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListarDossieCobrancaDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsUUID()
  motoristaId?: string;
}
