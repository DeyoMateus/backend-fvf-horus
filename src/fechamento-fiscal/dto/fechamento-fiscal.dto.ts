import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Mesmo padrão de FechamentoHoleriteQueryDto , chega por querystring
// (GET, pra abrir/baixar o PDF direto do navegador). `motoristaIds`
// ausente/vazio = todos os motoristas ATIVOS do grupo.
export class FechamentoFiscalQueryDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Matches(/^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/, {
    message: 'motoristaIds deve ser uma lista de UUIDs separados por vírgula',
  })
  motoristaIds?: string;
}
