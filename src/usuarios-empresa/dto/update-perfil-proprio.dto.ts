import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  Sanitizar,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * "Meu perfil" (Rodada 38) , o próprio ADMIN/GESTOR logado edita seu
 * nome, contato (WhatsApp) e e-mail. Nunca altera papel/senha/status
 * por aqui: papel e status são responsabilidade do super admin (desde
 * que a criação/gestão de funcionário saiu do painel da empresa), e
 * troca de senha continua pelo fluxo de "esqueci minha senha".
 */
export class UpdatePerfilProprioDto {
  // Limite de 60 (Rodada 40, pedido explícito do usuário).
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message:
      'telefoneWhatsapp deve estar em formato E.164, ex.: +5511999998888',
  })
  telefoneWhatsapp?: string;
}
