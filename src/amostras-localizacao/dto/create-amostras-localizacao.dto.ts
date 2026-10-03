import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class AmostraLocalizacaoItemDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  precisaoGpsM?: number;

  @IsDateString()
  capturadoEm!: string;
}

export class CreateAmostrasLocalizacaoDto {
  // Lote: o app acumula localmente (offline-first) e sincroniza várias
  // amostras de uma vez quando a conexão volta , mesmo padrão do resto.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AmostraLocalizacaoItemDto)
  amostras!: AmostraLocalizacaoItemDto[];
}
