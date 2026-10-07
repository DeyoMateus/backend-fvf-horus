import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Rodada 167: "âncora" externa da cadeia de registros.
 *
 * A cadeia de hashes detecta alteração no MEIO do histórico, mas não
 * detecta apagar o final da cadeia (ou tudo): sobra nada para comparar.
 * Esta âncora guarda FORA do banco (R2), a cada varredura, por motorista:
 * quantidade de eventos, número e hash do último. Na varredura seguinte, o
 * banco precisa ainda conter exatamente aquele último evento (mesmo hash)
 * e não ter menos eventos que antes. Se não tiver, é exclusão/regressão:
 * alerta crítico + WhatsApp para a GR, e a âncora NÃO é atualizada (o
 * problema não "vira normal" na próxima hora).
 *
 * O arquivo é assinado com HMAC (chave derivada da CRYPTO_MASTER_KEY): quem
 * só tem acesso ao bucket não consegue forjar uma âncora que case com um
 * banco adulterado. Limites: eventos apagados entre duas varreduras (menos
 * de 1h) antes de existir âncora deles não são detectáveis; quem controla
 * o backend (com a chave) E o bucket poderia forjar tudo.
 *
 * Reinício deliberado (ex.: limpar o banco para recomeçar testes):
 * defina INTEGRIDADE_ANCORA_REINICIAR=AAAA-MM-DD (data de HOJE, UTC) e
 * reinicie o backend; só vale naquele dia e fica registrado em
 * `ancoras-integridade/reinicios/`.
 */
interface AncoraMotorista {
  motoristaId: string;
  empresaId: string;
  nome: string;
  total: number;
  ultimoSequencial: number | null;
  ultimoHash: string | null;
}

interface Ancora {
  versao: 1;
  geradoEm: string;
  motoristas: AncoraMotorista[];
}

type AncoraAssinada = Ancora & { assinatura: string };

interface Violacao {
  motorista: AncoraMotorista;
  motivo: string;
}

export interface ResultadoAncora {
  estado:
    | 'sem_storage'
    | 'baseline_criada'
    | 'ok'
    | 'reiniciada'
    | 'violacao'
    | 'ancora_adulterada';
  motoristas?: number;
  violacoes?: number;
}

