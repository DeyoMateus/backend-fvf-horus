import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import type { JobNotificacaoPush } from './push-notifications.service';
export declare class PushNotificationsProcessor extends WorkerHost {
    private readonly logger;
    process(job: Job<JobNotificacaoPush>): Promise<void>;
}
