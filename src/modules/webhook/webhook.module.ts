import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'orders-enrichment' })],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
