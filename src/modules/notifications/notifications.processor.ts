import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { NOTIFICATIONS_QUEUE } from './notifications.service';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    // Expo push notifications — see §2 (EXPO_ACCESS_TOKEN) and §5.
  }
}
