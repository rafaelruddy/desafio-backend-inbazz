import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';

import { WebhookService } from './webhook.service';

const makeDto = (overrides = {}) => ({
  order_id: 'ext-001',
  customer: { email: 'ana@example.com', name: 'Ana' },
  address: { cep: '01001-000', number: '100' },
  items: [{ sku: 'SKU1', qty: 2, unit_price: 59.9 }],
  currency: 'USD',
  idempotency_key: 'idem-001',
  ...overrides,
});

describe('WebhookService', () => {
  let service: WebhookService;
  let queue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn(), getJob: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getQueueToken('orders-enrichment'), useValue: queue },
      ],
    }).compile();

    service = module.get(WebhookService);
  });

  describe('quando é um pedido novo', () => {
    it('enfileira com jobId igual à idempotency_key', async () => {
      queue.add.mockResolvedValue({ id: 'idem-001' });

      const result = await service.receive(makeDto());

      expect(queue.add).toHaveBeenCalledWith(
        'process-order',
        expect.objectContaining({
          orderId: expect.any(String),
          externalId: 'ext-001',
          customerEmail: 'ana@example.com',
          totalAmount: 119.8,
          currency: 'USD',
        }),
        expect.objectContaining({
          jobId: 'idem-001',
          attempts: 4,
        }),
      );
      expect(result).toEqual({
        status: 'received',
        orderId: expect.any(String),
      });
    });

    it('calcula o total corretamente', async () => {
      queue.add.mockResolvedValue({ id: 'idem-001' });
      const dto = makeDto({
        items: [
          { sku: 'A', qty: 2, unit_price: 50 },
          { sku: 'B', qty: 1, unit_price: 30 },
        ],
      });

      await service.receive(dto);

      expect(queue.add).toHaveBeenCalledWith(
        'process-order',
        expect.objectContaining({ totalAmount: 130 }),
        expect.any(Object),
      );
    });
  });

  describe('quando a idempotency_key já existe', () => {
    it('retorna already_received sem criar job duplicado', async () => {
      queue.add.mockResolvedValue(undefined);
      queue.getJob.mockResolvedValue({ data: { orderId: 'existing-uuid' } });

      const result = await service.receive(makeDto());

      expect(queue.getJob).toHaveBeenCalledWith('idem-001');
      expect(result).toEqual({
        status: 'already_received',
        orderId: 'existing-uuid',
      });
    });
  });
});
