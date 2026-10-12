import { Injectable } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  podeVerLocalizacao,
  removerCoordenadas,
} from './localizacao-acesso.util';

export interface UsuarioParaLocalizacao {
  sub: string;
  papel: string;
}

/** Onde a localização foi consultada (vai para o log de auditoria). */
export type OrigemConsultaLocalizacao =
  | 'LISTA_REGISTROS'
  | 'ANALISE_INTEGRIDADE'
  | 'AEJ'
  | 'COMPROVANTE'
  | 'ESPELHO_REP_P'
  | 'HOLERITE';

const JANELA_DEDUPE_MS = 5 * 60 * 1000;

/**
 * Ponto único de decisão sobre localização no painel:
 *  - ADMIN e GESTOR: recebem os dados e cada consulta vira um registro
 *    `LOCALIZACAO_CONSULTADA` no log de auditoria (imutável). Consultas
 *    repetidas do mesmo usuário ao mesmo motorista/origem em 5 min viram
 *    um registro só, para a trilha não encher com atualizações de tela.
 *  - Papel desconhecido: as coordenadas são removidas da resposta (defesa em profundidade).
 */
@Injectable()
export class LocalizacaoAcessoService {
  private readonly ultimas = new Map<string, number>();

  constructor(private readonly audit: AuditService) {}

  /** Aplica a regra de papel e audita a consulta; devolve os dados já filtrados. */
  async filtrar<T>(
    usuario: UsuarioParaLocalizacao,
    motoristaId: string,
    origem: OrigemConsultaLocalizacao,
    dados: T,
    contexto?: { ip?: string | null; userAgent?: string | null },
  ): Promise<T> {
    if (!podeVerLocalizacao(usuario.papel)) {
      return removerCoordenadas(dados);
    }
    await this.auditar(usuario, motoristaId, origem, contexto);
    return dados;
  }

  private async auditar(
    usuario: UsuarioParaLocalizacao,
    motoristaId: string,
    origem: OrigemConsultaLocalizacao,
    contexto?: { ip?: string | null; userAgent?: string | null },
  ): Promise<void> {
    const agora = Date.now();
    const chave = `${usuario.sub}|${motoristaId}|${origem}`;
    const anterior = this.ultimas.get(chave);
    if (anterior !== undefined && agora - anterior < JANELA_DEDUPE_MS) return;
    this.ultimas.set(chave, agora);
    if (this.ultimas.size > 5000) {
      for (const [k, t] of this.ultimas) {
        if (agora - t >= JANELA_DEDUPE_MS) this.ultimas.delete(k);
      }
    }
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuario.sub,
      acao: 'LOCALIZACAO_CONSULTADA',
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: { origem },
      ip: contexto?.ip ?? null,
      userAgent: contexto?.userAgent ?? null,
    });
  }
}
