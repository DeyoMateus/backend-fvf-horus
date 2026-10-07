import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Edição, pelo super admin, do nome/e-mail de um usuário (gestor ou
 * admin) de qualquer grupo (Rodada 32) , cobre principalmente o caso
 * de corrigir um erro de digitação. Nunca altera papel/senha por aqui.
 * Desde a Rodada 38, ativar/desativar e criar um novo usuário também
 * são responsabilidade do super admin (ver `CreateUsuarioGrupoDto` e
 * `PATCH grupos/:grupoId/usuarios/:usuarioId/status`) , o painel da
 * própria empresa não tem mais essa capacidade.
 */
export class UpdateUsuarioSuperAdminDto {
  // Limite de 60 (Rodada 40, pedido explícito do usuário).
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nome?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
