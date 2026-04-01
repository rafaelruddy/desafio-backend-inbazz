import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { QueueMetricsDto } from './dto/queue-metrics.dto';

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas da fila de processamento' })
  @ApiResponse({ status: 200, description: 'Métricas retornadas', type: QueueMetricsDto })
  getMetrics(): Promise<QueueMetricsDto> {
    return this.queueService.getMetrics();
  }
}
