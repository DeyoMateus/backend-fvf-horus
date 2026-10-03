import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext, SISTEMA } from '../tenant/tenant-context';
import { normalizarPaginacao } from '../pagination/pagination.util';

export interface RegistrarAuditoriaInput {
  actorType: ActorType;
  actorId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Normalmente NÃO precisa ser passado , é derivado automaticamente do
   * TenantContext ativo no momento da chamada (Rodada 66). Só é preciso
   * informar explicitamente quando o chamador quer forçar um valor
   * diferente do contexto atual (raro; hoje nenhum ponto do backend faz
   * isso). Passar `null` explicitamente força o log a ficar sem grupo
   * mesmo dentro de um contexto de tenant.
   */
  grupoId?: string | null;
}

export interface FiltroAuditoria {
  page?: number;
  pageSize?: number;
  actorType?: ActorType;
  /**
   * Tipos de ator SEMPRE excluídos, não importa o que `actorType`
   * pedir (Rodada 74, pedido explícito do usuário: "o admin não pode
   * vê o que o super admin fez"). `AuditoriaController` (painel
   * ADMIN/GESTOR) sempre passa `[SUPER_ADMIN]` aqui , em cima da
   * proteção que já existe via `grupoId` (ações do super admin nunca
   * carregam um grupoId, ver `resolverGrupoId`/migration de RLS), como
   * segunda camada: mesmo que algum código futuro passe a gravar um
   * grupoId numa ação de super admin, ela continua invisível pra esse
   * painel.
   */
  excluirActorTypes?: ActorType[];
  /** Filtro por várias ações ao mesmo tempo , "selecionar os ocorridos" no painel visual (Rodada 66). */
  acoes?: string[];
  entidade?: string;
  entidadeId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  /** Rodada 108 , ver comentário equivalente em ListarAuditoriaDto. Default 'desc'. */
  ordem?: 'asc' | 'desc';
}

