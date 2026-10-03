import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { TecnologiaRastreador } from '@prisma/client';

export class AtualizarVeiculoDto {
  /** Formato antigo (ABC1234) ou Mercosul (ABC1D23) , normalizada em maiúsculas no service. */
  @IsString()
  @Matches(/^[A-Za-z]{3}\d([A-Za-z]\d{2}|\d{3})$/, {
    message:
      'placa inválida (use o formato antigo ABC1234 ou Mercosul ABC1D23)',
  })
  placa!: string;

  /** Preparado para a integração futura com rastreadores , opcional. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  idRastreador?: string;

  @IsOptional()
  @IsEnum(TecnologiaRastreador)
  tecnologiaRastreador?: TecnologiaRastreador;
}
