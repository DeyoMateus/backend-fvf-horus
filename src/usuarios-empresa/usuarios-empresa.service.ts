import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUsuarioEmpresaDto } from './dto/create-usuario-empresa.dto';
import { AtualizarStatusUsuarioEmpresaDto } from './dto/atualizar-status-usuario-empresa.dto';
import { AtualizarLimitesEsperaDto } from './dto/atualizar-limites-espera.dto';
import { LIMITES_ESPERA_PADRAO } from '../common/jornada-legal/jornada-legal.service';
import { UpdatePerfilProprioDto } from './dto/update-perfil-proprio.dto';

/**
 * Gestão de usuários (ADMIN/GESTOR) dentro do PRÓPRIO grupo de quem
 * está pedindo (Rodada 31). Antes desta rodada, o único jeito de um
 * `UsuarioEmpresa` existir era `prisma/seed.ts` , ou seja, só o super
 * admin (via `SuperAdminService.criarEmpresaMae`) conseguia colocar o
 * PRIMEIRO admin de um grupo no ar; a partir daí, é este service que
 * deixa esse admin convidar o resto do time (outros gestores, ou mais
 * um admin), sem depender de mais nenhuma intervenção do super admin.
 */
@Injectable()
export class UsuariosEmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUsuarioEmpresaDto, grupoId: string, actorId: string) {
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
        telefoneGerenciamentoRisco: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId,
      acao: 'USUARIO_EMPRESA_CRIADO',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuario.id,
      detalhes: { papel: dto.papel, email: dto.email },
    });

    return usuario;
  }

  list(grupoIdSolicitante: string) {
    return this.prisma.usuarioEmpresa.findMany({
      where: { grupoId: grupoIdSolicitante },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        telefoneGerenciamentoRisco: true,
        createdAt: true,
      },
    });
  }

  /**
   * Ativa/desativa outro usuário do MESMO grupo , nunca apaga (ver
   * comentário do DTO). Um usuário não pode desativar a si mesmo
   * (evita o próprio admin se trancar fora por engano, e um cenário de
   * "todo mundo desativado, ninguém consegue reativar ninguém").
   */
  async atualizarStatus(
    id: string,
    dto: AtualizarStatusUsuarioEmpresaDto,
    grupoIdSolicitante: string,
    actorId: string,
  ) {
    if (id === actorId) {
      throw new ForbiddenException(
        'Você não pode alterar o próprio status de acesso',
      );
    }
    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { id },
    });
    if (!usuario || usuario.grupoId !== grupoIdSolicitante) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const atualizado = await this.prisma.usuarioEmpresa.update({
      where: { id },
      data: { ativo: dto.ativo },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        telefoneGerenciamentoRisco: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId,
      acao: dto.ativo
        ? 'USUARIO_EMPRESA_REATIVADO'
        : 'USUARIO_EMPRESA_DESATIVADO',
      entidade: 'UsuarioEmpresa',
      entidadeId: id,
    });

    return atualizado;
  }

  /**
   * "Meu perfil" (Rodada 38) , o próprio usuário logado vê/edita seu
   * nome, contato (WhatsApp) e e-mail. Diferente de `atualizarStatus`,
   * aqui não há restrição de "não pode editar a si mesmo": é
   * exatamente o oposto, só o próprio dono do token chega a estes
   * métodos (`user.sub` do JWT, nunca um :id de rota).
   */
  async obterMeuPerfil(usuarioId: string) {
    const usuario = await this.prisma.usuarioEmpresa.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        telefoneGerenciamentoRisco: true,
        createdAt: true,
      },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async atualizarMeuPerfil(usuarioId: string, dto: UpdatePerfilProprioDto) {
    if (dto.email) {
      const existente = await this.prisma.usuarioEmpresa.findUnique({
        where: { email: dto.email },
      });
      if (existente && existente.id !== usuarioId) {
        throw new ConflictException('E-mail já cadastrado para outro usuário');
      }
    }

    // Rodada 163: só ADMIN define o número da equipe de Gerenciamento de Risco.
    let telefoneGr: string | null | undefined = undefined;
    if (dto.telefoneGerenciamentoRisco !== undefined) {
      const atual = await this.prisma.usuarioEmpresa.findUnique({
        where: { id: usuarioId },
        select: { papel: true },
      });
      if (atual?.papel === 'ADMIN') telefoneGr = dto.telefoneGerenciamentoRisco;
    }

    const atualizado = await this.prisma.usuarioEmpresa.update({
      where: { id: usuarioId },
      data: {
        nome: dto.nome ?? undefined,
        email: dto.email ?? undefined,
        telefoneWhatsapp: dto.telefoneWhatsapp ?? undefined,
        telefoneGerenciamentoRisco: telefoneGr,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefoneWhatsapp: true,
        telefoneGerenciamentoRisco: true,
        createdAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'USUARIO_ATUALIZOU_PROPRIO_PERFIL',
      entidade: 'UsuarioEmpresa',
      entidadeId: usuarioId,
    });

    return atualizado;
  }

  /** Rodada 174: limites de espera do grupo (null no banco = padrão). */
  async obterLimitesEspera(grupoId: string) {
    const g = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: {
        limiteEsperaInfoMin: true,
        limiteEsperaAtencaoMin: true,
        limiteEsperaCriticoMin: true,
      },
    });
    if (!g) throw new NotFoundException('Grupo não encontrado');
    return {
      infoMin: g.limiteEsperaInfoMin ?? LIMITES_ESPERA_PADRAO.infoMin,
      atencaoMin: g.limiteEsperaAtencaoMin ?? LIMITES_ESPERA_PADRAO.atencaoMin,
      criticoMin: g.limiteEsperaCriticoMin ?? LIMITES_ESPERA_PADRAO.criticoMin,
      padrao: LIMITES_ESPERA_PADRAO,
    };
  }

  async atualizarLimitesEspera(
    grupoId: string,
    usuarioId: string,
    dto: AtualizarLimitesEsperaDto,
  ) {
    if (!(dto.infoMin < dto.atencaoMin && dto.atencaoMin < dto.criticoMin)) {
      throw new BadRequestException(
        'Os limites devem estar em ordem crescente: informativo < próximo do limite < limite.',
      );
    }
    const anterior = await this.obterLimitesEspera(grupoId);
    await this.prisma.grupo.update({
      where: { id: grupoId },
      data: {
        limiteEsperaInfoMin: dto.infoMin,
        limiteEsperaAtencaoMin: dto.atencaoMin,
        limiteEsperaCriticoMin: dto.criticoMin,
      },
    });
    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'USUARIO_ATUALIZOU_LIMITES_ESPERA',
      entidade: 'Grupo',
      entidadeId: grupoId,
      detalhes: {
        antes: {
          infoMin: anterior.infoMin,
          atencaoMin: anterior.atencaoMin,
          criticoMin: anterior.criticoMin,
        },
        depois: dto,
      },
    });
    return this.obterLimitesEspera(grupoId);
  }
}
