import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoEvento } from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

export class EventoJornadaTratamentoDto {
  @IsEnum(TipoEvento)
  tipoEvento!: TipoEvento;

  @IsISO8601()
  timestampEvento!: string;
}

/**
 * Rodada 193: lançar uma jornada INTEIRA de uma vez (do "Início de
 * jornada" ao "Fim de jornada"), com um único motivo. Cada evento
 * continua virando um TratamentoPonto normal (mesma ancoragem em hash e
 * mesma validação de sequência do lançamento um a um), então nada nos
 * relatórios muda.
 */
export class CreateJornadaTratamentoDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EventoJornadaTratamentoDto)
  eventos!: EventoJornadaTratamentoDto[];

  @Sanitizar()
  @IsString()
  @Length(10, 400)
  motivo!: string;

  /// Fuso do motorista na jornada (min a leste do UTC). Sem ele, o servidor deduz pelos pontos dele.
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  fusoOffsetMin?: number;
}
