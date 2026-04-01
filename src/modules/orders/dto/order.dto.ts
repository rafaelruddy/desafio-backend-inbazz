import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CustomerDto {
  @ApiProperty({ example: 'c1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6' })
  id: string;

  @ApiProperty({ example: 'ana@example.com' })
  email: string;

  @ApiProperty({ example: 'Ana' })
  name: string;
}

class AddressDto {
  @ApiProperty({ example: '01001-000' })
  cep: string;

  @ApiProperty({ example: '100' })
  number: string;

  @ApiPropertyOptional({ example: 'apto 42' })
  complement?: string;

  @ApiPropertyOptional({ example: 'Praça da Sé' })
  street?: string;

  @ApiPropertyOptional({ example: 'Sé' })
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  state?: string;
}

class OrderItemDto {
  @ApiProperty({ example: 'ABC123' })
  sku: string;

  @ApiProperty({ example: 2 })
  qty: number;

  @ApiProperty({ example: 59.9 })
  unitPrice: number;
}

class ConvertedTotalDto {
  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ example: 299.5 })
  amount: number;
}

export class OrderDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'ext-123' })
  externalId: string;

  @ApiProperty({ example: 'uuid-or-hash' })
  idempotencyKey: string;

  @ApiProperty({ enum: ['RECEIVED', 'PROCESSING', 'ENRICHED', 'FAILED_ENRICHMENT'], example: 'ENRICHED' })
  status: string;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: 119.8 })
  totalAmount: number;

  @ApiProperty({ type: CustomerDto })
  customer: CustomerDto;

  @ApiPropertyOptional({ type: AddressDto })
  address?: AddressDto;

  @ApiProperty({ type: [OrderItemDto] })
  items: OrderItemDto[];

  @ApiProperty({ type: [ConvertedTotalDto] })
  convertedTotals: ConvertedTotalDto[];

  @ApiPropertyOptional({ example: '2026-03-31T12:00:00.000Z' })
  enrichedAt?: string;

  @ApiPropertyOptional({ example: 'exchange-rate-api + viacep' })
  enrichedBy?: string;

  @ApiProperty({ example: 0 })
  retryCount: number;

  @ApiPropertyOptional({ example: null })
  failureReason?: string;

  @ApiProperty({ example: '2026-03-31T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-31T12:00:00.000Z' })
  updatedAt: string;
}
