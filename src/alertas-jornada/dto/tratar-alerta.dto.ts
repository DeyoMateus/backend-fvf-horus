import { IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Diferente de "visualizar" (marca como lido, sem exigir nada): tratar
// exige uma observação , é o registro de que alguém de fato apurou este
// alerta e anotou o que encontrou (mesmo padrão de motivo obrigatório do
// TratamentoPonto). Nunca altera/apaga o alerta nem nenhum RegistroJornada.
export class TratarAlertaDto {
  @Sanitizar()
  @IsString()
  @Length(3, 1000)
  observacao!: string;
}
