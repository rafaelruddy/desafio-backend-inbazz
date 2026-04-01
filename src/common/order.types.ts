export interface OrderItemInput {
  sku: string;
  qty: number;
  unit_price: number;
}

export interface AddressInput {
  cep: string;
  number: string;
  complement?: string;
}

export interface CreateOrderInput {
  externalId: string;
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  address: AddressInput;
  items: OrderItemInput[];
  currency: string;
  totalAmount: number;
}

export interface OrderJobData extends CreateOrderInput {
  orderId: string;
}

export interface EnrichmentResult {
  convertedTotals: { currency: string; amount: number }[];
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  enrichedAt: Date;
  enrichedBy: string;
}
