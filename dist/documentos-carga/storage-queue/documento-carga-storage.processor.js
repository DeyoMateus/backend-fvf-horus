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
var DocumentoCargaStorageProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentoCargaStorageProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const storage_service_1 = require("../../common/storage/storage.service");
const documento_carga_storage_queue_1 = require("./documento-carga-storage.queue");
let DocumentoCargaStorageProcessor = DocumentoCargaStorageProcessor_1 = class DocumentoCargaStorageProcessor extends bullmq_1.WorkerHost {
    storage;
    prisma;
    logger = new common_1.Logger(DocumentoCargaStorageProcessor_1.name);
    constructor(storage, prisma) {
        super();
        this.storage = storage;
        this.prisma = prisma;
    }
    async process(job) {
        const { documentoId, chave, conteudoBase64 } = job.data;
        const buffer = Buffer.from(conteudoBase64, 'base64');
        await this.storage.subirObjeto(chave, buffer, 'application/xml');
        await this.prisma.documentoCarga.update({
            where: { id: documentoId },
            data: { xmlStorageKey: chave, xmlOriginal: null },
        });
        this.logger.log(`Documento ${documentoId}: XML migrado pro R2 via retry em segundo plano (chave ${chave}).`);
    }
};
exports.DocumentoCargaStorageProcessor = DocumentoCargaStorageProcessor;
exports.DocumentoCargaStorageProcessor = DocumentoCargaStorageProcessor = DocumentoCargaStorageProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(documento_carga_storage_queue_1.FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        prisma_service_1.PrismaService])
], DocumentoCargaStorageProcessor);
//# sourceMappingURL=documento-carga-storage.processor.js.map