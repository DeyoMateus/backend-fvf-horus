import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Feriado varia de cidade para cidade , não existe fonte de dados
// nacional/municipal embutida no sistema (ver comentário no
// schema.prisma, model Feriado). É o RH quem decide o que a empresa
// aceita como feriado pago com percentual equivalente ao domingo, e o
// que é só informativo.
export class CreateFeriadoDto {
  @IsDateString()
  data!: string;

  @Sanitizar()
  @IsString()
  @Length(2, 200)
  descricao!: string;

  /// Quando ausente, o feriado vale para TODOS os CNPJs do grupo.
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsBoolean()
  pagoComoDomingo?: boolean;
}
