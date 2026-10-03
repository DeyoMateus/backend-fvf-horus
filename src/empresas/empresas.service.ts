import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Adiciona um novo CNPJ (Empresa) ao GRUPO de quem está pedindo , não
   * cria um grupo novo. `grupoId` vem sempre do token JWT, nunca do
   * corpo da requisição, então isto nunca pode plantar uma Empresa no
   * grupo de outra pessoa. O bootstrap do PRIMEIRO grupo+empresa+usuário
   * ADMIN de um cliente novo continua fora da API pública (ver
   * prisma/seed.ts) , não existe endpoint de auto-registro.
   */
  async create(dto: CreateEmpresaDto, grupoId: string, actorId?: string) {
    const existente = await this.prisma.empresa.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existente) throw new ConflictException('CNPJ já cadastrado');

    const empresa = await this.prisma.empresa.create({
      data: { ...dto, grupoId },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'EMPRESA_CRIADA',
      entidade: 'Empresa',
      entidadeId: empresa.id,
      detalhes: { grupoId },
    });

    return empresa;
  }

  /**
   * O tenant é o Grupo , então tanto `list()` quanto `findById()` são
   * sempre restritos ao próprio grupo de quem está pedindo (que pode
   * ter mais de um CNPJ), nunca a todos os grupos cadastrados.
   */
  async findById(id: string, grupoIdSolicitante: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa || empresa.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Empresa não pertence ao seu grupo');
    }
    return empresa;
  }

  list(grupoIdSolicitante: string) {
    return this.prisma.empresa.findMany({
      where: { grupoId: grupoIdSolicitante },
      orderBy: { razaoSocial: 'asc' },
      include: { regraSindical: { select: { id: true, nome: true } } },
    });
  }

  /**
   * Vincula (ou desvincula, passando null) a CCT/ACT (RegraSindical) que
   * vale pra este CNPJ (Rodada 27). O gestor escolhe livremente quais
   * CNPJs cada convenção cobre , uma mesma regra pode servir vários.
   */
  async vincularRegraSindical(
    empresaId: string,
    regraSindicalId: string | null,
    grupoIdSolicitante: string,
    actorId?: string,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa || empresa.grupoId !== grupoIdSolicitante) {
      throw new ForbiddenException('Empresa não pertence ao seu grupo');
    }
    if (regraSindicalId) {
      const regra = await this.prisma.regraSindical.findUnique({
        where: { id: regraSindicalId },
      });
      if (!regra || regra.grupoId !== grupoIdSolicitante) {
        throw new ForbiddenException(
          'Regra sindical não pertence ao seu grupo',
        );
      }
    }

    const atualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: { regraSindicalId },
      include: { regraSindical: { select: { id: true, nome: true } } },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'EMPRESA_REGRA_SINDICAL_VINCULADA',
      entidade: 'Empresa',
      entidadeId: empresaId,
      detalhes: { regraSindicalId },
    });

    return atualizada;
  }
}