/**
 * Trilha de auditoria imutável (append-only, protegida por trigger
 * WORM no Postgres , ver migration add_auth_signature_audit).
 * Nunca deve ser usada para decidir Regras sindicais; é só para
 * investigação/compliance, então uma falha ao gravar auditoria não
 * pode travar a operação principal (fail-open aqui, com log local).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    try {
      const grupoId = this.resolverGrupoId(input.grupoId);
      await this.prisma.auditLog.create({
        data: {
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          acao: input.acao,
          entidade: input.entidade,
          entidadeId: input.entidadeId ?? null,
          detalhes: (input.detalhes ?? undefined) as Prisma.InputJsonValue,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          grupoId,
        },
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gravar audit log (${input.acao}/${input.entidade})`,
        err as Error,
      );
    }
  }

  /**
   * `undefined` → deriva do TenantContext ativo (comportamento padrão);
   * `null`/string → respeita o que o chamador pediu explicitamente.
   * O sentinela SISTEMA nunca é gravado como grupo real , vira null.
   */
  private resolverGrupoId(explicito: string | null | undefined): string | null {
    if (explicito !== undefined) return explicito;
    const ctx = TenantContext.atual();
    if (!ctx || ctx.grupoId === SISTEMA) return null;
    return ctx.grupoId;
  }

  /**
   * Lista ocorrências da trilha de auditoria, paginado. Quando `grupoId`
   * é informado, restringe ao grupo (painel ADMIN/GESTOR); `null` significa
   * "sem restrição de grupo" (painel SUPER_ADMIN vê a plataforma inteira).
   */
  async listar(filtro: FiltroAuditoria, grupoId: string | null) {
    const paginacao = normalizarPaginacao(filtro.page, filtro.pageSize);
    // BUG (Rodada 95): as duas condições abaixo escreviam a MESMA chave
    // `actorType` dentro do mesmo objeto literal , em JS/TS, quando duas
    // entradas de um spread colidem, a ÚLTIMA sempre vence. Como
    // `excluirActorTypes` é passado em TODA chamada do painel ADMIN/GESTOR
    // (sempre `[SUPER_ADMIN]`), o `{ actorType: { notIn: [...] } }`
    // sobrescrevia silenciosamente o `{ actorType: filtro.actorType }`
    // escolhido pelo usuário no filtro "Quem fez" , ou seja, o filtro por
    // tipo de ator nunca era aplicado de fato, só o "excluir super admin".
    // Corrigido para serem mutuamente exclusivos: quando um actorType
    // específico é pedido, ele já implica em não trazer os tipos da lista
    // de exclusão (nenhuma opção do seletor do painel ADMIN/GESTOR permite
    // escolher SUPER_ADMIN , ver AuditoriaPage.tsx), então não há conflito.
    const actorTypeWhere: Prisma.AuditLogWhereInput['actorType'] =
      filtro.actorType
        ? filtro.actorType
        : filtro.excluirActorTypes && filtro.excluirActorTypes.length > 0
          ? { notIn: filtro.excluirActorTypes }
          : undefined;

    const where: Prisma.AuditLogWhereInput = {
      ...(grupoId !== null ? { grupoId } : {}),
      ...(actorTypeWhere !== undefined ? { actorType: actorTypeWhere } : {}),
      ...(filtro.acoes && filtro.acoes.length > 0
        ? { acao: { in: filtro.acoes } }
        : {}),
      ...(filtro.entidade ? { entidade: filtro.entidade } : {}),
      ...(filtro.entidadeId ? { entidadeId: filtro.entidadeId } : {}),
      ...(filtro.dataInicio || filtro.dataFim
        ? {
            createdAt: {
              ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
              ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
            },
          }
        : {}),
    };

    const [dados, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: filtro.ordem ?? 'desc' },
        skip: paginacao.skip,
        take: paginacao.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const dadosComNome = await this.resolverNomesDosAtores(dados);
    return {
      dados: dadosComNome,
      total,
      page: paginacao.page,
      pageSize: paginacao.pageSize,
    };
  }

  /**
   * Resolve `actorId` -> nome de verdade da pessoa (Rodada 74, pedido
   * explícito do usuário: "não deve ter nomes genericos como
   * Motorista (app), Usuário do painel , deve conter o nome correto de
   * cada usuario"). Antes disso, o painel só mostrava o TIPO de ator
   * (USUARIO_EMPRESA/MOTORISTA/SUPER_ADMIN), nunca quem de fato agiu.
   *
   * Cada `actorType` aponta pra uma tabela diferente (nunca as três ao
   * mesmo tempo) , três buscas em lote, uma por tipo, e não uma por
   * registro (evita N+1 numa página de 50 linhas). `usuarioEmpresa` e
   * `motorista` passam pelo `this.prisma` normal (RLS ativo pro
   * contexto de tenant da requisição atual , admin só resolve nomes do
   * próprio grupo, exatamente como o resto do painel; super admin, em
   * contexto SISTEMA, resolve de qualquer grupo). `superAdminUsuario`
   * fica de fora do RLS de propósito (não pertence a nenhum grupo , ver
   * `prisma.service.ts`), então é uma busca direta.
   *
   * Quando o ator já foi excluído/não é mais encontrado, `actorNome`
   * fica `null` e o painel cai de volta pro rótulo do tipo , nunca
   * quebra a listagem.
   */
  private async resolverNomesDosAtores<
    T extends { actorType: ActorType; actorId: string | null },
  >(dados: T[]): Promise<(T & { actorNome: string | null })[]> {
    const idsUsuarioEmpresa = [
      ...new Set(
        dados
          .filter((d) => d.actorType === ActorType.USUARIO_EMPRESA && d.actorId)
          .map((d) => d.actorId as string),
      ),
    ];
    const idsMotorista = [
      ...new Set(
        dados
          .filter((d) => d.actorType === ActorType.MOTORISTA && d.actorId)
          .map((d) => d.actorId as string),
      ),
    ];
    const idsSuperAdmin = [
      ...new Set(
        dados
          .filter((d) => d.actorType === ActorType.SUPER_ADMIN && d.actorId)
          .map((d) => d.actorId as string),
      ),
    ];

    const [usuarios, motoristas, superAdmins] = await Promise.all([
      idsUsuarioEmpresa.length > 0
        ? this.prisma.usuarioEmpresa.findMany({
            where: { id: { in: idsUsuarioEmpresa } },
            select: { id: true, nome: true },
          })
        : [],
      idsMotorista.length > 0
        ? this.prisma.motorista.findMany({
            where: { id: { in: idsMotorista } },
            select: { id: true, nome: true },
          })
        : [],
      idsSuperAdmin.length > 0
        ? this.prisma.superAdminUsuario.findMany({
            where: { id: { in: idsSuperAdmin } },
            select: { id: true, nome: true },
          })
        : [],
    ]);

    const mapaNomes = new Map<string, string>();
    for (const u of usuarios) mapaNomes.set(u.id, u.nome);
    for (const m of motoristas) mapaNomes.set(m.id, m.nome);
    for (const s of superAdmins) mapaNomes.set(s.id, s.nome);

    return dados.map((d) => ({
      ...d,
      actorNome: d.actorId ? (mapaNomes.get(d.actorId) ?? null) : null,
    }));
  }

  /**
   * Lista os tipos de ocorrência (combinações ação/entidade) distintos
   * já gravados , alimenta o seletor visual do painel ("selecionando os
   * ocorridos"), pra mostrar só o que de fato já existe em vez de uma
   * lista estática que pode desalinhar do código com o tempo.
   */
  async listarTiposOcorridos(
    grupoId: string | null,
  ): Promise<{ acao: string; entidade: string }[]> {
    const registros = await this.prisma.auditLog.findMany({
      where: grupoId !== null ? { grupoId } : {},
      select: { acao: true, entidade: true },
      distinct: ['acao', 'entidade'],
      orderBy: [{ entidade: 'asc' }, { acao: 'asc' }],
      take: 500,
    });
    return registros;
  }
}
