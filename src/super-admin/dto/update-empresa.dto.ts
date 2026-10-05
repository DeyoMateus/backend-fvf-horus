import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { FUSOS_EMPRESA_PERMITIDOS } from '../../common/fuso/fuso-brasil.util';
import {
  Sanitizar,
  SomenteDigitos,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Edição de um CNPJ do grupo já cadastrado, pelo super admin (Rodada
 * 32) , mesmos campos preenchidos no provisionamento inicial
 * (`CreateEmpresaMaeDto`), agora editáveis depois de criado. Trocar o
 * CNPJ é uma operação sensível (documentos/AFD já emitidos referenciam
 * o CNPJ anterior) mas o super admin pode precisar corrigir um erro de
 * digitação , por isso é permitido, com checagem de duplicidade.
 */
export class UpdateEmpresaDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  razaoSocial?: string;

  @IsOptional()
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve conter 14 dígitos numéricos' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  registroInpiAfd?: string;

  /**
   * Rodada 146 , fuso da transportadora (exibição do painel/PDFs e janela
   * dos períodos "só data"). A hora de parede da jornada do motorista segue
   * o fuso onde ele está, não este.
   */
  @IsOptional()
  @IsIn(FUSOS_EMPRESA_PERMITIDOS, { message: 'fusoHorario inválido' })
  fusoHorario?: string;
}
