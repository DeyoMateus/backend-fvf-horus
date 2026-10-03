import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { normalizarPlaca } from './normalizar-placa.util';

/**
 * Veículo de tração (cavalo mecânico) vinculado ao motorista.
 *
 * Diferente de `DispositivosService` (troca de aparelho exige pedido +
 * aprovação do gestor), a troca de placa é self-service pro motorista ,
 * ele pode simplesmente atualizar pelo app quando é realocado pra outro
 * cavalo. O controle não é bloquear a troca, é dar VISIBILIDADE: toda
 * troca (não a primeira vez que a placa é cadastrada) grava
 * `VEICULO_TROCADO` no AuditLog, que o painel lê e mostra no perfil do
 * motorista , mesmo padrão já usado pros alertas de "aparelho suspeito"
 * (`MotoristasService.listarAlertasIntegridadeDispositivo`), sem
 * precisar de uma tabela de alerta nova.
 *
 * Rodada 105 , pedido do usuário: cada veículo (placa) só pode estar
 * vinculado a UM motorista por vez. Antes disso não havia nenhuma
 * validação de unicidade de placa , a mesma placa podia ser vinculada
 * livremente a vários motoristas ao mesmo tempo. Agora `atualizar`
 * recusa a troca/vínculo se a placa já pertencer a outro motorista
 * ativo (não excluído) do mesmo grupo empresarial.
 */
@Injectable()
export class VeiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  async atualizar(
    motoristaId: string,
    dto: AtualizarVeiculoDto,
    ator: { tipo: ActorType; id: string | null },
    grupoIdSolicitante?: string,
  ) {
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
      // Pedido do usuário: motorista inativo/excluído não pode receber
      // NENHUM lançamento novo , só consulta ao que já existe. (Quando
      // não há grupoIdSolicitante, é o próprio app do motorista , o
      // MotoristaDeviceGuard já exige status ATIVO antes de chegar aqui.)
      await this.tenant.verificarMotoristaAtivo(motoristaId);
    }
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      include: { empresa: true },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');

    const placaNova = normalizarPlaca(dto.placa);
    const atual = await this.prisma.veiculoVinculado.findUnique({
      where: { motoristaId },
    });
    const trocouPlaca = !!atual && atual.placa !== placaNova;

    // Rodada 105 , mesma placa não pode estar com outro motorista ativo
    // (não excluído) do mesmo grupo ao mesmo tempo. Motorista excluído
    // (soft-delete) não conta como conflito: o veículo dele já não está
    // em uso por ninguém de verdade.
    if (trocouPlaca || !atual) {
      const conflito = await this.prisma.veiculoVinculado.findFirst({
        where: {
          placa: placaNova,
          motoristaId: { not: motoristaId },
          motorista: {
            excluidoEm: null,
            empresa: { grupoId: motorista.empresa.grupoId },
          },
        },
        include: { motorista: true },
      });
      if (conflito) {
        throw new ConflictException(
          `A placa ${placaNova} já está vinculada a outro motorista (${conflito.motorista.nome}). Cada veículo só pode estar vinculado a um motorista por vez.`,
        );
      }
    }

    const veiculo = await this.prisma.veiculoVinculado.upsert({
      where: { motoristaId },
      update: {
        placa: placaNova,
        idRastreador: dto.idRastreador,
        tecnologiaRastreador: dto.tecnologiaRastreador,
        atualizadoPorTipo: ator.tipo,
        atualizadoPorId: ator.id,
      },
      create: {
        motoristaId,
        placa: placaNova,
        idRastreador: dto.idRastreador,
        tecnologiaRastreador: dto.tecnologiaRastreador,
        atualizadoPorTipo: ator.tipo,
        atualizadoPorId: ator.id,
      },
    });

    // 'VEICULO_TROCADO' é o único acao que vira alerta visível pro
    // gestor (ver listarTrocas) , o cadastro inicial da placa
    // (motorista novo, ou legado sem VeiculoVinculado ainda) não é uma
    // "troca", é só o primeiro preenchimento.
    const acao = !atual
      ? 'VEICULO_VINCULADO'
      : trocouPlaca
        ? 'VEICULO_TROCADO'
        : 'VEICULO_ATUALIZADO';
    await this.audit.registrar({
      actorType: ator.tipo,
      actorId: ator.id,
      acao,
      entidade: 'Motorista',
      entidadeId: motoristaId,
      detalhes: {
        placaAnterior: atual?.placa ?? null,
        placaNova,
        idRastreador: dto.idRastreador ?? null,
      },
    });

    return veiculo;
  }

  async status(motoristaId: string, grupoIdSolicitante?: string) {
    if (grupoIdSolicitante) {
      await this.tenant.verificarMotoristaNoGrupo(
        motoristaId,
        grupoIdSolicitante,
      );
    }
    const veiculo = await this.prisma.veiculoVinculado.findUnique({
      where: { motoristaId },
    });
    return veiculo ?? { vinculado: false };
  }

  /** Histórico de trocas de placa (não o cadastro inicial) , o "alerta pro gestor" pedido. */
  async listarTrocas(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );
    return this.prisma.auditLog.findMany({
      where: {
        entidade: 'Motorista',
        entidadeId: motoristaId,
        acao: 'VEICULO_TROCADO',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
