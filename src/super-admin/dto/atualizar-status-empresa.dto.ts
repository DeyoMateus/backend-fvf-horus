import { IsBoolean } from 'class-validator';

/** Ativar/desativar um CNPJ do grupo (Rodada 32) , nunca apaga nada. */
export class AtualizarStatusEmpresaDto {
  @IsBoolean()
  ativo!: boolean;
}
