import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ActorType,
  StatusMotorista,
  TipoDocumentoPrivacidade,
} from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PushNotificationsService } from '../common/notifications/push-notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { VERSAO_DOCUMENTOS } from './privacidade.textos';

export const TIPO_PUSH_NOVA_POLITICA = 'PRIVACIDADE_NOVA_VERSAO';
const ACAO_AUDITORIA = 'PRIVACIDADE_NOVA_VERSAO_AVISADA';

/**
 * Rodada 234: o SERVIDOR avisa os aparelhos quando a política de
 * privacidade/termos muda (VERSAO_DOCUMENTOS). Quem ainda não deu ciência
 * dos três documentos da versão vigente recebe um push; o app, ao receber,
 * abre a tela obrigatória de ciência (e o MotoristaDeviceGuard já responde
 * 428 a qualquer uso até a ciência, rodada 208).
 *
 * Roda ao subir o backend (logo após o deploy com a versão nova) e depois
 * periodicamente, relembrando quem continua pendente no máximo uma vez a
 * cada REAVISO_MS (12h). O controle de "já avisei" é a própria auditoria
 * (ação PRIVACIDADE_NOVA_VERSAO_AVISADA, por motorista e versão), então
 * reiniciar o backend ou ter mais de uma instância não gera push repetido
 * em sequência. Fail-open: nada aqui bloqueia o motorista nem o ponto.
 */
@Injectable()
export class PrivacidadeAvisoPoliticaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrivacidadeAvisoPoliticaService.name);
  private timer: NodeJS.Timeout | null = null;
  private inicial: NodeJS.Timeout | null = null;
  private emExecucao = false;

  static readonly REAVISO_MS = 12 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const intervaloMs = Number(
      process.env.INTERVALO_AVISO_POLITICA_MS ?? 60 * 60 * 1000,
    );
    this.timer = setInterval(() => void this.executar(), intervaloMs);
    // Espera o Redis/filas subirem antes do primeiro envio.
    this.inicial = setTimeout(() => void this.executar(), 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.inicial) clearTimeout(this.inicial);
  }

  async executar(): Promise<number> {
    if (this.emExecucao) return 0;
    this.emExecucao = true;
    try {
      return await TenantContext.paraSistema(() => this.avisarPendentes());
    } catch (err) {
      this.logger.error('Falha ao avisar nova política', err as Error);
      return 0;
    } finally {
      this.emExecucao = false;
    }
  }

  /** Motoristas vinculados, com push token, sem os três aceites da versão vigente. */
  async avisarPendentes(agora = new Date()): Promise<number> {
    const tipos = Object.values(TipoDocumentoPrivacidade);
    const vinculos = await this.prisma.dispositivoVinculado.findMany({
      where: { pushToken: { not: null }, motorista: { status: StatusMotorista.ATIVO } },
      select: { motoristaId: true },
    });
    if (vinculos.length === 0) return 0;
    const ids = vinculos.map((v) => v.motoristaId);

    const aceites = await this.prisma.aceitePrivacidade.groupBy({
      by: ['motoristaId'],
      where: { motoristaId: { in: ids }, versao: VERSAO_DOCUMENTOS },
      _count: { tipoDocumento: true },
    });
    const completos = new Set(
      aceites
        .filter((a) => a._count.tipoDocumento >= tipos.length)
        .map((a) => a.motoristaId),
    );
    const pendentes = ids.filter((id) => !completos.has(id));
    if (pendentes.length === 0) return 0;

    const corte = new Date(
      agora.getTime() - PrivacidadeAvisoPoliticaService.REAVISO_MS,
    );
    const recentes = await this.prisma.auditLog.findMany({
      where: {
        acao: ACAO_AUDITORIA,
        entidadeId: { in: pendentes },
        createdAt: { gte: corte },
      },
      select: { entidadeId: true },
    });
    const jaAvisados = new Set(recentes.map((r) => r.entidadeId));

    let enviados = 0;
    for (const motoristaId of pendentes) {
      if (jaAvisados.has(motoristaId)) continue;
      await this.push.notificarMotorista(
        motoristaId,
        'Política de privacidade atualizada',
        'Abra o app e confirme a ciência da nova versão para continuar usando.',
        { tipo: TIPO_PUSH_NOVA_POLITICA, versao: VERSAO_DOCUMENTOS },
      );
      await this.audit.registrar({
        actorType: ActorType.SISTEMA,
        actorId: null,
        acao: ACAO_AUDITORIA,
        entidade: 'AceitePrivacidade',
        entidadeId: motoristaId,
        detalhes: { versao: VERSAO_DOCUMENTOS },
      });
      enviados++;
    }
    if (enviados > 0) {
      this.logger.log(
        `Nova política ${VERSAO_DOCUMENTOS}: ${enviados} motorista(s) avisado(s) por push`,
      );
    }
    return enviados;
  }
}