const PREFIXO = 'ancoras-integridade';
const CHAVE_ULTIMA = `${PREFIXO}/ultima.json`;
const REAVISO_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AncoraIntegridadeService {
  private readonly logger = new Logger(AncoraIntegridadeService.name);
  private avisoStorageEmitido = false;
  private readonly avisados = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private chaveHmac(): Buffer {
    const mestra = process.env.CRYPTO_MASTER_KEY;
    if (!mestra || mestra.length < 32) {
      throw new Error(
        'CRYPTO_MASTER_KEY ausente: não dá para assinar a âncora.',
      );
    }
    return Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(mestra, 'hex'),
        Buffer.alloc(0),
        'fvf-horus/ancora-integridade/v1',
        32,
      ),
    );
  }

  private assinar(a: Ancora): string {
    const corpo = JSON.stringify({
      versao: a.versao,
      geradoEm: a.geradoEm,
      motoristas: a.motoristas,
    });
    return createHmac('sha256', this.chaveHmac()).update(corpo).digest('hex');
  }

  private assinaturaConfere(a: AncoraAssinada): boolean {
    const esperado = Buffer.from(this.assinar(a), 'hex');
    const recebido = Buffer.from(String(a.assinatura ?? ''), 'hex');
    return (
      esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
    );
  }

  private async montarSnapshot(): Promise<AncoraMotorista[]> {
    const linhas = await this.prisma.$queryRaw<
      Array<{
        motoristaId: string;
        empresaId: string;
        nome: string;
        total: number;
        ultimoSequencial: number | null;
        ultimoHash: string | null;
      }>
    >(Prisma.sql`
      SELECT m.id AS "motoristaId", m."empresaId" AS "empresaId", m.nome AS nome,
             COALESCE(c.total, 0)::int AS total,
             u.sequencial::int AS "ultimoSequencial",
             u."hashAtual" AS "ultimoHash"
      FROM motoristas m
      LEFT JOIN (
        SELECT "motoristaId", count(*) AS total
        FROM registros_jornada GROUP BY "motoristaId"
      ) c ON c."motoristaId" = m.id
      LEFT JOIN (
        SELECT DISTINCT ON ("motoristaId") "motoristaId", sequencial, "hashAtual"
        FROM registros_jornada
        ORDER BY "motoristaId", sequencial DESC
      ) u ON u."motoristaId" = m.id
      ORDER BY m.id
    `);
    return linhas.map((l) => ({
      motoristaId: l.motoristaId,
      empresaId: l.empresaId,
      nome: l.nome,
      total: Number(l.total),
      ultimoSequencial:
        l.ultimoSequencial === null ? null : Number(l.ultimoSequencial),
      ultimoHash: l.ultimoHash,
    }));
  }

  private async lerUltima(): Promise<
    | { tipo: 'ausente' }
    | { tipo: 'adulterada' }
    | { tipo: 'ok'; ancora: Ancora }
  > {
    let buffer: Buffer;
    try {
      buffer = await this.storage.baixarObjeto(CHAVE_ULTIMA);
    } catch (err) {
      if (/respondeu 404/.test((err as Error).message))
        return { tipo: 'ausente' };
      throw err; // R2 indisponível: não trata como "sem âncora" (não reinicia a base).
    }
    try {
      const a = JSON.parse(buffer.toString('utf8')) as AncoraAssinada;
      if (a.versao !== 1 || !Array.isArray(a.motoristas))
        return { tipo: 'adulterada' };
      if (!this.assinaturaConfere(a)) return { tipo: 'adulterada' };
      return { tipo: 'ok', ancora: a };
    } catch {
      return { tipo: 'adulterada' };
    }
  }

  private async gravarUltima(
    snapshot: AncoraMotorista[],
    agora: Date,
  ): Promise<void> {
    const a: Ancora = {
      versao: 1,
      geradoEm: agora.toISOString(),
      motoristas: snapshot,
    };
    const assinada: AncoraAssinada = { ...a, assinatura: this.assinar(a) };
    const corpo = Buffer.from(JSON.stringify(assinada), 'utf8');
    await this.storage.subirObjeto(CHAVE_ULTIMA, corpo, 'application/json');

    // Cópia diária: só a primeira do dia (não sobrescreve se já existir).
    const chaveDia = `${PREFIXO}/${agora.toISOString().slice(0, 10)}.json`;
    try {
      await this.storage.baixarObjeto(chaveDia);
    } catch (err) {
      if (/respondeu 404/.test((err as Error).message)) {
        await this.storage.subirObjeto(chaveDia, corpo, 'application/json');
      } else {
        throw err;
      }
    }
  }

  private async registrarArquivo(
    pasta: string,
    conteudo: unknown,
    agora: Date,
  ): Promise<void> {
    try {
      await this.storage.subirObjeto(
        `${PREFIXO}/${pasta}/${agora.toISOString()}.json`,
        Buffer.from(JSON.stringify(conteudo, null, 2), 'utf8'),
        'application/json',
      );
    } catch (err) {
      this.logger.warn(
        `Não consegui gravar ${pasta} no R2: ${(err as Error).message}`,
      );
    }
  }

  private async compararComAncora(
    ancora: Ancora,
    snapshot: AncoraMotorista[],
  ): Promise<Violacao[]> {
    const atual = new Map(snapshot.map((m) => [m.motoristaId, m]));
    const violacoes: Violacao[] = [];

    const comUltimo = ancora.motoristas.filter(
      (m) => m.ultimoSequencial !== null && atual.has(m.motoristaId),
    );
    const existentes = comUltimo.length
      ? await this.prisma.registroJornada.findMany({
          where: {
            OR: comUltimo.map((m) => ({
              motoristaId: m.motoristaId,
              sequencial: m.ultimoSequencial as number,
            })),
          },
          select: { motoristaId: true, sequencial: true, hashAtual: true },
        })
      : [];
    const hashExistente = new Map(
      existentes.map((r) => [`${r.motoristaId}:${r.sequencial}`, r.hashAtual]),
    );

    for (const m of ancora.motoristas) {
      const cur = atual.get(m.motoristaId);
      if (!cur) {
        violacoes.push({ motorista: m, motivo: 'motorista não existe mais' });
        continue;
      }
      if (cur.total < m.total) {
        violacoes.push({
          motorista: m,
          motivo: `tinha ${m.total} evento(s) e agora tem ${cur.total}`,
        });
        continue;
      }
      if (m.ultimoSequencial !== null) {
        const hash = hashExistente.get(
          `${m.motoristaId}:${m.ultimoSequencial}`,
        );
        if (hash === undefined) {
          violacoes.push({
            motorista: m,
            motivo: `o evento nº ${m.ultimoSequencial} não existe mais`,
          });
        } else if (hash !== m.ultimoHash) {
          violacoes.push({
            motorista: m,
            motivo: `o evento nº ${m.ultimoSequencial} foi alterado`,
          });
        }
      }
    }
    return violacoes;
  }

  private async reportar(
    violacoes: Violacao[],
    geradoEm: string,
    agora: Date,
    adulterada: boolean,
    empresasParaAvisar: string[] = [],
  ): Promise<void> {
    if (adulterada) {
      const k = '__ancora_adulterada__';
      if (agora.getTime() - (this.avisados.get(k) ?? 0) < REAVISO_MS) return;
      this.avisados.set(k, agora.getTime());
      // Sem WhatsApp: integridade/fraude aparece só no painel e no log.
      void empresasParaAvisar;
    }
    const novas = violacoes.filter((v) => {
      const k = `${v.motorista.motoristaId}:${v.motivo}`;
      const ultimo = this.avisados.get(k) ?? 0;
      return agora.getTime() - ultimo >= REAVISO_MS;
    });
    if (novas.length === 0 && !adulterada) return;
    for (const v of novas)
      this.avisados.set(
        `${v.motorista.motoristaId}:${v.motivo}`,
        agora.getTime(),
      );

    await this.registrarArquivo(
      'incidentes',
      { adulterada, ancoraDe: geradoEm, violacoes },
      agora,
    );

    try {
      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        acao: 'INTEGRIDADE_ANCORA_VIOLADA',
        entidade: 'Sistema',
        detalhes: {
          adulterada,
          ancoraDe: geradoEm,
          violacoes: violacoes.map((v) => ({
            motoristaId: v.motorista.motoristaId,
            motivo: v.motivo,
          })),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Auditoria da violação falhou: ${(err as Error).message}`,
      );
    }

    // Alerta no painel (só quando ainda há algum registro do motorista para
    // ligar o alerta; se tudo sumiu, valem o WhatsApp, o log e o arquivo no R2).
    for (const v of novas) {
      try {
        const ultimo = await this.prisma.registroJornada.findFirst({
          where: { motoristaId: v.motorista.motoristaId },
          orderBy: { sequencial: 'desc' },
          select: { id: true, timestampEvento: true },
        });
        if (!ultimo) continue;
        const assinatura = `ancora:${geradoEm}:${v.motorista.motoristaId}`;
        const jaTem = (
          await this.prisma.alertaJornada.findMany({
            where: {
              motoristaId: v.motorista.motoristaId,
              tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
            },
            select: { detalhes: true },
          })
        ).some(
          (a) =>
            (a.detalhes as { assinatura?: string } | null)?.assinatura ===
            assinatura,
        );
        if (jaTem) continue;
        await this.prisma.alertaJornada.create({
          data: {
            motoristaId: v.motorista.motoristaId,
            tipo: 'INTEGRIDADE_CADEIA_VIOLADA',
            severidade: 'CRITICO',
            mensagem:
              `Integridade violada: comparando com o último ponto de verificação ` +
              `guardado fora do banco, ${v.motivo}. Possível exclusão ou alteração ` +
              `direta no banco de dados.`,
            janelaInicio: ultimo.timestampEvento,
            janelaFim: ultimo.timestampEvento,
            minutosAcumulados: 0,
            registroGeradorId: ultimo.id,
            detalhes: {
              assinatura,
              motivo: v.motivo,
              origem: 'ancora_externa',
            },
          },
        });
      } catch (err) {
        this.logger.warn(
          `Falha ao criar alerta da âncora (${v.motorista.motoristaId}): ${(err as Error).message}`,
        );
      }
    }

    // Sem WhatsApp: violação da âncora aparece só no sininho do painel (alerta
    // criado acima), na auditoria e no log.
    if (adulterada) {
      this.logger.error(
        'A âncora guardada no R2 não confere com a assinatura (adulterada ou chave diferente).',
      );
    }
  }

  async executar(): Promise<ResultadoAncora> {
    if (!this.storage.configurado()) {
      if (!this.avisoStorageEmitido) {
        this.avisoStorageEmitido = true;
        this.logger.warn(
          'R2 não configurado: âncora de integridade desligada.',
        );
      }
      return { estado: 'sem_storage' };
    }

    return TenantContext.paraSistema(async () => {
      const agora = new Date();
      const snapshot = await this.montarSnapshot();
      const anterior = await this.lerUltima();

      const hoje = agora.toISOString().slice(0, 10);
      const reiniciarHoje = process.env.INTEGRIDADE_ANCORA_REINICIAR === hoje;

      if (anterior.tipo === 'ausente' || reiniciarHoje) {
        if (reiniciarHoje && anterior.tipo === 'ok') {
          await this.registrarArquivo(
            'reinicios',
            { anterior: anterior.ancora },
            agora,
          );
          this.logger.warn(
            'Âncora de integridade REINICIADA por INTEGRIDADE_ANCORA_REINICIAR (vale só hoje).',
          );
        }
        await this.gravarUltima(snapshot, agora);
        return {
          estado:
            anterior.tipo === 'ausente' ? 'baseline_criada' : 'reiniciada',
          motoristas: snapshot.length,
        };
      }

      if (anterior.tipo === 'adulterada') {
        await this.reportar([], 'desconhecida', agora, true, [
          ...new Set(snapshot.map((m) => m.empresaId)),
        ]);
        return { estado: 'ancora_adulterada' };
      }

      const violacoes = await this.compararComAncora(anterior.ancora, snapshot);
      if (violacoes.length > 0) {
        await this.reportar(violacoes, anterior.ancora.geradoEm, agora, false);
        return {
          estado: 'violacao',
          motoristas: snapshot.length,
          violacoes: violacoes.length,
        };
      }

      await this.gravarUltima(snapshot, agora);
      return { estado: 'ok', motoristas: snapshot.length };
    });
  }
}
