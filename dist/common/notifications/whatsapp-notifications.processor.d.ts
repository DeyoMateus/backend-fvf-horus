import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import type { JobNotificacaoWhatsapp } from './whatsapp-notifications.service';
export declare class WhatsappNotificationsProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<JobNotificacaoWhatsapp>): Promise<void>;
}
