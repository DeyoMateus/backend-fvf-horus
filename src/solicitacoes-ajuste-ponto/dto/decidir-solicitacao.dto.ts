import { IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class DecidirSolicitacaoDto {
  // Opcional na aprovação, mas o service exige na rejeição , o motorista
  // precisa entender por que não foi aceito, não só que não foi.
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 1000)
  motivoDecisao?: string;
}
