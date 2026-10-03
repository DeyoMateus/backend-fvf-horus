import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ListarDossieCobrancaDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsString()
  motoristaId?: string;
}
