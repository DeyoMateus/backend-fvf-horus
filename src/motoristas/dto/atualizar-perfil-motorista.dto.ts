import { IsString, Length, Matches } from 'class-validator';
import {
  Sanitizar,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * "Meu perfil" no app do motorista (Rodada 39) , ele mesmo edita seu
 * nome e contato (telefone). CPF nunca aparece aqui: é documento de
 * identidade do motorista, não é editável por ninguém pelo sistema
 * (mudar CPF é, na prática, trocar de pessoa). Sem e-mail de propósito
 * (Rodada 40, pedido do usuário: não tem necessidade para o
 * motorista) , quem precisa de e-mail é o ADMIN/GESTOR (é a própria
 * credencial de login do painel).
 *
 * Diferente do perfil do ADMIN/GESTOR (`UpdatePerfilProprioDto`, que
 * aceita campos opcionais), aqui os dois campos são OBRIGATÓRIOS e
 * NUNCA vazios , pedido explícito do usuário ("os dados não podem
 * ficar vazios"). O formulário do app sempre envia os dois juntos.
 *
 * Limite de 60 caracteres no nome (Rodada 40, pedido explícito do
 * usuário) , generoso pro nome completo mais extenso do dia a dia,
 * mas descarta digitação acidental de textos enormes/coisas coladas
 * no campo errado.
 */
export class AtualizarPerfilMotoristaDto {
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nome!: string;

  // E.164 (Rodada 41 , o app monta "+<código do país><DDD><número>"
  // a partir do seletor de país com bandeira, o motorista só digita o
  // resto), mesmo formato/padrão já usado pro telefoneWhatsapp do
  // ADMIN/GESTOR.
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message: 'telefone deve estar em formato E.164 (ex.: +5511999998888)',
  })
  telefone!: string;
}
