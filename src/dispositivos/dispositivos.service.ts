import { grupoIdSeguro } from '../common/prisma/grupo-id-seguro';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, StatusSolicitacaoDispositivo } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { SolicitarTrocaDispositivoDto } from './dto/solicitar-troca-dispositivo.dto';
import { hashChaveDispositivo } from '../common/crypto/device-key-hash.util';

/**
 * Device binding: só um usuário da empresa (ADMIN/GESTOR) pode vincular
 * ou revogar o aparelho de um motorista , nunca o motorista sozinho.
 *
 * Existe só o vínculo ATUAL por motorista (igual senha: vincular de novo
 * substitui na hora o vínculo anterior, sem manter histórico). A partir
 * do momento da troca, o aparelho antigo para de conseguir bater ponto
 * imediatamente, mesmo que ainda tenha a device key antiga guardada.
 */
@Injectable()
export class DispositivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  async vincular(
    motoristaId: string,
    dto: VincularDispositivoDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , só consulta ao que já existe.
    await this.tenant.verificarMotoristaAtivo(motoristaId);

    const deviceUuidEmUsoPorOutro =
      await this.prisma.dispositivoVinculado.findFirst({
        where: {
          deviceUuid: dto.deviceUuid,
          motoristaId: { not: motoristaId },
        },
      });
    if (deviceUuidEmUsoPorOutro) {
      throw new ConflictException(
        'Este aparelho já está vinculado a outro motorista',
      );
    }

    // Nova device key gerada a cada vínculo , só o hash SHA-256 é
    // persistido; o valor em texto puro é devolvido UMA única vez,
    // como uma secret key de provedor de nuvem, para o app gravar no
    // keystore/keychain seguro do aparelho.
    const deviceApiKeyPlano = randomBytes(32).toString('hex');
    const deviceApiKeyHash = hashChaveDispositivo(deviceApiKeyPlano);

    const vinculo = await this.prisma.dispositivoVinculado.upsert({
      where: { motoristaId },
      update: {
        deviceUuid: dto.deviceUuid,
        deviceApiKeyHash,
        vinculadoPorUsuarioId: usuarioId,
      },
      create: {
        motoristaId,
        deviceUuid: dto.deviceUuid,
        deviceApiKeyHash,
        vinculadoPorUsuarioId: usuarioId,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DISPOSITIVO_VINCULADO',
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: { deviceUuid: dto.deviceUuid },
    });

    return {
      motoristaId,
      deviceUuid: vinculo.deviceUuid,
      vinculadoEm: vinculo.vinculadoEm,
      deviceApiKey: deviceApiKeyPlano,
    };
  }

  async revogar(
    motoristaId: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);
    const vinculo = await this.prisma.dispositivoVinculado.findUnique({
      where: { motoristaId },
    });
    if (!vinculo)
      throw new NotFoundException('Motorista não tem dispositivo vinculado');

    await this.prisma.dispositivoVinculado.delete({ where: { motoristaId } });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DISPOSITIVO_REVOGADO',
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: { deviceUuidRevogado: vinculo.deviceUuid },
    });
  }

  async status(motoristaId: string, grupoIdSolicitante: string) {
    await this.conferirTenant(motoristaId, grupoIdSolicitante);
    const vinculo = await this.prisma.dispositivoVinculado.findUnique({
      where: { motoristaId },
      select: {
        deviceUuid: true,
        vinculadoEm: true,
        atualizadoEm: true,
        vinculadoPorUsuarioId: true,
      },
    });
    return vinculo ?? { vinculado: false };
  }

  /** Confere, antes de qualquer leitura/escrita, que o motorista pertence ao grupo de quem está pedindo. */
  private async conferirTenant(
    motoristaId: string,
    grupoIdSolicitante: string,
  ): Promise<void> {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
  }

  /**
   * Chamado pelo PRÓPRIO app (MotoristaDeviceGuard, não o painel) depois
   * do vínculo, pra registrar o Expo push token deste aparelho , usado
   * pelo motor de alertas críticos de jornada pra notificar o motorista
   * direto no celular. Atualizar de novo (ex.: token rotacionado pelo
   * Expo) simplesmente sobrescreve o anterior.
   */
  async atualizarPushToken(motoristaId: string, pushToken: string) {
    // O MotoristaDeviceGuard já garantiu que o deviceUuid da requisição
    // é exatamente o vinculado a este motorista , aqui só persistimos.
    await this.prisma.dispositivoVinculado.update({
      where: { motoristaId },
      data: { pushToken },
    });
  }

  // ==========================================
  // TROCA DE APARELHO: solicitação (baixo privilégio) → aprovação/
  // rejeição (só ADMIN/GESTOR). A solicitação em si NUNCA concede
  // acesso , só o clique do gestor (aprovarTroca) upserta o vínculo de
  // verdade. Endpoint de criação é público de propósito: é exatamente o
  // caso em que o motorista perdeu/trocou o aparelho e não tem mais
  // nenhuma credencial de device válida pra se autenticar de outro
  // jeito , proteção fica no rate limiting da borda (@Throttle) e no
  // fato de a solicitação não fazer nada por si só.
  // ==========================================

  async solicitarTroca(dto: SolicitarTrocaDispositivoDto) {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: dto.motoristaId },
    });

    // Segundo fator (CPF) exigido porque este endpoint é público de
    // propósito , ver comentário no DTO. Comparação em tempo constante
    // e mensagem de erro IDÊNTICA pra "motorista não existe" e "CPF não
    // corresponde": sem isso, alguém adivinhando motoristaId por aí
    // conseguiria confirmar quais ids são reais só testando um CPF
    // qualquer e vendo qual mensagem volta.
    const cpfOk =
      !!motorista &&
      motorista.cpf.length === dto.cpfConfirmacao.length &&
      timingSafeEqual(
        Buffer.from(motorista.cpf),
        Buffer.from(dto.cpfConfirmacao),
      );
    if (!motorista || !cpfOk) {
      throw new NotFoundException(
        'Motorista não encontrado ou CPF não corresponde',
      );
    }

    const deviceUuidEmUsoPorOutro =
      await this.prisma.dispositivoVinculado.findFirst({
        where: {
          deviceUuid: dto.deviceUuidSolicitado,
          motoristaId: { not: dto.motoristaId },
        },
      });
    if (deviceUuidEmUsoPorOutro) {
      throw new ConflictException(
        'Este aparelho já está vinculado a outro motorista',
      );
    }

    // Evita empilhar pedidos duplicados: se já existe uma solicitação
    // pendente pro mesmo motorista, atualiza em vez de criar outra.
    const pendente = await this.prisma.solicitacaoTrocaDispositivo.findFirst({
      where: {
        motoristaId: dto.motoristaId,
        status: StatusSolicitacaoDispositivo.PENDENTE,
      },
    });

    const dados = {
      deviceUuidSolicitado: dto.deviceUuidSolicitado,
      modeloAparelho: dto.modeloAparelho ?? null,
      sistemaOperacional: dto.sistemaOperacional ?? null,
      observacaoMotorista: dto.observacaoMotorista ?? null,
    };

    const solicitacao = pendente
      ? await this.prisma.solicitacaoTrocaDispositivo.update({
          where: { id: pendente.id },
          data: dados,
        })
      : await this.prisma.solicitacaoTrocaDispositivo.create({
          data: { motoristaId: dto.motoristaId, ...dados },
        });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: dto.motoristaId,
      acao: pendente
        ? 'SOLICITACAO_TROCA_DISPOSITIVO_ATUALIZADA'
        : 'SOLICITACAO_TROCA_DISPOSITIVO_CRIADA',
      entidade: 'SolicitacaoTrocaDispositivo',
      entidadeId: solicitacao.id,
      detalhes: { deviceUuidSolicitado: dto.deviceUuidSolicitado },
    });

    return solicitacao;
  }

  /** "Posto de solicitações" do gestor , só as pendentes, só do próprio grupo (nunca por grupoId vindo do cliente). */
  async listarSolicitacoesPendentes(grupoId: string) {
    return this.prisma.solicitacaoTrocaDispositivo.findMany({
      where: {
        status: StatusSolicitacaoDispositivo.PENDENTE,
        motorista: { empresa: { grupoId } },
      },
      include: { motorista: { select: { id: true, nome: true, cpf: true } } },
      orderBy: { criadoEm: 'asc' },
    });
  }

  /**
   * Abre o portão de verdade: aprova a solicitação e substitui o
   * DispositivoVinculado atual NA HORA , o aparelho antigo perde acesso
   * imediatamente, mesmo com a device key antiga em mãos. Retorna a
   * NOVA deviceApiKey em texto puro, UMA ÚNICA VEZ (só o hash é
   * persistido) , o painel deve instruir o gestor a repassar isso ao
   * motorista por canal seguro, e o app deve gravar direto no
   * Keystore/Keychain, nunca em log ou tela persistente.
   */
  async aprovarTroca(
    solicitacaoId: string,
    usuarioId: string,
    grupoId: string,
  ) {
    const solicitacao =
      await this.prisma.solicitacaoTrocaDispositivo.findUnique({
        where: { id: solicitacaoId },
        include: {
          motorista: { select: { empresa: { select: { grupoId: true } } } },
        },
      });
    if (!solicitacao) throw new NotFoundException('Solicitação não encontrada');
    if (solicitacao.motorista.empresa.grupoId !== grupoId) {
      // Nunca revelar "não encontrada" vs "de outro grupo" de forma
      // diferenciável seria melhor ainda, mas aqui o mais importante é
      // simplesmente nunca deixar aprovar/rejeitar fora do próprio tenant.
      throw new ForbiddenException('Solicitação não pertence ao seu grupo');
    }
    if (solicitacao.status !== StatusSolicitacaoDispositivo.PENDENTE) {
      throw new ConflictException('Esta solicitação já foi revisada');
    }
    // Pedido do usuário: motorista inativo/excluído não pode receber
    // NENHUM lançamento novo , o motorista pode ter sido
    // inativado/excluído depois de pedir a troca, antes do gestor
    // revisar , checa de novo aqui, na hora da aprovação.
    await this.tenant.verificarMotoristaAtivo(solicitacao.motoristaId);

    // Checagem de novo no momento da aprovação (o estado pode ter
    // mudado entre a solicitação e a revisão do gestor).
    const deviceUuidEmUsoPorOutro =
      await this.prisma.dispositivoVinculado.findFirst({
        where: {
          deviceUuid: solicitacao.deviceUuidSolicitado,
          motoristaId: { not: solicitacao.motoristaId },
        },
      });
    if (deviceUuidEmUsoPorOutro) {
      throw new ConflictException(
        'Este aparelho já está vinculado a outro motorista , resolva manualmente antes de aprovar.',
      );
    }

    const deviceApiKeyPlano = randomBytes(32).toString('hex');
    const deviceApiKeyHash = hashChaveDispositivo(deviceApiKeyPlano);

    // Mesmo padrão de motoristas.service.ts: array-transaction única,
    // então usa `this.prisma.cru.*` (sem a interceptação de RLS) e um
    // SET LOCAL manual como primeiro item , cada `cru.X` aqui abrir sua
    // própria mini-transação quebraria a atomicidade (aprovar a
    // solicitação e substituir o dispositivo têm que acontecer juntos).
    const ctxTenant = TenantContext.atual();
    if (!ctxTenant) {
      throw new Error(
        'DispositivosService.aprovarTroca sem contexto de tenant , ver TenantContextInterceptor.',
      );
    }
    const [, , dispositivoAtualizado] = await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(
        `SET LOCAL app.grupo_atual = '${grupoIdSeguro(ctxTenant.grupoId)}'`,
      ),
      this.prisma.cru.solicitacaoTrocaDispositivo.update({
        where: { id: solicitacaoId },
        data: {
          status: StatusSolicitacaoDispositivo.APROVADA,
          revisadoPorUsuarioId: usuarioId,
          revisadoEm: new Date(),
        },
      }),
      this.prisma.cru.dispositivoVinculado.upsert({
        where: { motoristaId: solicitacao.motoristaId },
        update: {
          deviceUuid: solicitacao.deviceUuidSolicitado,
          deviceApiKeyHash,
          vinculadoPorUsuarioId: usuarioId,
          pushToken: null, // aparelho novo , o token antigo não vale mais
        },
        create: {
          motoristaId: solicitacao.motoristaId,
          deviceUuid: solicitacao.deviceUuidSolicitado,
          deviceApiKeyHash,
          vinculadoPorUsuarioId: usuarioId,
        },
      }),
    ]);

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'SOLICITACAO_TROCA_DISPOSITIVO_APROVADA',
      entidade: 'Motorista',
      entidadeId: solicitacao.motoristaId,
      detalhes: {
        solicitacaoId,
        deviceUuidNovo: solicitacao.deviceUuidSolicitado,
      },
    });

    return {
      motoristaId: solicitacao.motoristaId,
      deviceUuid: dispositivoAtualizado.deviceUuid,
      vinculadoEm: dispositivoAtualizado.vinculadoEm,
      deviceApiKey: deviceApiKeyPlano,
    };
  }

  async rejeitarTroca(
    solicitacaoId: string,
    usuarioId: string,
    motivo: string,
    grupoId: string,
  ) {
    const solicitacao =
      await this.prisma.solicitacaoTrocaDispositivo.findUnique({
        where: { id: solicitacaoId },
        include: {
          motorista: { select: { empresa: { select: { grupoId: true } } } },
        },
      });
    if (!solicitacao) throw new NotFoundException('Solicitação não encontrada');
    if (solicitacao.motorista.empresa.grupoId !== grupoId) {
      throw new ForbiddenException('Solicitação não pertence ao seu grupo');
    }
    if (solicitacao.status !== StatusSolicitacaoDispositivo.PENDENTE) {
      throw new ConflictException('Esta solicitação já foi revisada');
    }

    const atualizada = await this.prisma.solicitacaoTrocaDispositivo.update({
      where: { id: solicitacaoId },
      data: {
        status: StatusSolicitacaoDispositivo.REJEITADA,
        revisadoPorUsuarioId: usuarioId,
        revisadoEm: new Date(),
        motivoRejeicao: motivo,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'SOLICITACAO_TROCA_DISPOSITIVO_REJEITADA',
      entidade: 'Motorista',
      entidadeId: solicitacao.motoristaId,
      detalhes: { solicitacaoId, motivo },
    });

    return atualizada;
  }
}
