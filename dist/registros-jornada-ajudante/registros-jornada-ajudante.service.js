"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrosJornadaAjudanteService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../common/audit/audit.service");
const envelope_encryption_service_1 = require("../common/crypto/envelope-encryption.service");
const hash_chain_service_1 = require("../common/hash-chain/hash-chain.service");
const certificate_service_1 = require("../common/signature/certificate.service");
const signature_service_1 = require("../common/signature/signature.service");
const prisma_service_1 = require("../common/prisma/prisma.service");
const tenant_context_1 = require("../common/tenant/tenant-context");
let RegistrosJornadaAjudanteService = class RegistrosJornadaAjudanteService {
    prisma;
    hashChain;
    crypto;
    certificados;
    assinaturas;
    audit;
    constructor(prisma, hashChain, crypto, certificados, assinaturas, audit) {
        this.prisma = prisma;
        this.hashChain = hashChain;
        this.crypto = crypto;
        this.certificados = certificados;
        this.assinaturas = assinaturas;
        this.audit = audit;
    }
    async create(ajudanteId, deviceUuidUsado, dto, ip, userAgent) {
        const registro = await this.prisma.$transaction(async (tx) => {
            const ctxTenant = tenant_context_1.TenantContext.atual();
            if (!ctxTenant) {
                throw new Error('create() de RegistroJornadaAjudante sem contexto de tenant , ver TenantContextInterceptor.');
            }
            await tx.$executeRawUnsafe(`SET LOCAL app.grupo_atual = '${ctxTenant.grupoId.replace(/'/g, "''")}'`);
            if (dto.idempotencyKey) {
                const existente = await tx.registroJornadaAjudante.findUnique({
                    where: { idempotencyKey: dto.idempotencyKey },
                });
                if (existente)
                    return existente;
            }
            const ajudante = await tx.ajudante.findUnique({
                where: { id: ajudanteId },
            });
            if (!ajudante)
                throw new common_1.NotFoundException('Ajudante não encontrado');
            const ultimo = await tx.registroJornadaAjudante.findFirst({
                where: { ajudanteId },
                orderBy: { sequencial: 'desc' },
            });
            const sequencial = (ultimo?.sequencial ?? 0) + 1;
            const hashAnterior = ultimo?.hashAtual ?? ajudante.hashGenesis;
            const latitude = this.arredondarCoordenada(dto.latitude);
            const longitude = this.arredondarCoordenada(dto.longitude);
            const hashAtual = this.hashChain.calcularHash(hashAnterior, sequencial, {
                motoristaId: ajudanteId,
                tipoEvento: dto.tipoEvento,
                timestampEvento: dto.timestampEvento,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                precisaoGpsM: dto.precisaoGpsM ?? null,
                observacao: dto.observacao ?? null,
                sequencial,
                deviceUuidUsado,
            });
            let assinaturaDigital = null;
            if (ajudante.certificadoPfxEnc &&
                ajudante.certificadoIv &&
                ajudante.certificadoAuthTag) {
                const pfxDecifrado = this.crypto.decrypt(Buffer.from(ajudante.certificadoPfxEnc), ajudante.certificadoIv, ajudante.certificadoAuthTag, ajudante.id);
                const { privateKey } = this.certificados.decodificar(ajudante.id, pfxDecifrado);
                assinaturaDigital = this.assinaturas.assinar(privateKey, hashAtual);
            }
            const registroCriado = await tx.registroJornadaAjudante.create({
                data: {
                    ajudanteId,
                    tipoEvento: dto.tipoEvento,
                    timestampEvento: new Date(dto.timestampEvento),
                    latitude,
                    longitude,
                    precisaoGpsM: dto.precisaoGpsM,
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
                actorType: client_1.ActorType.AJUDANTE,
                actorId: ajudanteId,
                acao: 'REGISTRO_JORNADA_AJUDANTE_CRIADO',
                entidade: 'RegistroJornadaAjudante',
                entidadeId: registroCriado.id,
                detalhes: { sequencial, tipoEvento: dto.tipoEvento },
                ip,
                userAgent,
            });
            return registroCriado;
        }, { isolationLevel: 'Serializable' });
        return registro;
    }
    async listarPorAjudante(ajudanteId) {
        return this.prisma.registroJornadaAjudante.findMany({
            where: { ajudanteId },
            orderBy: { sequencial: 'asc' },
        });
    }
    arredondarCoordenada(valor) {
        if (valor === undefined || valor === null)
            return null;
        return Math.round(valor * 1e7) / 1e7;
    }
};
exports.RegistrosJornadaAjudanteService = RegistrosJornadaAjudanteService;
exports.RegistrosJornadaAjudanteService = RegistrosJornadaAjudanteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hash_chain_service_1.HashChainService,
        envelope_encryption_service_1.EnvelopeEncryptionService,
        certificate_service_1.CertificateService,
        signature_service_1.SignatureService,
        audit_service_1.AuditService])
], RegistrosJornadaAjudanteService);
//# sourceMappingURL=registros-jornada-ajudante.service.js.map