import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  Sanitizar,
  SomenteDigitos,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Provisionamento de um cliente novo (Rodada 31): cria, na mesma
 * transação, o Grupo (empresa mãe), o primeiro CNPJ (Empresa) dela e o
 * primeiro usuário ADMIN do painel , é o único jeito de uma empresa
 * ganhar uma conta, já que não existe endpoint público de
 * auto-registro (por desenho, desde a Rodada 5). Esse ADMIN, depois de
 * logar, pode cadastrar mais CNPJs (POST /empresas), outros gestores
 * (POST /usuarios-empresa) e motoristas (POST /motoristas) , o super
 * admin nunca precisa fazer isso por eles.
 */
export class CreateEmpresaMaeDto {
  @Sanitizar()
  @IsString()
  @Length(3, 200)
  razaoSocialGrupo!: string;

  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'cnpjEmpresa deve conter 14 dígitos numéricos',
  })
  cnpjEmpresa!: string;

  @Sanitizar()
  @IsString()
  @Length(3, 200)
  razaoSocialEmpresa!: string;

  // Limite de 60 (Rodada 40, pedido explícito do usuário).
  @Sanitizar()
  @IsString()
  @Length(2, 60)
  nomeAdmin!: string;

  @IsEmail()
  @MaxLength(254)
  emailAdmin!: string;

  /**
   * Senha inicial do ADMIN, definida pelo super admin (mesmo padrão já
   * usado em `prisma/seed.ts` pro primeiro admin demo) , não existe
   * ainda um fluxo de "esqueci/trocar senha" no sistema (ver
   * pendências), então quem cadastra o cliente é responsável por
   * repassar essa senha a ele por um canal seguro e orientar a troca.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  senhaAdmin!: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  registroInpiAfd?: string;
}
