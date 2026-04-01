import { ApiProperty } from '@nestjs/swagger';

class QueueCountsDto {
  @ApiProperty({ example: 0 })
  waiting: number;

  @ApiProperty({ example: 1 })
  active: number;

  @ApiProperty({ example: 42 })
  completed: number;

  @ApiProperty({ example: 2 })
  failed: number;

  @ApiProperty({ example: 0 })
  delayed: number;
}

class DlqCountsDto {
  @ApiProperty({ example: 1 })
  waiting: number;

  @ApiProperty({ example: 0 })
  active: number;

  @ApiProperty({ example: 0 })
  completed: number;

  @ApiProperty({ example: 0 })
  failed: number;
}

class DlqDto {
  @ApiProperty({ example: 'orders-enrichment-dlq' })
  queue: string;

  @ApiProperty({ type: DlqCountsDto })
  counts: DlqCountsDto;
}

export class QueueMetricsDto {
  @ApiProperty({ example: 'orders-enrichment' })
  queue: string;

  @ApiProperty({ example: false })
  isPaused: boolean;

  @ApiProperty({ type: QueueCountsDto })
  counts: QueueCountsDto;

  @ApiProperty({ type: DlqDto })
  dlq: DlqDto;

  @ApiProperty({ example: '2026-03-31T12:00:00.000Z' })
  fetchedAt: string;
}
