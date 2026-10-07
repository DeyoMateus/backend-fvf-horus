import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedefinirSenhaSuperAdminDto {
  @IsString()
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  novaSenha!: string;
}
