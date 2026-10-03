import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CategoriaTransporteSindical } from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Todo campo numérico tem um default sensato (mesmos valores da CLT/Lei
// 13.103) , o gestor só precisa mexer no que a convenção dele negociou
// diferente. Nada aqui é obrigatório além do nome, de propósito: cadastrar
// uma regra "quase padrão" com um ou dois ajustes tem que ser simples.
export class CreateRegraSindicalDto {
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  nome!: string;

  @IsOptional()
  @IsEnum(CategoriaTransporteSindical)
  categoriaTransporte?: CategoriaTransporteSindical;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  toleranciaMarcacaoMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  limiteJornadaNormalMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  limiteHoraExtraFaixa1Min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentualHoraExtra1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentualHoraExtra2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentualHoraExtraDomingoFeriado?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualAdicionalNoturno?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  duracaoMinutoNoturnoMin?: number;

  @IsOptional()
  @IsBoolean()
  bancoHorasAtivo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  bancoHorasPrazoExpiracaoMeses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bancoHorasLimiteAlertaMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  primeiroPeriodoDescansoMinimoMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  intervaloRefeicaoMinimoMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentualHoraEspera?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentualHoraEsperaRefeicao?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
