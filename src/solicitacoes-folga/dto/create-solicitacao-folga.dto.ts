import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class CreateSolicitacaoFolgaDto {
  /** Primeiro dia pedido (AAAA-MM-DD). */
  @Matches(DIA, { message: 'dataInicio deve estar no formato AAAA-MM-DD' })
  dataInicio!: string;

  /** Último dia pedido (AAAA-MM-DD), inclusive. Igual ao início para um dia só. */
  @Matches(DIA, { message: 'dataFim deve estar no formato AAAA-MM-DD' })
  dataFim!: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  observacao?: string;
}
