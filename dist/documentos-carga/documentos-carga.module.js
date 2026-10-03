"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentosCargaModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const documentos_carga_controller_1 = require("./documentos-carga.controller");
const documentos_carga_service_1 = require("./documentos-carga.service");
const documento_carga_storage_processor_1 = require("./storage-queue/documento-carga-storage.processor");
const documento_carga_storage_queue_1 = require("./storage-queue/documento-carga-storage.queue");
let DocumentosCargaModule = class DocumentosCargaModule {
};
exports.DocumentosCargaModule = DocumentosCargaModule;
exports.DocumentosCargaModule = DocumentosCargaModule = __decorate([
    (0, common_1.Module)({
        imports: [bullmq_1.BullModule.registerQueue({ name: documento_carga_storage_queue_1.FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA })],
        controllers: [documentos_carga_controller_1.DocumentosCargaController],
        providers: [documentos_carga_service_1.DocumentosCargaService, documento_carga_storage_processor_1.DocumentoCargaStorageProcessor],
    })
], DocumentosCargaModule);
//# sourceMappingURL=documentos-carga.module.js.map