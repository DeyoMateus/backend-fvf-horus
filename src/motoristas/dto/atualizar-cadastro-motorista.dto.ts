import { IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  Sanitizar,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

/**
 * Edição dos dados cadastrais do motorista pelo painel (Rodada 74,
 * pedido explícito do usuário: "deve ser possível editar os dados
 * cadastrais").
 *
 * De propósito NÃO inclui `cpf` nem `cnh`: os dois entram no cálculo
 * do `hashGenesis` (a âncora da cadeia de jornada , ver
 * `HashChainService.gerarHashGenesis` e `MotoristasService.create`) e
 * o CPF também fica gravado dentro do certificado digital emitido na
 * hora do cadastro (`CertificateService.gerarParaMotorista`). Trocar
 * qualquer um dos dois depois de criado desalinha o que está impresso
 * no comprovante/AFD do que a cadeia de hash e o certificado
 * realmente atestam , um typo em CPF/CNH não se corrige editando o
 * cadastro, é caso de excluir e recadastrar o motorista (o soft-delete
 * já existente preserva todo o histórico de qualquer forma).
 */
export class AtualizarCadastroMotoristaDto {
  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(3, 60)
  nome?: string;

  @IsOptional()
  @NormalizarTelefone()
  @IsString()
  @Matches(/^\+\d{10,15}$/, {
    message: 'telefone deve estar em formato E.164 (ex.: +5511999998888)',
  })
  telefone?: string;
}
