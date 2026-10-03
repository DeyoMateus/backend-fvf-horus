import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import {
  Sanitizar,
  SomenteDigitos,
  NormalizarTelefone,
} from '../../common/sanitizacao/sanitizar.decorator';

// Rodada 66 , cadastro de Ajudante: mesmo raciocínio de CreateMotoristaDto
// (grupoId nunca vem daqui, sempre do token), mas SEM cnh e SEM
// placa/idRastreador/tecnologiaRastreador , decisão confirmada com o
// usuário: ajudante não dirige, não tem veículo vinculado.
export class CreateAjudanteDto {
  @Sanitizar()
  @IsString()
  @Length(3, 60)
  nome!: string;

  @SomenteDigitos()
  @IsString()
  @Length(11, 11)
  cpf!: string;

  @IsUUID()
  empresaId!: string;

  @IsOptional()
  @NormalizarTelefone()
  @IsString()
  telefone?: string;
}
