import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { TecnologiaRastreador } from '@prisma/client';
import {
  Sanitizar,
  SomenteDigitos,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

// grupoId de PROPÓSITO não existe aqui , o "tenant" (grupo) de quem
// está criando vem sempre do token JWT, nunca do corpo da requisição.
//
// empresaId (o CNPJ específico dentro do grupo a que este motorista
// vai pertencer) já EXISTE aqui de propósito, diferente de grupoId:
// desde que um grupo pode ter vários CNPJs, alguém precisa dizer qual
// deles é o empregador deste motorista. Isso é seguro porque o
// service SEMPRE confere (via TenantService) que o empresaId
// informado pertence ao grupo de quem está autenticado antes de
// aceitar , nunca confia ciegamente no valor, só valida contra o
// tenant real.
export class CreateMotoristaDto {
  // Limite de 60 (Rodada 40, pedido explícito do usuário) , generoso
  // pro nome completo mais extenso do dia a dia, descarta digitação
  // acidental de texto enorme/colado no campo errado. `Sanitizar()`
  // roda ANTES de `@Length`, então o limite conta os caracteres já
  // limpos (sem tag HTML, sem espaço redundante).
  @Sanitizar()
  @IsString()
  @Length(3, 60)
  nome!: string;

  // `SomenteDigitos()` aceita o usuário digitando/colando com pontuação
  // (123.456.789-00) , só o dígito importa pro `@Matches` a seguir.
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'cpf deve conter 11 dígitos numéricos' })
  cpf!: string;

  @SomenteDigitos()
  @IsString()
  @Length(5, 20)
  cnh!: string;

  @IsUUID()
  empresaId!: string;

  /**
   * Placa do veículo de TRAÇÃO (o cavalo mecânico que puxa a carga,
   * não o reboque/carreta) , OPCIONAL no cadastro (pode não ter
   * veículo definido ainda no momento de cadastrar o motorista; o
   * gestor ou o próprio motorista preenche depois pelo painel/app).
   * Quando informada, aceita o formato antigo (ABC1234) ou o
   * Mercosul (ABC1D23); normalizada em maiúsculas no service.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}\d([A-Za-z]\d{2}|\d{3})$/, {
    message:
      'placa inválida (use o formato antigo ABC1234 ou Mercosul ABC1D23)',
  })
  placa?: string;

  /** Preparado para a integração futura com rastreadores , opcional. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  idRastreador?: string;

  @IsOptional()
  @IsEnum(TecnologiaRastreador)
  tecnologiaRastreador?: TecnologiaRastreador;

  /**
   * Telefone de contato do motorista , OBRIGATÓRIO no cadastro
   * (Rodada 74, pedido explícito do usuário: nome, CPF e contato
   * passam a ser itens obrigatórios). Era opcional desde a Rodada 44;
   * o motorista também pode editar depois pelo próprio app, mas o
   * cadastro já precisa vir com um contato válido. Mesmo formato
   * E.164 usado no resto do sistema (telefoneWhatsapp do usuário do
   * painel, telefone do "Meu perfil" do motorista no app).
   */
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message: 'telefone deve estar em formato E.164 (ex.: +5511999998888)',
  })
  telefone!: string;
}
