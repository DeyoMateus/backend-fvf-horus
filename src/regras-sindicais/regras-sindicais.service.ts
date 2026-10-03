import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRegraSindicalDto } from './dto/create-regra-sindical.dto';
import { UpdateRegraSindicalDto } from './dto/update-regra-sindical.dto';

/**
 * CCT/ACT (Convenção/Acordo Coletivo) do setor de transporte,
 * parametrizada por grupo e vinculável a um ou mais CNPJs (Empresa) ,
 * ver comentário completo no schema.prisma (model RegraSindical) sobre
 * por que isto não pode ser hardcoded: o "Negociado sobre o Legislado"
 * (Art. 611-A da CLT) faz a convenção da categoria valer sobre a regra
 * geral em vários destes pontos.
 *
 * O tenant aqui é o Grupo diretamente (a regra não pertence a um CNPJ
 * específico, pode cobrir vários) , mesmo padrão de EmpresasService.
 */
@Injectable()
export class RegrasSindicaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateRegraSindicalDto, grupoId: string, actorId?: string) {
    const regra = await this.prisma.regraSindical.create({
      data: { ...dto, grupoId },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'REGRA_SINDICAL_CRIADA',
      entidade: 'RegraSindical',
      entidadeId: regra.id,
      detalhes: { nome: regra.nome, grupoId },
    });
    return regra;
  }

  list(grupoIdSolicitante: string) {
    return this.prisma.regraSindical.findMany({
      where: { grupoId: grupoIdSolicitante },
      orderBy: { nome: 'asc' },
      include: {
        empresas: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });
  }

  async findById(id: string, grupoIdSolicitante: string) {
    const regra = await this.prisma.regraSindical.findUnique({
      where: { id },
      include: {
        empresas: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });
    if (!regra || regra.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Regra sindical não pertence ao seu grupo');
    }
    return regra;
  }

  async update(
    id: string,
    dto: UpdateRegraSindicalDto,
    grupoIdSolicitante: string,
    actorId?: string,
  ) {
    await this.verificarPertence(id, grupoIdSolicitante);
    const regra = await this.prisma.regraSindical.update({
      where: { id },
      data: dto,
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'REGRA_SINDICAL_ATUALIZADA',
      entidade: 'RegraSindical',
      entidadeId: id,
      detalhes: dto as Record<string, unknown>,
    });
    return regra;
  }

  /**
   * Nunca apaga de verdade (a regra pode ter sido usada pra apurar
   * jornadas já fechadas) , "excluir" aqui é só desativar (`ativo:
   * false`), o mesmo princípio de "arquivo morto" já usado pra
   * Motorista (nunca DELETE, sempre mudança de status).
   */
  async desativar(id: string, grupoIdSolicitante: string, actorId?: string) {
    await this.verificarPertence(id, grupoIdSolicitante);
    const regra = await this.prisma.regraSindical.update({
      where: { id },
      data: { ativo: false },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'REGRA_SINDICAL_DESATIVADA',
      entidade: 'RegraSindical',
      entidadeId: id,
      detalhes: {},
    });
    return regra;
  }

  private async verificarPertence(id: string, grupoIdSolicitante: string) {
    const regra = await this.prisma.regraSindical.findUnique({
      where: { id },
      select: { grupoId: true },
    });
    if (!regra) throw new NotFoundException('Regra sindical não encontrada');
    if (regra.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Regra sindical não pertence ao seu grupo');
    }
  }
}
