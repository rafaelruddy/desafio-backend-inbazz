import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('orders-enrichment') private readonly queue: Queue,
    @InjectQueue('orders-enrichment-dlq') private readonly dlq: Queue,
  ) {}

  async getMetrics() {
    const [mainCounts, dlqCounts, isPaused] = await Promise.all([
      this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.dlq.getJobCounts('waiting', 'active', 'completed', 'failed'),
      this.queue.isPaused(),
    ]);

    return {
      queue: 'orders-enrichment',
      isPaused,
      counts: mainCounts as any,
      dlq: { queue: 'orders-enrichment-dlq', counts: dlqCounts as any },
      fetchedAt: new Date().toISOString(),
    };
  }
}
