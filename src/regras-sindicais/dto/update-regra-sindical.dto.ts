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

// Não usa @nestjs/mapped-types (PartialType) de propósito: essa lib não
// está instalada neste projeto (ver decisão de minimizar dependências
// transitivas em StorageService) , todos os campos já nascem opcionais
// aqui, então update é só "o que vier no corpo, atualiza".
export class UpdateRegraSindicalDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  nome?: string;

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
