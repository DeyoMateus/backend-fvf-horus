import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { Queue } from 'bullmq';
import { AuditService } from '../common/audit/audit.service';
import { GeocodingService } from '../common/geocoding/geocoding.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { TenantService } from '../common/tenant/tenant.service';
import { CreateDocumentoCargaDto } from './dto/create-documento-carga.dto';
import { extrairMetadadosXml } from './extrair-metadados-xml';
import {
  FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA,
  JobRetentarUploadR2,
} from './storage-queue/documento-carga-storage.queue';
import { normalizarPaginacao } from '../common/pagination/pagination.util';

/**
 * Documentos de carga (CT-e/MDF-e) , via upload manual pelo painel
 * (decisão do usuário: ainda não há certificado A1 próprio nem
 * integração com a SEFAZ). Guarda o XML original como veio, tenta
 * extrair número/chave de acesso de forma best-effort (nunca bloqueia
 * o upload se não conseguir), e vincula opcionalmente a um motorista ,
 * é a base do "status de viagem Carregado/Vazio".
 */
@Injectable()
export class DocumentosCargaService {
  private readonly logger = new Logger(DocumentosCargaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly geocoding: GeocodingService,
    private readonly tenant: TenantService,
    @InjectQueue(FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA)
    private readonly filaArmazenamento: Queue<JobRetentarUploadR2>,
  ) {}

  /**
   * `grupoId` vem sempre do token JWT de quem está enviando. Como um
   * grupo pode ter mais de um CNPJ, o `empresaId` CONCRETO deste
   * documento é resolvido assim: se veio `motoristaId`, é o empresaId
   * do próprio motorista (já conferido contra o grupo); senão, é
   * `dto.empresaId`, também conferido contra o grupo antes de aceitar.
   */
  async upload(
    grupoId: string,
    usuarioId: string,
    dto: CreateDocumentoCargaDto,
    arquivo: { buffer: Buffer; originalname: string },
  ) {
    let empresaId: string;
    if (dto.motoristaId) {
      const { empresaId: empresaIdDoMotorista } =
        await this.tenant.verificarMotoristaNoGrupo(dto.motoristaId, grupoId);
      // Pedido do usuário: motorista inativo/excluído não pode receber
      // NENHUM lançamento novo , só consulta ao que já existe.
      await this.tenant.verificarMotoristaAtivo(dto.motoristaId);
      empresaId = empresaIdDoMotorista;
    } else if (dto.empresaId) {
      await this.tenant.verificarEmpresaNoGrupo(dto.empresaId, grupoId);
      empresaId = dto.empresaId;
    } else {
      throw new BadRequestException(
        'Informe motoristaId ou empresaId (a que CNPJ do grupo este documento pertence)',
      );
    }

    const xmlTexto = arquivo.buffer.toString('utf-8');
    const extraido = extrairMetadadosXml(xmlTexto);

    // Geocodifica o endereço do destinatário (se extraído do XML) pra
    // já guardar as coordenadas da entrega , base da cerca virtual
    // avaliada depois, em RegistrosJornadaService.avaliarCercaVirtualEntrega.
    // Fail-open: se não configurado, sem endereço extraído, sem
    // resultado ou com erro de rede, segue sem coordenadas , nunca
    // bloqueia o upload.
    const coordenadasDestinatario = await this.geocoding.geocodificar(
      extraido.enderecoDestinatario,
    );

    // Se o storage R2 estiver configurado, tenta subir o XML pra lá já na
    // hora do upload (documento fica menor no Postgres, sem custo de
    // egress). Se não estiver configurado, ou se a tentativa falhar (rede
    // instável), guarda os bytes no Postgres como sempre , e, só no caso
    // de falha com R2 configurado, agenda um retry em segundo plano via
    // BullMQ pra migrar depois. Nunca bloqueia o upload por causa disso.
    const chaveR2 = `documentos-carga/${empresaId}/${randomUUID()}.xml`;
    let xmlOriginalParaSalvar: Buffer | null = arquivo.buffer;
    let xmlStorageKeyParaSalvar: string | null = null;

    if (this.storage.configurado()) {
      try {
        await this.storage.subirObjeto(
          chaveR2,
          arquivo.buffer,
          'application/xml',
        );
        xmlOriginalParaSalvar = null;
        xmlStorageKeyParaSalvar = chaveR2;
      } catch (erro) {
        this.storage.logFalhaUpload(chaveR2, erro);
        // Mantém os bytes no Postgres agora; agenda o retry depois de criar
        // o registro (precisamos do id do documento pro job).
      }
    }

    const documento = await this.prisma.documentoCarga.create({
      data: {
        empresaId,
        motoristaId: dto.motoristaId,
        tipo: dto.tipo,
        statusCarga: dto.statusCarga,
        numero: dto.numero ?? extraido.numero,
        chaveAcesso: dto.chaveAcesso ?? extraido.chaveAcesso,
        enderecoDestinatario: extraido.enderecoDestinatario,
        destinatarioLatitude: coordenadasDestinatario?.latitude,
        destinatarioLongitude: coordenadasDestinatario?.longitude,
        geocodificadoEm: extraido.enderecoDestinatario ? new Date() : undefined,
        observacao: dto.observacao,
        xmlOriginal: xmlOriginalParaSalvar
          ? new Uint8Array(xmlOriginalParaSalvar)
          : null,
        xmlStorageKey: xmlStorageKeyParaSalvar,
        uploadedPorUsuarioId: usuarioId,
      },
      select: {
        id: true,
        tipo: true,
        numero: true,
        chaveAcesso: true,
        statusCarga: true,
        motoristaId: true,
        observacao: true,
        entregueEm: true,
        enderecoDestinatario: true,
        destinatarioLatitude: true,
        destinatarioLongitude: true,
        createdAt: true,
      },
    });

    if (this.storage.configurado() && !xmlStorageKeyParaSalvar) {
      // Upload síncrono falhou mas R2 está configurado , agenda retry.
      await this.filaArmazenamento
        .add(
          'retry-upload',
          {
            documentoId: documento.id,
            chave: chaveR2,
            conteudoBase64: arquivo.buffer.toString('base64'),
          },
          { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
        )
        .catch((erro) =>
          this.logger.warn(
            `Não foi possível agendar retry de upload pro R2: ${(erro as Error).message}`,
          ),
        );
    }

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DOCUMENTO_CARGA_ENVIADO',
      entidade: 'DocumentoCarga',
      entidadeId: documento.id,
      detalhes: {
        tipo: dto.tipo,
        nomeArquivo: arquivo.originalname,
        numeroExtraidoAutomaticamente: !dto.numero && !!extraido.numero,
        chaveExtraidaAutomaticamente:
          !dto.chaveAcesso && !!extraido.chaveAcesso,
      },
    });

