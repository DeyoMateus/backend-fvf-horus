import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, PapelUsuario, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEmpresaMaeDto } from './dto/create-empresa-mae.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { UpdateUsuarioSuperAdminDto } from './dto/update-usuario-super-admin.dto';
import { CreateUsuarioGrupoDto } from './dto/create-usuario-grupo.dto';
import { AtualizarStatusUsuarioEmpresaDto } from '../usuarios-empresa/dto/atualizar-status-usuario-empresa.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Provisiona um cliente novo: Grupo (empresa mãe) + primeiro CNPJ
   * (Empresa) + primeiro usuário ADMIN, atômico. É o único jeito de uma
   * empresa ganhar conta no sistema , não existe endpoint público de
   * auto-registro (por desenho, desde a Rodada 5/Rodada 27).
   *
   * As três operações usam `this.prisma.cru.<modelo>` (delegados SEM a
   * interceptação de RLS , ver prisma.service.ts) dentro de um
   * `$transaction([...])` de forma array, com o próprio `SET LOCAL`
   * como primeiro item, mesmo padrão já usado em
   * `MotoristasService.create` , necessário porque, no momento desta
   * chamada, o Grupo AINDA NÃO EXISTE (não há grupoId real pra setar);
   * roda como SISTEMA, o mesmo sentinela que o super admin já usa em
   * toda leitura (ver TenantContextInterceptor + SuperAdminGuard).
   */
  async criarEmpresaMae(dto: CreateEmpresaMaeDto, superAdminId: string) {
    const [empresaExistente, adminExistente] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { cnpj: dto.cnpjEmpresa } }),
      this.prisma.usuarioEmpresa.findUnique({
        where: { email: dto.emailAdmin },
      }),
    ]);
    if (empresaExistente) throw new ConflictException('CNPJ já cadastrado');
    if (adminExistente)
      throw new ConflictException('E-mail já cadastrado para outro usuário');

    const senhaHash = await bcrypt.hash(dto.senhaAdmin, 12);

    // Ids gerados aqui (em vez de deixar o Prisma gerar no create) pra
    // conseguir referenciar o grupoId no Empresa/UsuarioEmpresa dentro
    // da MESMA transação array , sem isso precisaria de duas
    // transações separadas (uma pro Grupo, outra pro resto), perdendo
    // atomicidade real entre as três (se a segunda falhasse, o Grupo
    // já teria sido criado sozinho, sem CNPJ nem ADMIN).
    const grupoId = randomUUID();
    const empresaId = randomUUID();
    const adminId = randomUUID();

    // Mesmo padrão de `MotoristasService.create`: `this.prisma.cru.*`
    // (delegados SEM a interceptação de RLS) com o próprio SET LOCAL
    // como primeiro item do array , o Grupo ainda não existe neste
    // instante, então roda como SISTEMA, o mesmo sentinela que toda
    // leitura do super admin já usa (TenantContextInterceptor).
    const operacoes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.$executeRawUnsafe(
        "SET LOCAL app.grupo_atual = '__sistema__'",
      ),
      this.prisma.cru.grupo.create({
        data: { id: grupoId, razaoSocial: dto.razaoSocialGrupo },
      }),
      this.prisma.cru.empresa.create({
        data: {
          id: empresaId,
          razaoSocial: dto.razaoSocialEmpresa,
          cnpj: dto.cnpjEmpresa,
          grupoId,
          registroInpiAfd: dto.registroInpiAfd,
        },
      }),
      this.prisma.cru.usuarioEmpresa.create({
        data: {
          id: adminId,
          nome: dto.nomeAdmin,
          email: dto.emailAdmin,
          senhaHash,
          papel: PapelUsuario.ADMIN,
          grupoId,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          ativo: true,
          createdAt: true,
        },
      }),
    ];
    const [, grupo, empresa, admin] = (await this.prisma.$transaction(
      operacoes,
    )) as [
      unknown,
      { id: string; razaoSocial: string; createdAt: Date },
      { id: string; razaoSocial: string; cnpj: string; grupoId: string },
      {
        id: string;
        nome: string;
        email: string;
        papel: PapelUsuario;
        ativo: boolean;
        createdAt: Date;
      },
    ];

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'EMPRESA_MAE_PROVISIONADA',
      entidade: 'Grupo',
      entidadeId: grupo.id,
      detalhes: {
        empresaId: empresa.id,
        cnpj: empresa.cnpj,
        adminId: admin.id,
        adminEmail: admin.email,
      },
    });

    return { grupo, empresa, admin };
  }

  /**
   * Visão geral pro super admin acompanhar: quantas empresas mãe
   * (Grupo) existem, quantos CNPJs (Empresa) e quantos gestores
   * (UsuarioEmpresa) cada uma tem, e quantos motoristas no total ,
   * pedido explícito do usuário. Roda como SISTEMA (o super admin não
   * tem grupoId , ver TenantContextInterceptor), então `_count` aqui
   * cruza todos os grupos de propósito, ao contrário de qualquer
   * consulta equivalente dentro de um `*.service.ts` de tenant.
   */
  async listarGrupos() {
    const grupos = await this.prisma.grupo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { empresas: true, usuarios: true } },
        empresas: { select: { _count: { select: { motoristas: true } } } },
      },
    });

    return grupos.map((g) => ({
      id: g.id,
      razaoSocial: g.razaoSocial,
      createdAt: g.createdAt,
      totalEmpresas: g._count.empresas,
      totalUsuarios: g._count.usuarios,
      totalMotoristas: g.empresas.reduce(
        (soma, e) => soma + e._count.motoristas,
        0,
      ),
    }));
  }

  /** Detalhe de um grupo específico: cada CNPJ com sua contagem de motoristas, e a lista de usuários (gestores/admins). */
  async obterGrupo(grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        empresas: {
          orderBy: { razaoSocial: 'asc' },
          include: { _count: { select: { motoristas: true } } },
        },
        usuarios: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
            ativo: true,
            createdAt: true,
          },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo não encontrado');

    return {
      id: grupo.id,
      razaoSocial: grupo.razaoSocial,
      createdAt: grupo.createdAt,
      empresas: grupo.empresas.map((e) => ({
        id: e.id,
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        ativo: e.ativo,
        registroInpiAfd: e.registroInpiAfd,
        fusoHorario: e.fusoHorario,
        totalMotoristas: e._count.motoristas,
      })),
      usuarios: grupo.usuarios,
    };
  }

  /** Edição de uma empresa mãe já cadastrada (Rodada 32) , hoje, só a razão social. */
  async atualizarGrupo(
    grupoId: string,
    dto: UpdateGrupoDto,
    superAdminId: string,
  ) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo não encontrado');

    const atualizado = await this.prisma.grupo.update({
      where: { id: grupoId },
      data: { razaoSocial: dto.razaoSocial },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'GRUPO_ATUALIZADO_PELO_SUPER_ADMIN',
      entidade: 'Grupo',
      entidadeId: grupoId,
      detalhes: {
        razaoSocialAnterior: grupo.razaoSocial,
        razaoSocialNova: dto.razaoSocial,
      },
    });

    return atualizado;
  }

  /**
   * Edição de um CNPJ do grupo já cadastrado (Rodada 32) , razão
   * social, CNPJ e registro INPI/AFD, os mesmos campos preenchidos no
   * provisionamento inicial. Trocar o CNPJ é sensível (documentos/AFD
   * já emitidos referenciam o CNPJ anterior), mas às vezes é só a
   * correção de um erro de digitação , por isso é permitido, com
   * checagem de duplicidade contra outro CNPJ já cadastrado.
   */
  async atualizarEmpresa(
    empresaId: string,
    dto: UpdateEmpresaDto,
    superAdminId: string,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    if (dto.cnpj && dto.cnpj !== empresa.cnpj) {
      const existente = await this.prisma.empresa.findUnique({
        where: { cnpj: dto.cnpj },
      });
      if (existente)
        throw new ConflictException('CNPJ já cadastrado em outra empresa');
    }

    const atualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        razaoSocial: dto.razaoSocial ?? undefined,
        cnpj: dto.cnpj ?? undefined,
        registroInpiAfd: dto.registroInpiAfd ?? undefined,
        fusoHorario: dto.fusoHorario ?? undefined,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'EMPRESA_ATUALIZADA_PELO_SUPER_ADMIN',
      entidade: 'Empresa',
      entidadeId: empresaId,
      detalhes: {
        antes: { razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj },
        depois: dto,
      },
    });

    return atualizada;
  }

  /** Ativa/desativa um CNPJ do grupo (Rodada 32) , nunca apaga, arquivo morto como o resto do sistema. */
  async atualizarStatusEmpresa(
    empresaId: string,
    ativo: boolean,
    superAdminId: string,
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');

    const atualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: { ativo },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'EMPRESA_STATUS_ALTERADO_PELO_SUPER_ADMIN',
      entidade: 'Empresa',
      entidadeId: empresaId,
      detalhes: { ativoAnterior: empresa.ativo, ativoNovo: ativo },
    });

    return atualizada;
  }

  /**
   * Corrige nome/e-mail de um usuário (gestor ou admin) de qualquer
   * grupo (Rodada 32) , cobre principalmente o admin inicial criado no
   * provisionamento, mas vale para qualquer `UsuarioEmpresa`. Nunca
   * altera papel/senha/status por aqui , isso continua sendo
   * responsabilidade do próprio grupo (`usuarios-empresa`).
   */
  async atualizarUsuario(
    usuarioId: string,
    dto: UpdateUsuarioSuperAdminDto,
    superAdminId: string,
  ) {
    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== usuario.email) {
      const existente = await this.prisma.usuarioEmpresa.findUnique({
        where: { email: dto.email },
      });
      if (existente)
        throw new ConflictException('E-mail já cadastrado para outro usuário');
    }

    const atualizado = await this.prisma.usuarioEmpresa.update({
      where: { id: usuarioId },
      data: { nome: dto.nome ?? undefined, email: dto.email ?? undefined },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'USUARIO_ATUALIZADO_PELO_SUPER_ADMIN',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuarioId,
      detalhes: {
        antes: { nome: usuario.nome, email: usuario.email },
        depois: dto,
      },
    });

    return atualizado;
  }

  /**
   * Cadastro de funcionário (ADMIN/GESTOR) dentro de um grupo JÁ
   * EXISTENTE (Rodada 38) , só o super admin faz isso agora; o painel
   * da própria empresa perdeu essa capacidade (ver comentário do DTO).
   */
  async criarUsuarioParaGrupo(
    grupoId: string,
    dto: CreateUsuarioGrupoDto,
    superAdminId: string,
  ) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo não encontrado');

    const existente = await this.prisma.usuarioEmpresa.findUnique({
      where: { email: dto.email },
    });
    if (existente)
      throw new ConflictException('E-mail já cadastrado para outro usuário');

    const senhaHash = await bcrypt.hash(dto.senha, 12);

    const usuario = await this.prisma.usuarioEmpresa.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        papel: dto.papel,
        telefoneWhatsapp: dto.telefoneWhatsapp,
        grupoId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: 'USUARIO_EMPRESA_CRIADO_PELO_SUPER_ADMIN',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuario.id,
      detalhes: { grupoId, papel: dto.papel, email: dto.email },
    });

    return usuario;
  }

  /**
   * Ativa/desativa um funcionário de um grupo , nunca apaga (mesmo
   * "nunca apaga, só desativa" de sempre). Movido pro super admin
   * junto com a criação, já que o painel da empresa não tem mais a
   * tela de Usuários.
   */
  async atualizarStatusUsuarioGrupo(
    grupoId: string,
    usuarioId: string,
    dto: AtualizarStatusUsuarioEmpresaDto,
    superAdminId: string,
  ) {
    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario || usuario.grupoId !== grupoId) {
      throw new NotFoundException('Usuário não encontrado neste grupo');
    }

    const atualizado = await this.prisma.usuarioEmpresa.update({
      where: { id: usuarioId },
      data: { ativo: dto.ativo },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.SUPER_ADMIN,
      actorId: superAdminId,
      acao: dto.ativo
        ? 'USUARIO_EMPRESA_REATIVADO_PELO_SUPER_ADMIN'
        : 'USUARIO_EMPRESA_DESATIVADO_PELO_SUPER_ADMIN',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuarioId,
    });

    return atualizado;
  }
}
