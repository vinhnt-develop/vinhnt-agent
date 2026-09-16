import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class HealthCheckResponseDto {
  @ApiProperty({ name: 'status', type: String, description: 'Health status', enum: ['ok', 'error'], example: 'ok' })
  @Expose({ name: 'status' })
  status!: 'ok' | 'error';

  @ApiProperty({ name: 'timestamp', type: String, description: 'Timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'timestamp' })
  timestamp!: string;

  @ApiProperty({ name: 'uptime', type: Number, description: 'Uptime in seconds', example: 3600 })
  @Expose({ name: 'uptime' })
  uptime!: number;

  @ApiProperty({ name: 'version', type: String, description: 'Version', example: '1.0.0' })
  @Expose({ name: 'version' })
  version!: string;

  @ApiProperty({ name: 'database', type: String, description: 'Database status', enum: ['connected', 'disconnected'], example: 'connected' })
  @Expose({ name: 'database' })
  database!: 'connected' | 'disconnected';

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class LivenessResponseDto {
  @ApiProperty({ name: 'status', type: String, description: 'Status', example: 'ok' })
  @Expose({ name: 'status' })
  status!: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ name: 'status', type: String, description: 'Status', example: 'ok' })
  @Expose({ name: 'status' })
  status!: string;
}
