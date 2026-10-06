import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, Prisma, StatusMotorista } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CertificateService } from '../common/signature/certificate.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizarPaginacao } from '../common/pagination/pagination.util';
import { CreateAjudanteDto } from './dto/create-ajudante.dto';
import { AtualizarStatusAjudanteDto } from './dto/atualizar-status-ajudante.dto';
import { VincularDispositivoAjudanteDto } from './dto/vincular-dispositivo-ajudante.dto';
import { hashChaveDispositivo } from '../common/crypto/device-key-hash.util';

/**
 * Ajudante (Rodada 66) , cadastro SEPARADO do Motorista (decisão
 * confirmada com o usuário: sem CNH, sem veículo vinculado, já que o
 * ajudante não dirige). Espelha MotoristasService de propósito (mesma
 * integridade legal: hash genesis + certificado digital + device
 * binding + soft-delete "Excluir cadastro"), só sem os pedaços que só
 * fazem sentido pra quem dirige (cnh, placa/rastreador).
 */
@Injectable()
export class AjudantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly certificados: CertificateService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateAjudanteDto, grupoId: string, actorId?: string) {
    await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    const empresaId = dto.empresaId;

    const cpfExistente = await this.prisma.ajudante.findUnique({
      where: { cpf: dto.cpf },
    });
    if (cpfExistente) throw new ConflictException('CPF já cadastrado');

    const id = randomUUID();
    // Reaproveita HashChainService.gerarHashGenesis , o parâmetro
    // "cnh" não existe pra ajudante; usa o próprio id (único, gerado
    // agora) no lugar só pra manter a mesma assinatura de função sem
    // duplicar lógica de hash genesis.
    const hashGenesis = this.hashChain.gerarHashGenesis({
      empresaId,
      cpf: dto.cpf,
      cnh: id,
    });

    // CertificateService.gerarParaMotorista é genérico (id/nome/cpf/
    // empresaCnpj) , não é exclusivo de Motorista, só nomeado assim
    // porque foi o primeiro uso. Reaproveitado aqui sem duplicar.
    const certificado = this.certificados.gerarParaMotorista({
      id,
      nome: dto.nome,
      cpf: dto.cpf,
      empresaCnpj: empresa.cnpj,
    });
    const cifrado = this.crypto.encrypt(certificado.pfxBuffer, id);

    const ctxTenant = TenantContext.atual();
    if (!ctxTenant) {
      throw new Error(
        'AjudantesService.create sem contexto de tenant , ver TenantContextInterceptor.',
      );
    }

