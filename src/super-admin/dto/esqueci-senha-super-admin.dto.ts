import { IsEmail, MaxLength } from 'class-validator';

export class EsqueciSenhaSuperAdminDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
