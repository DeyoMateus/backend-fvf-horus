import { IsBoolean } from 'class-validator';

// Nunca existe uma rota de apagar usuário , histórico de auditoria
// (quem lançou/aprovou o quê) referencia usuarioId. "Remover acesso" é
// sempre desativar (ativo: false), nunca excluir , mesmo raciocínio já
// aplicado a Motorista (Rodada 25).
export class AtualizarStatusUsuarioEmpresaDto {
  @IsBoolean()
  ativo!: boolean;
}
