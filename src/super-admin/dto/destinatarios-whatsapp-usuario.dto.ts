import { IsBoolean, IsOptional } from 'class-validator';

/** Rodada 164: o super admin define quem recebe alerta por WhatsApp. */
export class DestinatariosWhatsappUsuarioDto {
  /** Liga o WhatsApp pessoal do usuário (padrão: desligado). */
  @IsOptional()
  @IsBoolean()
  recebeWhatsappAlertas?: boolean;

  /** Liga o envio ao número da equipe de GR cadastrado por este usuário (padrão: ligado). */
  @IsOptional()
  @IsBoolean()
  recebeWhatsappEquipeGr?: boolean;
}
