import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateFeriadoDto } from './dto/create-feriado.dto';
import { UpdateFeriadoDto } from './dto/update-feriado.dto';

/**
 * Cadastro de feriados aceitos pela empresa/grupo (Rodada 29) , quem
 * decide o calendário é sempre o RH, nunca uma fonte automática: um
 * feriado municipal numa cidade não é feriado em outra, e diferentes
 * CCTs podem tratar o mesmo dia de forma diferente. Pertence ao Grupo
 * por padrão (vale pra todos os CNPJs do grupo), com `empresaId`
 * opcional pra restringir a um CNPJ específico , útil quando o grupo
 * tem filiais em cidades diferentes.
 *
 * O tenant aqui é o Grupo diretamente (mesmo padrão de RegrasSindicais),
 * mas quando `empresaId` é informado ele precisa pertencer a esse mesmo
 * grupo , conferido via TenantService, igual ao resto do sistema.
 */
@Injectable()
export class FeriadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateFeriadoDto, grupoId: string, actorId?: string) {
    if (dto.empresaId) {
      await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
    }
    const feriado = await this.prisma.feriado.create({
      data: {
        data: new Date(dto.data),
        descricao: dto.descricao,
        empresaId: dto.empresaId,
        pagoComoDomingo: dto.pagoComoDomingo ?? true,
        grupoId,
        criadoPorUsuarioId: actorId,
      },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'FERIADO_CRIADO',
      entidade: 'Feriado',
      entidadeId: feriado.id,
      detalhes: {
        data: dto.data,
        descricao: dto.descricao,
        empresaId: dto.empresaId ?? null,
      },
    });
    return feriado;
  }

  list(grupoIdSolicitante: string) {
    return this.prisma.feriado.findMany({
      where: { grupoId: grupoIdSolicitante },
      orderBy: { data: 'asc' },
      include: {
        empresa: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });
  }

  async findById(id: string, grupoIdSolicitante: string) {
    const feriado = await this.prisma.feriado.findUnique({
      where: { id },
      include: {
        empresa: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });
    if (!feriado || feriado.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Feriado não pertence ao seu grupo');
    }
    return feriado;
  }

  async update(
    id: string,
    dto: UpdateFeriadoDto,
    grupoIdSolicitante: string,
    actorId?: string,
  ) {
    await this.verificarPertence(id, grupoIdSolicitante);
    if (dto.empresaId) {
      await this.tenant.verificarEmpresaNoGrupo(
        dto.empresaId,
        grupoIdSolicitante,
      );
    }
    const feriado = await this.prisma.feriado.update({
      where: { id },
      data: {
        ...(dto.data !== undefined ? { data: new Date(dto.data) } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.empresaId !== undefined ? { empresaId: dto.empresaId } : {}),
        ...(dto.pagoComoDomingo !== undefined
          ? { pagoComoDomingo: dto.pagoComoDomingo }
          : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'FERIADO_ATUALIZADO',
      entidade: 'Feriado',
      entidadeId: id,
      detalhes: dto as Record<string, unknown>,
    });
    return feriado;
  }

  /**
   * Nunca apaga de verdade , o feriado pode já ter sido usado num
   * REP-P já gerado/entregue. "Excluir" aqui é só desativar (`ativo:
   * false`), o mesmo princípio de "arquivo morto" já usado em
   * Motorista/RegraSindical.
   */
  async desativar(id: string, grupoIdSolicitante: string, actorId?: string) {
    await this.verificarPertence(id, grupoIdSolicitante);
    const feriado = await this.prisma.feriado.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'FERIADO_DESATIVADO',
      entidade: 'Feriado',
      entidadeId: id,
      detalhes: {},
    });
    return feriado;
  }

  private async verificarPertence(id: string, grupoIdSolicitante: string) {
    const feriado = await this.prisma.feriado.findUnique({
      where: { id },
      select: { grupoId: true },
    });
    if (!feriado) throw new NotFoundException('Feriado não encontrado');
    if (feriado.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Feriado não pertence ao seu grupo');
    }
  }

  /**
   * Usado internamente pelo REP-P (Rodada 29): feriados ATIVOS do grupo
   * aplicáveis a um CNPJ específico (os globais do grupo + os
   * restritos a esse CNPJ) dentro de um período , é isso que substitui
   * a antiga checagem "só domingo conta" no cálculo do resumo diário.
   */
  async listarParaRelatorio(
    grupoId: string,
    empresaId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ) {
    return this.prisma.feriado.findMany({
      where: {
        grupoId,
        ativo: true,
        data: { gte: periodoInicio, lte: periodoFim },
        OR: [{ empresaId: null }, { empresaId }],
      },
      orderBy: { data: 'asc' },
    });
  }
}