    return documento;
  }

  async listByGrupo(
    grupoId: string,
    page?: number,
    pageSize?: number,
    ordem?: 'asc' | 'desc',
    filtro?: {
      tipo?: 'CTE' | 'MDFE';
      statusCarga?: 'CARREGADO' | 'VAZIO';
      motoristaId?: string;
      numero?: string;
      chaveAcesso?: string;
    },
  ) {
    const paginacao = normalizarPaginacao(page, pageSize);
    const where = {
      empresa: { grupoId },
      ...(filtro?.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro?.statusCarga ? { statusCarga: filtro.statusCarga } : {}),
      ...(filtro?.motoristaId ? { motoristaId: filtro.motoristaId } : {}),
      ...(filtro?.numero
        ? { numero: { contains: filtro.numero, mode: 'insensitive' as const } }
        : {}),
      ...(filtro?.chaveAcesso
        ? { chaveAcesso: { contains: filtro.chaveAcesso } }
        : {}),
    };
    const [dados, total] = await Promise.all([
      this.prisma.documentoCarga.findMany({
        where,
        select: {
          id: true,
          tipo: true,
          numero: true,
          chaveAcesso: true,
          statusCarga: true,
          motoristaId: true,
          observacao: true,
          entregueEm: true,
          enderecoDestinatario: true,
          destinatarioLatitude: true,
          destinatarioLongitude: true,
          createdAt: true,
          motorista: { select: { nome: true } },
        },
        orderBy: { createdAt: ordem ?? 'desc' },
        skip: paginacao.skip,
        take: paginacao.take,
      }),
      this.prisma.documentoCarga.count({ where }),
    ]);
    return { dados, total, page: paginacao.page, pageSize: paginacao.pageSize };
  }

  async listByMotorista(motoristaId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    return this.prisma.documentoCarga.findMany({
      where: { motoristaId },
      select: {
        id: true,
        tipo: true,
        numero: true,
        chaveAcesso: true,
        statusCarga: true,
        observacao: true,
        entregueEm: true,
        enderecoDestinatario: true,
        destinatarioLatitude: true,
        destinatarioLongitude: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Status de carga ATUAL do motorista + quantos CT-e ainda estão "em
   * aberto" (vinculados, statusCarga CARREGADO) nesta viagem , cada
   * CT-e é praticamente uma entrega, então esse número é literalmente
   * "quantas entregas faltam" pro gestor acompanhar. MDF-e não entra
   * na contagem (é o manifesto da viagem, não uma entrega individual).
   */
  async statusAtualPorMotorista(
    motoristaId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarMotoristaNoGrupo(
      motoristaId,
      grupoIdSolicitante,
    );

    const [ultimo, cteEmAberto] = await Promise.all([
      this.prisma.documentoCarga.findFirst({
        where: { motoristaId },
        orderBy: { createdAt: 'desc' },
        select: {
          statusCarga: true,
          createdAt: true,
          tipo: true,
          numero: true,
        },
      }),
      this.prisma.documentoCarga.count({
        where: { motoristaId, tipo: 'CTE', statusCarga: 'CARREGADO' },
      }),
    ]);
    return { ...(ultimo ?? { statusCarga: null }), cteEmAberto };
  }

  /**
   * Exclusão definitiva de um documento de carga , remove o arquivo do
   * R2 (se estiver lá) antes de apagar o registro, igual ao padrão já
   * usado em TratamentosPontoService.removerEvidencia.
   */
  async remover(
    documentoId: string,
    usuarioId: string,
    grupoIdSolicitante: string,
  ) {
    await this.tenant.verificarDocumentoCargaNoGrupo(
      documentoId,
      grupoIdSolicitante,
    );
    const documento = await this.prisma.documentoCarga.findUnique({
      where: { id: documentoId },
    });
    if (!documento) throw new NotFoundException('Documento não encontrado');
    // Pedido do usuário: nada pode ser excluído de um motorista
    // inativo/excluído tampouco , só consulta ao histórico.
    if (documento.motoristaId) {
      await this.tenant.verificarMotoristaAtivo(documento.motoristaId);
    }

    if (documento.xmlStorageKey) {
      await this.storage.excluirObjeto(documento.xmlStorageKey);
    }

    await this.prisma.documentoCarga.delete({ where: { id: documentoId } });

    await this.audit.registrar({
      actorType: ActorType.USUARIO_EMPRESA,
      actorId: usuarioId,
      acao: 'DOCUMENTO_CARGA_EXCLUIDO',
      entidade: 'DocumentoCarga',
      entidadeId: documentoId,
      detalhes: {
        tipo: documento.tipo,
        numero: documento.numero,
        chaveAcesso: documento.chaveAcesso,
      },
    });

    return { ok: true };
  }

  async baixarXml(documentoId: string, grupoIdSolicitante: string) {
    await this.tenant.verificarDocumentoCargaNoGrupo(
      documentoId,
      grupoIdSolicitante,
    );
    const documento = await this.prisma.documentoCarga.findUnique({
      where: { id: documentoId },
    });
    if (!documento) throw new NotFoundException('Documento não encontrado');

    if (documento.xmlStorageKey) {
      const conteudo = await this.storage.baixarObjeto(documento.xmlStorageKey);
      return { ...documento, xmlOriginal: conteudo };
    }
    if (!documento.xmlOriginal) {
      throw new NotFoundException(
        'XML deste documento não foi encontrado nem no banco nem no storage externo',
      );
    }
    return documento;
  }
}
