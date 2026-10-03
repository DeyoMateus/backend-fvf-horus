import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DocumentosCargaController } from './documentos-carga.controller';
import { DocumentosCargaService } from './documentos-carga.service';
import { DocumentoCargaStorageProcessor } from './storage-queue/documento-carga-storage.processor';
import { FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA } from './storage-queue/documento-carga-storage.queue';

@Module({
  imports: [BullModule.registerQueue({ name: FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA })],
  controllers: [DocumentosCargaController],
  providers: [DocumentosCargaService, DocumentoCargaStorageProcessor],
})
export class DocumentosCargaModule {}
