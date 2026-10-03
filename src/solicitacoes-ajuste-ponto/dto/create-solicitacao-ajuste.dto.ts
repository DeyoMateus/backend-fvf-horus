import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { TipoEvento } from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Preenchido pelo próprio motorista no app: "esqueci de bater, era mais
// ou menos este horário, por este motivo". Nunca vira um horário oficial
// sozinho , só depois que o RH decidir (ver SolicitacoesAjustePontoService).
export class CreateSolicitacaoAjusteDto {
  @IsEnum(TipoEvento)
  tipoEvento!: TipoEvento;

  @IsISO8601()
  timestampEvento!: string;

  @Sanitizar()
  @IsString()
  @Length(10, 1000)
  justificativa!: string;

  @IsOptional()
  @IsUUID()
  registroReferenciaId?: string;
}
