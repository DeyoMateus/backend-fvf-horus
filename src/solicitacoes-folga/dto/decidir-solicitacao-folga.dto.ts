import { IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class DecidirSolicitacaoFolgaDto {
  // Opcional ao aprovar; o service exige ao negar (o motorista precisa
  // entender por que o pedido não foi aceito).
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  motivoDecisao?: string;
}
