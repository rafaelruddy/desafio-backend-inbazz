import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderInput, EnrichmentResult } from '../../common/order.types';

const includeAll = {
  customer: true,
  address: true,
  items: true,
  convertedTotals: true,
} as const;

@Injectable()
export class PrismaOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(id: string, input: CreateOrderInput) {
    return this.prisma.order.create({
      data: {
        id,
        externalId: input.externalId,
        idempotencyKey: input.idempotencyKey,
        currency: input.currency,
        totalAmount: input.totalAmount,
        customer: {
          connectOrCreate: {
            where: { email: input.customerEmail },
            create: {
              email: input.customerEmail,
              name: input.customerName,
            },
          },
        },
        address: {
          create: {
            cep: input.address.cep,
            number: input.address.number,
            complement: input.address.complement,
          },
        },
        items: {
          create: input.items.map((item) => ({
            sku: item.sku,
            qty: item.qty,
            unitPrice: item.unit_price,
          })),
        },
      },
      include: includeAll,
    });
  }

  findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: includeAll,
    });
  }

  findAll({ status }: { status?: OrderStatus }) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: includeAll,
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    extra?: {
      enrichmentResult?: EnrichmentResult;
      retryCount?: number;
      failureReason?: string;
    },
  ) {
    const enrichment = extra?.enrichmentResult;

    await this.prisma.order.update({
      where: { id },
      data: {
        status,
        retryCount: extra?.retryCount,
        failureReason: extra?.failureReason,
        ...(enrichment && {
          enrichedAt: enrichment.enrichedAt,
          enrichedBy: enrichment.enrichedBy,
          address: {
            update: {
              street: enrichment.address.street,
              neighborhood: enrichment.address.neighborhood,
              city: enrichment.address.city,
              state: enrichment.address.state,
            },
          },
          convertedTotals: {
            create: enrichment.convertedTotals.map((ct) => ({
              currency: ct.currency,
              amount: ct.amount,
            })),
          },
        }),
      },
    });
  }
}
