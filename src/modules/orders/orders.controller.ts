import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrderFilterDto } from './dto/order-filter.dto';
import { OrderDto } from './dto/order.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pedidos' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['RECEIVED', 'PROCESSING', 'ENRICHED', 'FAILED_ENRICHMENT'],
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos',
    type: [OrderDto],
  })
  findAll(@Query() filter: OrderFilterDto) {
    return this.ordersService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um pedido' })
  @ApiParam({ name: 'id', description: 'UUID do pedido' })
  @ApiResponse({
    status: 200,
    description: 'Pedido encontrado',
    type: OrderDto,
  })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findOne(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }
}
