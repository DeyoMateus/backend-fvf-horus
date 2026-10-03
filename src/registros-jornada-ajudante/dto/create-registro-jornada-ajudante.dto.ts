import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';
import { TipoEvento } from '@prisma/client';

/**
 * Rodada 66 , pedido do usuário: o ajudante "vai ter apenas início de
 * jornada, descanso [início de descanso], fim de descanso e fim de
 * jornada". Só estes 4 valores são aceitos (validado abaixo com
 * `@IsIn` sobre o mesmo enum TipoEvento do Motorista , reaproveitado,
 * não duplicado); qualquer outro tipo (INICIO_DIRECAO, ESPERA_CARGA_DESCARGA
 * etc., que só fazem sentido para quem dirige) é rejeitado aqui.
 */
export const TIPOS_EVENTO_AJUDANTE = [
  TipoEvento.INICIO_JORNADA,
  TipoEvento.INICIO_DESCANSO,
  TipoEvento.FIM_DESCANSO,
  TipoEvento.FIM_JORNADA,
] as const;

export class CreateRegistroJornadaAjudanteDto {
  @IsIn(TIPOS_EVENTO_AJUDANTE)
  tipoEvento!: TipoEvento;

  @IsISO8601()
  timestampEvento!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precisaoGpsM?: number;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  observacao?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
