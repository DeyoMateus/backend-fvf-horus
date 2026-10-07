import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { StatusMotorista } from '@prisma/client';
import { Sanitizar } from '../../common/sanitizacao/sanitizar.decorator';

// Nunca existe (e nunca deve existir) uma rota que apaga de verdade a
// linha do motorista no banco , o cadastro é prova/evidência da empresa
// (certificado, hash genesis, histórico de registros vinculados) e não
// pode simplesmente sumir. "Desligar" um motorista pode ser só uma
// MUDANÇA DE STATUS (arquivo morto: INATIVO/SUSPENSO), sem sumir da
// listagem , ver MotoristasService.atualizarStatus.
//
// Rodada 65 , pedido explícito do usuário: além disso, agora também
// existe "Excluir cadastro" (MotoristasService.excluir / ExcluirMotoristaDto,
// em excluir-motorista.dto.ts), que tira o motorista da listagem normal
// do painel , mas continua sendo um soft-delete (`excluidoEm`), nunca
// um DELETE de verdade: todo o histórico (registros de jornada, alertas,
// folgas, documentos de carga) continua intacto e encontrável.
export class AtualizarStatusMotoristaDto {
  @IsEnum(StatusMotorista)
  status!: StatusMotorista;

  @IsOptional()
  @Sanitizar()
  @IsString()
  @Length(0, 400)
  motivo?: string;
}
