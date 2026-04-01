import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'orders-enrichment' },
      { name: 'orders-enrichment-dlq' },
    ),
  ],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
