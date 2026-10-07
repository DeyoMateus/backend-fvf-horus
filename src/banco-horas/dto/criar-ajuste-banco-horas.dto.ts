import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';
import { TipoAjusteBancoHoras } from '@prisma/client';

// Registrado manualmente pelo gestor , é a forma de "descontar e pagar
// de acordo com a lei ou o sindicato" (pedido explícito do usuário):
// COMPENSACAO quando o motorista tira folga pra abater do banco,
// PAGAMENTO quando o saldo é pago em dinheiro fora da plataforma (só
// o registro de QUE foi pago fica aqui, nunca o valor em R$), e as
// CORRECAO_* pra ajuste manual em qualquer sentido.
export class CriarAjusteBancoHorasDto {
  @IsEnum(TipoAjusteBancoHoras)
  tipo!: TipoAjusteBancoHoras;

  @IsInt()
  @Min(1)
  minutos!: number;

  @IsISO8601()
  data!: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  observacao?: string;
}
