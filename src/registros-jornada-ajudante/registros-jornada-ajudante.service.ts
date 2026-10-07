import {
  arredondarCoordenadaGps,
  arredondarPrecisaoGps,
} from '../common/hash-chain/precisao-gps.util';
import { grupoIdSeguro } from '../common/prisma/grupo-id-seguro';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { EnvelopeEncryptionService } from '../common/crypto/envelope-encryption.service';
import { HashChainService } from '../common/hash-chain/hash-chain.service';
import { CertificateService } from '../common/signature/certificate.service';
import { SignatureService } from '../common/signature/signature.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateRegistroJornadaAjudanteDto } from './dto/create-registro-jornada-ajudante.dto';

/**
 * Ledger de eventos do Ajudante (Rodada 66) , espelha o núcleo de
 * `RegistrosJornadaService.create()` (cadeia de hash + assinatura
 * digital + WORM + idempotência), DE PROPÓSITO sem o motor de limites
 * legais de jornada de DIREÇÃO, o motor de antifraude de deslocamento
 * nem o agendamento de verificação proativa , nenhum deles se aplica
 * ao conjunto restrito de 4 eventos do ajudante (ver comentário no
 * schema.prisma, seção "AJUDANTE"). Se algum alerta equivalente for
 * pedido no futuro, é aditivo , não exige tocar neste arquivo.
 */
@Injectable()
export class RegistrosJornadaAjudanteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly certificados: CertificateService,
    private readonly assinaturas: SignatureService,
    private readonly audit: AuditService,
  ) {}

  async create(
    ajudanteId: string,
    deviceUuidUsado: string,
    dto: CreateRegistroJornadaAjudanteDto,
    ip?: string,
    userAgent?: string,
  ) {
    const registro = await this.prisma.$transaction(
      async (tx) => {
        const ctxTenant = TenantContext.atual();
        if (!ctxTenant) {
          throw new Error(
            'create() de RegistroJornadaAjudante sem contexto de tenant , ver TenantContextInterceptor.',
          );
        }
        await tx.$executeRawUnsafe(
          `SET LOCAL app.grupo_atual = '${grupoIdSeguro(ctxTenant.grupoId)}'`,
        );

        if (dto.idempotencyKey) {
          const existente = await tx.registroJornadaAjudante.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existente) return existente;
        }

        const ajudante = await tx.ajudante.findUnique({
          where: { id: ajudanteId },
        });
        if (!ajudante) throw new NotFoundException('Ajudante não encontrado');

        const ultimo = await tx.registroJornadaAjudante.findFirst({
          where: { ajudanteId },
          orderBy: { sequencial: 'desc' },
        });

        const sequencial = (ultimo?.sequencial ?? 0) + 1;
        const hashAnterior = ultimo?.hashAtual ?? ajudante.hashGenesis;

        const latitude = this.arredondarCoordenada(dto.latitude);
        const longitude = this.arredondarCoordenada(dto.longitude);

        const hashAtual = this.hashChain.calcularHash(
          hashAnterior,
          sequencial,
          {
            // O campo se chama `motoristaId` no payload canônico do hash
            // (HashChainService é genérico , só carrega o id do "dono do
            // livro" , ver comentário lá) , usar `ajudanteId` aqui é
            // seguro: entra como um dado opaco no JSON assinado, sem
            // nenhuma FK/checagem relacional atrelada a esse nome de campo.
            motoristaId: ajudanteId,
            tipoEvento: dto.tipoEvento,
            timestampEvento: dto.timestampEvento,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            precisaoGpsM: arredondarPrecisaoGps(dto.precisaoGpsM),
            observacao: dto.observacao ?? null,
            sequencial,
            deviceUuidUsado,
          },
        );

        let assinaturaDigital: string | null = null;
        if (
          ajudante.certificadoPfxEnc &&
          ajudante.certificadoIv &&
          ajudante.certificadoAuthTag
        ) {
          const pfxDecifrado = this.crypto.decrypt(
            Buffer.from(ajudante.certificadoPfxEnc as Buffer),
            ajudante.certificadoIv,
            ajudante.certificadoAuthTag,
            ajudante.id,
          );
          const { privateKey } = this.certificados.decodificar(
            ajudante.id,
            pfxDecifrado,
          );
          assinaturaDigital = this.assinaturas.assinar(privateKey, hashAtual);
        }

        const registroCriado = await tx.registroJornadaAjudante.create({
          data: {
            ajudanteId,
            tipoEvento: dto.tipoEvento,
            timestampEvento: new Date(dto.timestampEvento),
            latitude,
            longitude,
            precisaoGpsM: arredondarPrecisaoGps(dto.precisaoGpsM),
            observacao: dto.observacao,
            sequencial,
            hashAnterior,
            hashAtual,
            assinaturaDigital,
            deviceUuidUsado,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        await this.audit.registrar({
          actorType: ActorType.AJUDANTE,
          actorId: ajudanteId,
          acao: 'REGISTRO_JORNADA_AJUDANTE_CRIADO',
          entidade: 'RegistroJornadaAjudante',
          entidadeId: registroCriado.id,
          detalhes: { sequencial, tipoEvento: dto.tipoEvento },
          ip,
          userAgent,
        });

        return registroCriado;
      },
      { isolationLevel: 'Serializable' },
    );

    return registro;
  }

  async listarPorAjudante(ajudanteId: string) {
    return this.prisma.registroJornadaAjudante.findMany({
      where: { ajudanteId },
      orderBy: { sequencial: 'asc' },
    });
  }

  private arredondarCoordenada(
    valor: number | undefined | null,
  ): number | null {
    return arredondarCoordenadaGps(valor);
  }
}
