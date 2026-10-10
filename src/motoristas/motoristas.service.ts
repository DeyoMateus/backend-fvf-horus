import { grupoIdSeguro } from '../common/prisma/grupo-id-seguro';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, Prisma, StatusMotorista } from '@prisma/client';
import { normalizarPlaca } from '../veiculos/normalizar-placa.util';
import { randomUUID } from 'crypto';
import { AuditService } from '../common/audit/audit.service';
import { TenantService } from '../common/tenant/tenant.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CertificateService } from '../common/signature/certificate.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { AtualizarStatusMotoristaDto } from './dto/atualizar-status-motorista.dto';
import { AtualizarCadastroMotoristaDto } from './dto/atualizar-cadastro-motorista.dto';
import { AtualizarPerfilMotoristaDto } from './dto/atualizar-perfil-motorista.dto';
import {
  condicaoBuscaCpf,
  protegerDadosPii,
  revelarPii,
} from '../common/crypto/pii-campo.util';
import { normalizarPaginacao } from '../common/pagination/pagination.util';

@Injectable()
export class MotoristasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly certificados: CertificateService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
  ) {}

  /**
   * Cadastro de motorista: além dos dados cadastrais, aqui nasce a
   * "identidade criptográfica" dele no sistema ,
   *   1) hash genesis (âncora da cadeia de jornada);
   *   2) par de chaves + certificado digital (para assinar cada evento);
   *   3) certificado cifrado em repouso (envelope encryption) antes de
   *      tocar o banco , o PFX em texto puro nunca é persistido.
   *
   * O motorista nasce SEM aparelho vinculado , ele só consegue bater
   * ponto depois que um gestor/admin vincular um dispositivo a ele
   * (ver DispositivosController). Isso é intencional: quem autoriza um
   * aparelho a assinar em nome do motorista é sempre a empresa.
   */
  /**
   * `grupoId` vem SEMPRE do JWT de quem está criando (nunca de um
   * campo do corpo da requisição) , é o que impede um usuário
   * autenticado de um grupo plantar um motorista dentro do tenant de
   * outro. `dto.empresaId` (qual CNPJ do grupo) é conferido contra o
   * grupo antes de qualquer coisa , ver o comentário em
   * CreateMotoristaDto e TenantService.
   */
  async create(dto: CreateMotoristaDto, grupoId: string, actorId?: string) {
    await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    const empresaId = dto.empresaId;

    const [cpfExistente, cnhExistente] = await Promise.all([
      this.prisma.motorista.findUnique({ where: { cpf: dto.cpf } }),
      this.prisma.motorista.findUnique({ where: { cnh: dto.cnh } }),
    ]);
    if (cpfExistente || cnhExistente)
      throw new ConflictException('CPF ou CNH já cadastrado');

    const id = randomUUID();
    const hashGenesis = this.hashChain.gerarHashGenesis({
      empresaId,
      cpf: dto.cpf,
      cnh: dto.cnh,
    });

    const certificado = this.certificados.gerarParaMotorista({
      id,
      nome: dto.nome,
      cpf: dto.cpf,
      empresaCnpj: empresa.cnpj,
    });
    const cifrado = this.crypto.encrypt(certificado.pfxBuffer, id);

    // Placa é OPCIONAL no cadastro , o motorista pode nascer sem
    // veículo definido ainda (o gestor ou o próprio motorista
    // preenche depois, pelo painel ou pelo app). Quando informada,
    // o VeiculoVinculado nasce na MESMA transação da criação do
    // motorista (o `id` já foi gerado acima, então dá pra
    // referenciar sem precisar do resultado do primeiro create).
    const placaNormalizada = dto.placa ? normalizarPlaca(dto.placa) : null;

    // As operações abaixo entram TODAS na mesma `$transaction([...])`
    // (forma array) , por isso usam `this.prisma.cru.*` (delegados SEM
    // a interceptação de RLS de `this.prisma.*`, ver prisma.service.ts)
    // e o próprio SET LOCAL é o primeiro item do array, à mão: usar o
    // delegado interceptado aqui criaria uma mini-transação própria
    // pra cada `create`, quebrando a atomicidade (motorista +
    // veículo têm que nascer juntos ou não nascer nenhum dos dois).
    const ctxTenant = TenantContext.atual();
    if (!ctxTenant) {
      throw new Error(
        'MotoristasService.create sem contexto de tenant , ver TenantContextInterceptor.',
      );
    }
    const operacoes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.$executeRawUnsafe(
        `SET LOCAL app.grupo_atual = '${grupoIdSeguro(ctxTenant.grupoId)}'`,
      ),
      this.prisma.cru.motorista.create({
        data: {
          id,
          nome: dto.nome,
          ...protegerDadosPii({
            cpf: dto.cpf,
            cnh: dto.cnh,
            telefone: dto.telefone ?? null,
          }),
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
          cnh: true,
          telefone: true,
          status: true,
          empresaId: true,
          hashGenesis: true,
          certificadoFingerprint: true,
          certificadoValidoAte: true,
          createdAt: true,
        },
      }),
    ];
    if (placaNormalizada) {
      operacoes.push(
        this.prisma.cru.veiculoVinculado.create({
          data: {
            motoristaId: id,
            placa: placaNormalizada,
            idRastreador: dto.idRastreador,
            tecnologiaRastreador: dto.tecnologiaRastreador,
            atualizadoPorTipo: ActorType.USUARIO_EMPRESA,
            atualizadoPorId: actorId ?? null,
          },
        }),
      );
    }
    const [, motorista] = (await this.prisma.$transaction(operacoes)) as [
      unknown,
      {
        id: string;
        nome: string;
        cpf: string;
        cnh: string;
        status: StatusMotorista;
        empresaId: string;
        hashGenesis: string;
        certificadoFingerprint: string;
        certificadoValidoAte: Date;
        createdAt: Date;
      },
    ];
    revelarPii(motorista); // cru não passa pelo proxy de decifra

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: actorId ?? null,
      acao: 'MOTORISTA_CRIADO',
      entidade: 'Motorista',
      entidadeId: motorista.id,
      detalhes: {
        certificadoFingerprint: certificado.fingerprint,
        placa: placaNormalizada,
      },
    });

    // O PFX/senha do certificado nunca saem daqui.
    return motorista;
  }

  /**
   * Mudança de status: INATIVO funciona como arquivo morto (nada apaga,
   * só deixa de valer pra frente); SUSPENSO é o mesmo efeito prático mas
   * sinaliza algo temporário/em apuração, não um desligamento definitivo.
   * Em ambos os casos o motorista imediatamente deixa de conseguir se
   * autenticar pelo app , `MotoristaDeviceGuard` já exige
   * `status === 'ATIVO'`. Diferente de `excluir()` abaixo: continua
   * aparecendo na listagem normal do painel, só com o status mudado.
   */
  async atualizarStatus(
    id: string,
    dto: AtualizarStatusMotoristaDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
    const atual = await this.prisma.motorista.findUnique({
      where: { id },
      select: { status: true, excluidoEm: true },
    });
    if (!atual) throw new NotFoundException('Motorista não encontrado');
    // Pedido do usuário: cadastro excluído não pode ser alterado de
    // jeito nenhum (nem "reativado" por aqui) , exclusão é definitiva,
    // só consulta ao histórico continua disponível.
    if (atual.excluidoEm) {
      throw new ForbiddenException(
        'Este cadastro está excluído e não pode ser alterado , o histórico continua disponível pra consulta.',
      );
    }

    const motorista = await this.prisma.motorista.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        nome: true,
        cpf: true,
        cnh: true,
        status: true,
        empresaId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'MOTORISTA_STATUS_ALTERADO',
      entidade: 'Motorista',
      entidadeId: id,
      detalhes: {
        statusAnterior: atual.status,
        statusNovo: dto.status,
        motivo: dto.motivo ?? null,
      },
    });

    return motorista;
  }

  /**
   * Edição dos dados cadastrais (nome/telefone) , ver o comentário em
   * `AtualizarCadastroMotoristaDto` pra entender por que CPF e CNH
   * NUNCA entram aqui: os dois são a âncora do hash genesis e o CPF
   * também está gravado dentro do certificado digital já emitido, então
   * editá-los depois do cadastro desalinharia a cadeia de hash/o
   * certificado do que está gravado na tabela.
   */
  async atualizarCadastro(
    id: string,
    dto: AtualizarCadastroMotoristaDto,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
    // Pedido do usuário: motorista inativo/excluído não pode ter NADA
    // alterado no cadastro , só consulta ao que já existe. Reativar
    // (voltar pra ATIVO) continua em `atualizarStatus`, que não passa
    // por aqui.
    await this.tenant.verificarMotoristaAtivo(id);
    const atual = await this.prisma.motorista.findUnique({
      where: { id },
      select: { nome: true, telefone: true },
    });
    if (!atual) throw new NotFoundException('Motorista não encontrado');

    const data: Prisma.MotoristaUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.telefone !== undefined) data.telefone = dto.telefone;

    const motorista = await this.prisma.motorista.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        cpf: true,
        cnh: true,
        telefone: true,
        status: true,
        empresaId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'MOTORISTA_CADASTRO_ATUALIZADO',
      entidade: 'Motorista',
      entidadeId: id,
      detalhes: {
        nomeAnterior: atual.nome,
        nomeNovo: motorista.nome,
        telefoneAnterior: atual.telefone,
        telefoneNovo: motorista.telefone,
      },
    });

    return motorista;
  }

  async findById(id: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
    const motorista = await this.prisma.motorista.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cpf: true,
        cnh: true,
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
        veiculoVinculado: {
          select: {
            placa: true,
            idRastreador: true,
            tecnologiaRastreador: true,
            atualizadoEm: true,
          },
        },
      },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    // Rodada 65 , de propósito NÃO filtra por `excluidoEm`: quem já tem
    // o link/id de um motorista excluído (ex.: veio de um registro
    // antigo, de um relatório, ou de uma busca) precisa continuar
    // conseguindo abrir o perfil dele e ver o histórico completo. Só a
    // listagem (`listByGrupo`, abaixo) esconde por padrão.
    return motorista;
  }

  /**
   * `busca` filtra por nome OU cpf (contains, case-insensitive) , usado
   * pelo campo de busca da listagem no painel. `incluirExcluidos`
   * (Rodada 65): por padrão a listagem só traz motoristas com
   * `excluidoEm: null` (cadastro "excluído" some da lista normal); com
   * esta flag, a busca também vasculha os excluídos , é assim que
   * "pesquisar o nome de alguém que foi excluído" continua encontrando
   * o cadastro (e, a partir dele, todo o histórico) sem precisar
   * reativar nada.
   */
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
              ...(condicaoBuscaCpf(termo) ? [condicaoBuscaCpf(termo)!] : []),
            ],
          }
        : {}),
    };
    const [dados, total] = await Promise.all([
      this.prisma.motorista.findMany({
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
          veiculoVinculado: { select: { placa: true } },
        },
        orderBy: { nome: 'asc' },
        skip: paginacao.skip,
        take: paginacao.take,
      }),
      this.prisma.motorista.count({ where }),
    ]);
    return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
  }

  /**
   * "Excluir cadastro" (Rodada 65) , pedido explícito do usuário: tira o
   * motorista da listagem normal do painel, mas continua sendo um
   * soft-delete (ver comentário do campo `excluidoEm` no schema.prisma).
   * Nunca é um DELETE de verdade , não dá pra apagar a linha sem quebrar
   * a cadeia de hash e todas as tabelas de histórico que referenciam
   * motoristaId. nome/cpf/cnh continuam intactos: qualquer relatório,
   * holerite, indicador ou busca por nome que já existia continua
   * encontrando os registros normalmente, exatamente como pedido.
   *
   * Efeitos colaterais, na mesma transação:
   * - status vira INATIVO (se não já estiver) , reforça que ele não
   *   trabalha mais ali, mesmo pra quem só olhar o campo `status`;
   * - o vínculo de dispositivo é revogado imediatamente (mesmo efeito de
   *   `DispositivosService.revogar`) , o aparelho dele para de conseguir
   *   bater ponto na hora, sem depender só do `status !== 'ATIVO'` já
   *   checado pelo `MotoristaDeviceGuard`.
   */
  async excluir(
    id: string,
    motivo: string | undefined,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(id, grupoIdSolicitante);
    const atual = await this.prisma.motorista.findUnique({
      where: { id },
      select: { status: true, excluidoEm: true, nome: true },
    });
    if (!atual) throw new NotFoundException('Motorista não encontrado');
    if (atual.excluidoEm)
      throw new ConflictException('Este cadastro já foi excluído');

    const agora = new Date();
    const motorista = await this.prisma.$transaction(async (tx) => {
      await tx.dispositivoVinculado.deleteMany({ where: { motoristaId: id } });
      return revelarPii(await tx.motorista.update({
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
          cnh: true,
          status: true,
          excluidoEm: true,
        },
      }));
    });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'MOTORISTA_EXCLUIDO',
      entidade: 'Motorista',
      entidadeId: id,
      detalhes: { statusAnterior: atual.status, motivo: motivo ?? null },
    });

    return motorista;
  }

  /**
   * Alertas de "aparelho suspeito" (root/jailbreak, hooking, mock
   * location habilitado) que o app mobile reportou junto de algum
   * registro de ponto , ver `RegistrosJornadaService.create` e
   * `mobile/src/security/deviceIntegrity.ts`. Lê do AuditLog (nunca do
   * ledger em si) e nunca bloqueia nada por conta própria; é só
   * visibilidade pro gestor investigar.
   */
  /**
   * "Meu perfil" (Rodada 39) , o PRÓPRIO motorista, autenticado pelo
   * device binding (nunca um :id de rota), vê/edita seu nome, telefone
   * e e-mail. Sem checagem de tenant: `motoristaId` já vem garantido
   * pelo `MotoristaDeviceGuard` como sendo ele mesmo.
   */
  async obterPerfilProprio(motoristaId: string) {
    const motorista = await this.prisma.motorista.findUnique({
      where: { id: motoristaId },
      select: { id: true, nome: true, cpf: true, telefone: true },
    });
    if (!motorista) throw new NotFoundException('Motorista não encontrado');
    return motorista;
  }

  async atualizarPerfilProprio(
    motoristaId: string,
    dto: AtualizarPerfilMotoristaDto,
  ) {
    const atualizado = await this.prisma.motorista.update({
      where: { id: motoristaId },
      data: { nome: dto.nome, telefone: dto.telefone },
      select: { id: true, nome: true, cpf: true, telefone: true },
    });

    await this.audit.registrar({
      actorType: ActorType.MOTORISTA,
      actorId: motoristaId,
      acao: 'MOTORISTA_ATUALIZOU_PROPRIO_PERFIL',
      entidade: 'Motorista',
      entidadeId: motoristaId,
    });

    return atualizado;
  }

  async listarAlertasIntegridadeDispositivo(
    motoristaId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    return this.prisma.auditLog.findMany({
      where: { acao: 'INTEGRIDADE_DISPOSITIVO_SUSPEITA', actorId: motoristaId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
