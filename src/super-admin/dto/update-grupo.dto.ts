import { IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

/** Edição de uma empresa mãe já cadastrada (Rodada 32) , hoje, só a razão social. */
export class UpdateGrupoDto {
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  razaoSocial!: string;
}
