import { Injectable } from '@nestjs/common';
import { PrismaOrderRepository } from '../../infrastructure/repositories/orders.repository';
import { OrderFilterDto } from './dto/order-filter.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: PrismaOrderRepository) {}

  findAll(filter: OrderFilterDto) {
    return this.orderRepository.findAll({ status: filter.status });
  }

  findOne(id: string) {
    return this.orderRepository.findById(id);
  }
}
