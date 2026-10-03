import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobRetentarUploadR2 } from './documento-carga-storage.queue';
export declare class DocumentoCargaStorageProcessor extends WorkerHost {
    private readonly storage;
    private readonly prisma;
    private readonly logger;
    constructor(storage: StorageService, prisma: PrismaService);
    process(job: Job<JobRetentarUploadR2>): Promise<void>;
}
