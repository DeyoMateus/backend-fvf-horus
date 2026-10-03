import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import {
  Sanitizar,
  SomenteDigitos,
} from '../../common/sanitizacao/sanitizar.decorator';

export class SolicitarTrocaDispositivoDto {
  @IsUUID()
  motoristaId!: string;

  /**
   * Segundo fator pra abrir a solicitação: já que este endpoint é
   * público de propósito (o motorista pode ter perdido toda credencial
   * de device), exigir o CPF do motorista junto do motoristaId fecha a
   * brecha de qualquer pessoa abrir um pedido de troca em nome de um
   * motorista só sabendo/adivinhando o id dele , sem saber o CPF
   * também, o pedido é rejeitado antes de virar uma solicitação
   * pendente esperando aprovação do gestor.
   */
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'cpfConfirmacao deve conter 11 dígitos numéricos',
  })
  cpfConfirmacao!: string;

  /** Gerado pelo app no aparelho novo , o mesmo deviceUuid que ficaria salvo se a troca for aprovada. */
  @IsUUID()
  deviceUuidSolicitado!: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 120)
  modeloAparelho?: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 120)
  sistemaOperacional?: string;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 500)
  observacaoMotorista?: string;
}
