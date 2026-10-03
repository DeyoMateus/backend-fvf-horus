import { IsEmail } from 'class-validator';

export class EsqueciSenhaSuperAdminDto {
  @IsEmail()
  email!: string;
}
