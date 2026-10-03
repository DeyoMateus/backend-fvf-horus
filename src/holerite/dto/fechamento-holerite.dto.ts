import {
  IsBooleanString,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

// Mesmo padrão do GerarHoleriteQueryDto , chega por querystring (GET,
// pra poder abrir/baixar o PDF direto do navegador). `motoristaIds`
// vem como string separada por vírgula (uma querystring não carrega
// array facilmente sem repetir a chave); ausente/vazia = "toda a
// frota" (todos os motoristas ativos do grupo).
export class FechamentoHoleriteQueryDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsString()
  motoristaIds?: string;

  @IsOptional()
  @IsBooleanString()
  direcaoEspera?: string;

  @IsOptional()
  @IsBooleanString()
  normalExtra?: string;

  @IsOptional()
  @IsBooleanString()
  adicionalNoturno?: string;
}
