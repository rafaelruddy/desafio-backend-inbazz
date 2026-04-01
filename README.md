# Orquestrador de Pedidos - Desafio Backend

API para recebimento, enfileiramento e enriquecimento assíncrono de pedidos via webhook, construída com **NestJS**, **BullMQ**, **Prisma** e **Redis**.

## Arquitetura

<p align="center">
  <img src="docs/architecture.png" alt="Arquitetura do sistema" width="100%" />
</p>

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 10 |
| Linguagem | TypeScript 5 |
| Banco de dados | PostgreSQL 16 |
| ORM | Prisma 5 |
| Fila | BullMQ + Redis 7 |
| Idempotência | BullMQ (jobId = idempotency_key) |
| Integrações | [Exchange Rate API](https://www.exchangerate-api.com/), [ViaCEP](https://viacep.com.br/) |
| Documentação | Swagger / OpenAPI |
| Containerização | Docker + Docker Compose |

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)
- Ou, para rodar localmente: Node.js 20+, PostgreSQL 16 e Redis 7

## Como rodar

### Com Docker (recomendado)

```bash
docker compose up --build
```

A aplicação estará disponível em `http://localhost:3000`.
A documentação Swagger estará em `http://localhost:3000/api/docs`.

### Localmente

```bash
# Instalar dependências
npm install

# Subir banco e Redis (ou use instâncias já existentes)
docker compose up -d postgres redis

# Configurar variáveis de ambiente
cp .env.example .env   # ajuste conforme necessário

# Rodar migrations
npx prisma migrate deploy

# Iniciar em modo dev
npm run start:dev
```

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://orders:orders@localhost:5432/orders_db?schema=public` |
| `REDIS_URL` | Connection string Redis | `redis://localhost:6379` |
| `EXCHANGE_API_URL` | URL base da API de câmbio | `https://api.exchangerate-api.com/v4/latest` |
| `TARGET_CURRENCIES` | Moedas-alvo para conversão (separadas por vírgula) | `BRL,EUR` |

## Documentação da API (Swagger)

A documentação interativa da API está disponível em `/api/docs` (Swagger UI).

Todos os endpoints possuem DTOs de request e response documentados com exemplos.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/webhooks/orders` | Receber pedido via webhook |
| `GET` | `/orders` | Listar pedidos (filtro opcional por status) |
| `GET` | `/orders/:id` | Detalhes de um pedido |
| `GET` | `/queue/metrics` | Métricas da fila de processamento |

### Receber pedido (Webhook)

```
POST /webhooks/orders
```

```json
{
  "order_id": "ext-123",
  "customer": { "email": "user@example.com", "name": "Ana" },
  "address": { "cep": "01001-000", "number": "100", "complement": "apto 42" },
  "items": [{ "sku": "ABC123", "qty": 2, "unit_price": 59.9 }],
  "currency": "USD",
  "idempotency_key": "uuid-or-hash"
}
```

**Resposta (202):**
```json
{
  "status": "received",
  "orderId": "uuid-gerado"
}
```

Se o `idempotency_key` já foi processado:
```json
{
  "status": "already_received",
  "orderId": "uuid-existente"
}
```

### Listar pedidos

```
GET /orders?status=ENRICHED
```

Status possíveis: `RECEIVED`, `PROCESSING`, `ENRICHED`, `FAILED_ENRICHMENT`

### Detalhes de um pedido

```
GET /orders/:id
```

### Métricas da fila

```
GET /queue/metrics
```

```json
{
  "queue": "orders-enrichment",
  "isPaused": false,
  "counts": {
    "waiting": 0,
    "active": 1,
    "completed": 42,
    "failed": 2,
    "delayed": 0
  },
  "dlq": {
    "queue": "orders-enrichment-dlq",
    "counts": { "waiting": 1, "active": 0, "completed": 0, "failed": 0 }
  },
  "fetchedAt": "2026-03-31T12:00:00.000Z"
}
```

## Fluxo de processamento

1. **Recebimento** — `POST /webhooks/orders` valida o payload, gera o UUID do pedido e enfileira o job usando a `idempotency_key` como `jobId` do BullMQ (duplicatas são rejeitadas automaticamente). Retorna `202` sem tocar no banco.
2. **Persistência** — O processor consome o job e persiste o pedido no banco com status `RECEIVED`.
3. **Enriquecimento** — Em paralelo, consulta a Exchange Rate API (conversão de moedas) e a ViaCEP (dados do endereço). Atualiza o pedido com os dados obtidos.
4. **Sucesso** — Status atualizado para `ENRICHED`, totais convertidos e endereço completo salvos no banco.
5. **Falha** — BullMQ faz retry automático com backoff exponencial (até 4 tentativas). Se todas falharem, o job vai para a DLQ e o status é atualizado para `FAILED_ENRICHMENT`.

## Modelo de dados

```
Customer (customers)
├── id, email (unique), name
│
└── Order (orders)                           [1:N]
    ├── id, externalId, idempotencyKey, status
    ├── currency, totalAmount
    ├── enrichedAt, enrichedBy
    ├── retryCount, failureReason
    │
    ├── Address (addresses)                  [1:1]
    │   ├── cep, number, complement
    │   └── street, neighborhood, city, state  ← preenchidos pelo ViaCEP
    │
    ├── OrderItem (order_items)              [1:N]
    │   └── sku, qty, unitPrice
    │
    └── ConvertedTotal (converted_totals)    [1:N]
        └── currency, amount                   ← preenchidos pela Exchange Rate API
```

## Testes

```bash
# Testes unitários
npm run test

# Cobertura
npm run test:cov

# Testes e2e
npm run test:e2e
```

Os testes unitários cobrem:
- **WebhookService** — idempotência via BullMQ jobId, cálculo do total, enfileiramento do payload completo
- **EnrichmentProcessor** — persistência, orquestração das integrações, transições de status, retry sem re-persistir, DLQ no esgotamento de tentativas

## Estrutura do projeto

```
src/
├── common/
│   ├── filters/                 # Filtro global de exceções HTTP
│   └── order.types.ts           # Tipos compartilhados
├── infrastructure/
│   ├── prisma/                  # Serviço e módulo do Prisma
│   ├── repositories/            # PrismaOrderRepository
├── integrations/
│   ├── exchange-rate/           # Módulo de conversão de moedas
│   └── viacep/                  # Módulo de consulta de CEP
└── modules/
    ├── webhook/                 # Recebimento de pedidos (POST /webhooks/orders)
    ├── orders/                  # Consulta de pedidos (GET /orders)
    ├── enrichment/              # Processor da fila (BullMQ)
    └── queue/                   # Métricas da fila (GET /queue/metrics)
```
