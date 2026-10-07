import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PapelUsuario } from '@prisma/client';
import {
  Sanitizar,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Cadastro de um novo `UsuarioEmpresa` (ADMIN ou GESTOR) dentro de um
 * grupo JÁ EXISTENTE , usado pelo super admin (Rodada 38).
 *
 * Antes desta rodada, depois que um grupo era provisionado
 * (`criarEmpresaMae`), o próprio ADMIN do cliente conseguia convidar o
 * resto do time (`POST /usuarios-empresa`, ADMIN-only). Por pedido
 * explícito do usuário, essa capacidade foi retirada do painel da
 * empresa: agora só o super admin da plataforma pode criar cadastro de
 * funcionário (admin/gestor) pra qualquer empresa cliente , o
 * cadastro de motoristas (`POST /motoristas`) não muda, continua sendo
 * feito pelo próprio ADMIN/GESTOR do grupo.
 */
export class CreateUsuarioGrupoDto {
  // Limite de 60 (Rodada 40, pedido explícito do usuário).
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nome!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  senha!: string;

  @IsEnum(PapelUsuario)
  papel!: PapelUsuario;

  @IsOptional()
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message:
      'telefoneWhatsapp deve estar em formato E.164, ex.: +5511999998888',
  })
  telefoneWhatsapp?: string;
}
