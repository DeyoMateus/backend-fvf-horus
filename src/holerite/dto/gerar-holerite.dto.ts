import { IsBooleanString, IsISO8601, IsOptional } from 'class-validator';

// Vem por querystring (GET, pra poder abrir/baixar o PDF direto do
// navegador com um link, igual ao resto dos comprovantes/relatórios do
// sistema) , por isso os booleanos chegam como string ("true"/"false").
export class GerarHoleriteQueryDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  // As 3 categorias são independentes , o gestor escolhe quais entram no
  // holerite, porque cada empresa paga de um jeito (fixo + comissão,
  // hora normal separada, etc. , decisão do usuário na Rodada 26: "deixe
  // o gestor selecionar as tabelas que deseja"). Todas opcionais,
  // default true (se o gestor não mandar nada, vem tudo).
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
