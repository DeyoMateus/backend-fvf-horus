import { IsString, Length, Matches } from 'class-validator';
import { Sanitizar, SomenteDigitos } from '../../common/sanitizacao/sanitizar.decorator';

export class CreateEmpresaDto {
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  razaoSocial!: string;

  // `SomenteDigitos()` aceita o usuário digitando/colando com pontuação (12.345.678/0001-90).
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve conter 14 dígitos numéricos' })
  cnpj!: string;
}
