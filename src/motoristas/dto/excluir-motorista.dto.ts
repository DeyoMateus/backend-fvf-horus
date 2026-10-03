import { IsOptional, IsString, Length } from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

/**
 * "Excluir cadastro" (Rodada 65) , motivo é opcional pra não travar
 * quem só quer remover rápido, mas fica registrado no AuditLog
 * (junto com quem excluiu e quando) se for informado. Mesmo padrão de
 * `AtualizarStatusMotoristaDto.motivo`.
 */
export class ExcluirMotoristaDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  motivo?: string;
}
