import { IsString, Length, MinLength } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class RejeitarSolicitacaoTrocaDto {
  @Sanitizar()
  @IsString()
  @MinLength(10, { message: 'Motivo da rejeição precisa de pelo menos 10 caracteres.' })
  @Length(0, 1000)
  motivo!: string;
}
