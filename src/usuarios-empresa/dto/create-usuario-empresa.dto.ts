import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { PapelUsuario } from '@prisma/client';
import {
  Sanitizar,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Cadastro de mais um usuário (gestor ou admin) dentro do PRÓPRIO grupo
 * de quem está pedindo , nunca cria/muda grupo, nunca aceita grupoId no
 * corpo (ver UsuariosEmpresaService.create, mesmo padrão de
 * EmpresasService.create/MotoristasService.create). Antes da Rodada 31
 * a única forma de existir um UsuarioEmpresa era o `prisma/seed.ts` ,
 * agora o próprio ADMIN do grupo consegue convidar o resto do time.
 */
export class CreateUsuarioEmpresaDto {
  // Limite de 60 (Rodada 40, pedido explícito do usuário).
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  @IsEnum(PapelUsuario)
  papel!: PapelUsuario;

  @IsOptional()
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message:
      'telefoneWhatsapp deve estar em formato E.164 (ex.: +5511999998888)',
  })
  telefoneWhatsapp?: string;
}
