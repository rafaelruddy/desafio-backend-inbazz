import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/infrastructure/redis/redis.module';

const AUTH_HEADER = `Bearer ${process.env.WEBHOOK_SECRET || 'meu-token-secreto'}`;

const makePayload = (overrides: Record<string, any> = {}) => ({
  order_id: `ext-e2e-${Date.now()}`,
  customer: { email: 'e2e@test.com', name: 'E2E User' },
  address: { cep: '01001-000', number: '100' },
  items: [{ sku: 'SKU-E2E', qty: 2, unit_price: 50.0 }],
  currency: 'USD',
  idempotency_key: `idem-e2e-${Date.now()}`,
  ...overrides,
});

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Autenticação ──────────────────────────────────────────

  describe('POST /webhooks/orders — autenticação', () => {
    it('401 quando não envia token', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .send(makePayload())
        .expect(401);
    });

    it('401 quando token é inválido', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', 'Bearer token-errado')
        .send(makePayload())
        .expect(401);
    });

    it('401 quando formato não é Bearer', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', 'Basic meu-token-secreto')
        .send(makePayload())
        .expect(401);
    });
  });

  // ─── Validação de Payload ──────────────────────────────────

  describe('POST /webhooks/orders — validação', () => {
    it('400 quando payload está vazio', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send({})
        .expect(400);
    });

    it('400 quando email é inválido', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ customer: { email: 'invalid', name: 'Test' } }))
        .expect(400);
    });

    it('400 quando items está vazio', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ items: [] }))
        .expect(400);
    });

    it('400 quando currency não tem 3 letras', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ currency: 'US' }))
        .expect(400);
    });

    it('400 quando CEP é inválido', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ address: { cep: '123', number: '1' } }))
        .expect(400);
    });

    it('aceita payload com complement opcional', () => {
      return request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(
          makePayload({
            address: { cep: '01001-000', number: '1', complement: 'apto 42' },
            idempotency_key: `idem-complement-${Date.now()}`,
          }),
        )
        .expect(202);
    });
  });

  // ─── Fluxo Completo: Webhook → Fila → Enriquecimento ──────

  describe('POST /webhooks/orders — fluxo completo', () => {
    let orderId: string;
    let idempotencyKey: string;

    it('202 e retorna orderId ao receber pedido válido', async () => {
      idempotencyKey = `idem-flow-${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ idempotency_key: idempotencyKey }))
        .expect(202);

      expect(res.body).toEqual({
        status: 'received',
        orderId: expect.any(String),
      });

      orderId = res.body.orderId;
    });

    it('retorna mesma resposta para idempotency_key duplicada', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/orders')
        .set('Authorization', AUTH_HEADER)
        .send(makePayload({ idempotency_key: idempotencyKey }))
        .expect(202);

      expect(res.body.orderId).toBe(orderId);
    });

    it('pedido é persistido e enriquecido após processamento', async () => {
      // Aguarda o processor consumir o job e enriquecer
      await waitForStatus(prisma, orderId, 'ENRICHED', 15000);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          address: true,
          items: true,
          convertedTotals: true,
        },
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('ENRICHED');
      expect(order.customer.email).toBe('e2e@test.com');
      expect(order.items).toHaveLength(1);
      expect(Number(order.totalAmount)).toBe(100);

      // Endereço enriquecido pelo ViaCEP
      expect(order.address.street).toBeDefined();
      expect(order.address.city).toBeDefined();
      expect(order.address.state).toBeDefined();

      // Conversão de moedas
      expect(order.convertedTotals.length).toBeGreaterThan(0);
      expect(order.enrichedBy).toContain('exchangerate-api.com');
      expect(order.enrichedBy).toContain('viacep.com.br');
    });
  });

  // ─── GET /orders ───────────────────────────────────────────

  describe('GET /orders', () => {
    it('retorna lista de pedidos', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('filtra por status ENRICHED', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders?status=ENRICHED')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      for (const order of res.body) {
        expect(order.status).toBe('ENRICHED');
      }
    });

    it('retorna lista vazia para status sem resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders?status=FAILED_ENRICHMENT')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('400 quando status é inválido', () => {
      return request(app.getHttpServer())
        .get('/orders?status=INVALID')
        .expect(400);
    });
  });

  // ─── GET /orders/:id ──────────────────────────────────────

  describe('GET /orders/:id', () => {
    it('retorna detalhes do pedido com relacionamentos', async () => {
      const orders = await prisma.order.findMany({ take: 1 });
      const id = orders[0].id;

      const res = await request(app.getHttpServer())
        .get(`/orders/${id}`)
        .expect(200);

      expect(res.body.id).toBe(id);
      expect(res.body).toHaveProperty('customer');
      expect(res.body).toHaveProperty('address');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('convertedTotals');
    });

    it('404 quando pedido não existe', () => {
      return request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('400 quando id não é UUID', () => {
      return request(app.getHttpServer())
        .get('/orders/not-a-uuid')
        .expect(400);
    });
  });

  // ─── GET /queue/metrics ───────────────────────────────────

  describe('GET /queue/metrics', () => {
    it('retorna métricas da fila principal e DLQ', async () => {
      const res = await request(app.getHttpServer())
        .get('/queue/metrics')
        .expect(200);

      expect(res.body).toHaveProperty('queue', 'orders-enrichment');
      expect(res.body).toHaveProperty('counts');
      expect(res.body.counts).toHaveProperty('waiting');
      expect(res.body.counts).toHaveProperty('active');
      expect(res.body.counts).toHaveProperty('completed');
      expect(res.body.counts).toHaveProperty('failed');
      expect(res.body).toHaveProperty('dlq');
      expect(res.body.dlq).toHaveProperty('queue', 'orders-enrichment-dlq');
      expect(res.body).toHaveProperty('fetchedAt');
    });
  });
});

// ─── Helpers ───────────────────────────────────────────────

async function waitForStatus(
  prisma: PrismaService,
  orderId: string,
  targetStatus: string,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < timeoutMs) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order?.status === targetStatus) return;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `Order ${orderId} did not reach status ${targetStatus} within ${timeoutMs}ms`,
  );
}
