import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectQueue('orders-enrichment')
    private readonly queue: Queue,
  ) {}

  async receive(dto: CreateOrderDto) {
    const orderId = randomUUID();

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.qty * item.unit_price,
      0,
    );

    const job = await this.queue.add(
      'process-order',
      {
        orderId,
        externalId: dto.order_id,
        idempotencyKey: dto.idempotency_key,
        customerEmail: dto.customer.email,
        customerName: dto.customer.name,
        address: dto.address,
        items: dto.items,
        currency: dto.currency,
        totalAmount,
      },
      {
        jobId: dto.idempotency_key,
        attempts: 4,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );

    if (job) {
      this.logger.log(`Order ${orderId} enqueued`);
      return { status: 'received', orderId };
    }

    const existing = await this.queue.getJob(dto.idempotency_key);
    this.logger.log(`Idempotent request for key ${dto.idempotency_key}`);
    return { status: 'already_received', orderId: existing?.data?.orderId };
  }
}