    const [, ajudante] = (await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(
        `SET LOCAL app.grupo_atual = '${ctxTenant.grupoId.replace(/'/g, "''")}'`,
      ),
      this.prisma.cru.ajudante.create({
        data: {
          id,
          nome: dto.nome,
          cpf: dto.cpf,
          telefone: dto.telefone ?? null,
          status: StatusMotorista.ATIVO,
          empresaId,
          hashGenesis,
          certificadoPfxEnc:
            cifrado.ciphertext as unknown as Uint8Array<ArrayBuffer>,
          certificadoIv: cifrado.iv,
          certificadoAuthTag: cifrado.authTag,
          certificadoFingerprint: certificado.fingerprint,
          certificadoValidoAte: certificado.validoAte,
        },
        select: {
          id: true,
          nome: true,
          cpf: true,
          telefone: true,
          status: true,
          empresaId: true,
          hashGenesis: true,
          certificadoFingerprint: true,
          certificadoValidoAte: true,
          createdAt: true,
        },
      }),
    ])) as [
      unknown,
      {
        id: string;
        nome: string;
        cpf: string;
        status: StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
      },
    ];

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'AJUDANTE_CRIADO',
      entidade: 'Ajudante',
      entidadeId: ajudante.id,
      detalhes: { certificadoFingerprint: certificado.fingerprint },
    });

    return ajudante;
  }

  async atualizarStatus(
    id: string,
    dto: AtualizarStatusAjudanteDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
    const atual = await this.prisma.ajudante.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!atual) throw new NotFoundException('Ajudante não encontrado');

    const ajudante = await this.prisma.ajudante.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        nome: true,
        cpf: true,
        status: true,
        empresaId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'AJUDANTE_STATUS_ALTERADO',
      entidade: 'Ajudante',
      entidadeId: id,
      detalhes: {
        statusAnterior: atual.status,
        statusNovo: dto.status,
        motivo: dto.motivo ?? null,
      },
    });

    return ajudante;
  }

  async findById(id: string, grupoIdSolicitante: string) {
    await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
    const ajudante = await this.prisma.ajudante.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cpf: true,
        telefone: true,
        status: true,
        empresaId: true,
        hashGenesis: true,
        certificadoFingerprint: true,
        certificadoValidoAte: true,
        createdAt: true,
        updatedAt: true,
        excluidoEm: true,
        motivoExclusao: true,
        dispositivoVinculado: {
          select: { deviceUuid: true, vinculadoEm: true, atualizadoEm: true },
        },
      },
    });
    if (!ajudante) throw new NotFoundException('Ajudante não encontrado');
    return ajudante;
  }

  async listByGrupo(
    grupoId: string,
    page?: number,
    pageSize?: number,
    busca?: string,
    incluirExcluidos?: boolean,
  ) {
    const paginacao = normalizarPaginacao(page, pageSize);
    const termo = busca?.trim();
    const where = {
      empresa: { grupoId },
      ...(incluirExcluidos ? {} : { excluidoEm: null }),
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo, mode: Prisma.QueryMode.insensitive } },
              { cpf: { contains: termo } },
            ],
          }
        : {}),
    };
    const [dados, total] = await Promise.all([
      this.prisma.ajudante.findMany({
        where,
        select: {
          id: true,
          nome: true,
          cpf: true,
          status: true,
          certificadoValidoAte: true,
          createdAt: true,
          excluidoEm: true,
          dispositivoVinculado: { select: { deviceUuid: true } },
        },
        orderBy: { nome: 'asc' },
        skip: paginacao.skip,
        take: paginacao.take,
      }),
      this.prisma.ajudante.count({ where }),
    ]);
    return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
  }

  /** "Excluir cadastro" , mesmo padrão da Rodada 65 para Motorista, ver comentário lá. */
  async excluir(
    id: string,
    motivo: string | undefined,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarAjudanteNoGrupo(id, grupoIdSolicitante);
    const atual = await this.prisma.ajudante.findUnique({
      where: { id },
      select: { status: true, excluidoEm: true },
    });
    if (!atual) throw new NotFoundException('Ajudante não encontrado');
    if (atual.excluidoEm)
      throw new ConflictException('Este cadastro já foi excluído');

    const agora = new Date();
    const ajudante = await this.prisma.$transaction(async (tx) => {
      await tx.dispositivoVinculadoAjudante.deleteMany({
        where: { ajudanteId: id },
      });
      return tx.ajudante.update({
        where: { id },
        data: {
          status: StatusMotorista.INATIVO,
          excluidoEm: agora,
          excluidoPorUsuarioId: usuarioId,
          motivoExclusao: motivo ?? null,
        },
        select: {
          id: true,
          nome: true,
          cpf: true,
          status: true,
          excluidoEm: true,
        },
      });
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'AJUDANTE_EXCLUIDO',
      entidade: 'Ajudante',
      entidadeId: id,
      detalhes: { statusAnterior: atual.status, motivo: motivo ?? null },
    });

    return ajudante;
  }

  // ===== Device binding (mesmo padrão de DispositivosService, para Ajudante) =====

  async vincularDispositivo(
    ajudanteId: string,
    dto: VincularDispositivoAjudanteDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);

    const deviceUuidEmUsoPorOutro =
      await this.prisma.dispositivoVinculadoAjudante.findFirst({
        where: { deviceUuid: dto.deviceUuid, ajudanteId: { not: ajudanteId } },
      });
    if (deviceUuidEmUsoPorOutro) {
      throw new ConflictException(
        'Este aparelho já está vinculado a outro ajudante',
      );
    }

    const deviceApiKeyPlano = randomBytes(32).toString('hex');
    const deviceApiKeyHash = hashChaveDispositivo(deviceApiKeyPlano);

    const vinculo = await this.prisma.dispositivoVinculadoAjudante.upsert({
      where: { ajudanteId },
      update: {
        deviceUuid: dto.deviceUuid,
        deviceApiKeyHash,
        vinculadoPorUsuarioId: usuarioId,
      },
      create: {
        ajudanteId,
        deviceUuid: dto.deviceUuid,
        deviceApiKeyHash,
        vinculadoPorUsuarioId: usuarioId,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DISPOSITIVO_AJUDANTE_VINCULADO',
      entidade: 'Ajudante',
      entidadeId: ajudanteId,
      detalhes: { deviceUuid: dto.deviceUuid },
    });

    return {
      ajudanteId,
      deviceUuid: vinculo.deviceUuid,
      vinculadoEm: vinculo.vinculadoEm,
      deviceApiKey: deviceApiKeyPlano,
    };
  }

  async statusDispositivo(ajudanteId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);
    const vinculo = await this.prisma.dispositivoVinculadoAjudante.findUnique({
      where: { ajudanteId },
      select: {
        deviceUuid: true,
        vinculadoEm: true,
        atualizadoEm: true,
        vinculadoPorUsuarioId: true,
      },
    });
    return vinculo ?? { vinculado: false };
  }

  async revogarDispositivo(
    ajudanteId: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarAjudanteNoGrupo(ajudanteId, grupoIdSolicitante);
    const vinculo = await this.prisma.dispositivoVinculadoAjudante.findUnique({
      where: { ajudanteId },
    });
    if (!vinculo)
      throw new NotFoundException('Ajudante não tem dispositivo vinculado');

    await this.prisma.dispositivoVinculadoAjudante.delete({
      where: { ajudanteId },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DISPOSITIVO_AJUDANTE_REVOGADO',
      entidade: 'Ajudante',
      entidadeId: ajudanteId,
      detalhes: { deviceUuidRevogado: vinculo.deviceUuid },
    });
  }
}
