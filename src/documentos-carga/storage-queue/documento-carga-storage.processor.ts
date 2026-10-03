import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA,
  JobRetentarUploadR2,
} from './documento-carga-storage.queue';

/**
 * Só existe pro caminho de RETRY: quando o upload síncrono do XML pro R2
 * falhou no momento do request (rede instável, R2 fora do ar por
 * instantes), o documento fica salvo com os bytes no Postgres como sempre
 * (nada perdido, gestor não percebe nada de diferente) e este job tenta de
 * novo em segundo plano. Só quando o retry funciona é que o
 * `xmlOriginal` do Postgres é liberado (setado como null) , nunca antes
 * de confirmar que o R2 tem o objeto.
 *
 * Se todas as tentativas do BullMQ se esgotarem, o XML simplesmente
 * continua no Postgres pra sempre (comportamento idêntico a nunca ter
 * migrado pro R2) , não é um estado de erro visível pro usuário.
 */
@Processor(FILA_ARMAZENAMENTO_DOCUMENTOS_CARGA)
export class DocumentoCargaStorageProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentoCargaStorageProcessor.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<JobRetentarUploadR2>): Promise<void> {
    const { documentoId, chave, conteudoBase64 } = job.data;
    const buffer = Buffer.from(conteudoBase64, 'base64');

    await this.storage.subirObjeto(chave, buffer, 'application/xml');

    // Só libera o Postgres depois que o R2 confirmou o objeto , evita
    // qualquer janela em que o documento não tenha o XML em lugar nenhum.
    await this.prisma.documentoCarga.update({
      where: { id: documentoId },
      data: { xmlStorageKey: chave, xmlOriginal: null },
    });

    this.logger.log(
      `Documento ${documentoId}: XML migrado pro R2 via retry em segundo plano (chave ${chave}).`,
    );
  }
}
