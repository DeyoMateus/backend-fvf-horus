import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { StatusMotorista } from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Mesmo enum StatusMotorista (reaproveitado, não duplicado , ATIVO/
// INATIVO/SUSPENSO é um conceito genérico de "situação do cadastro",
// não algo específico de quem dirige). Ver comentário equivalente em
// atualizar-status-motorista.dto.ts , mesmo raciocínio de nunca apagar
// a linha de verdade, "Excluir cadastro" (excluir-ajudante.dto.ts)
// continua sendo soft-delete.
export class AtualizarStatusAjudanteDto {
  @IsEnum(StatusMotorista)
  status!: StatusMotorista;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  motivo?: string;
}
