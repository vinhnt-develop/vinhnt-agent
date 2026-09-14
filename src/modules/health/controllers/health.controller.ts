import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { HealthCheckResponseDto, LivenessResponseDto, ReadinessResponseDto } from '../dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthCheckResponseDto })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(): Promise<HealthCheckResponseDto> {
    const dbOk = await this.checkDatabase();

    return {
      status: dbOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      database: dbOk ? 'connected' : 'disconnected',
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive', type: LivenessResponseDto })
  alive(): LivenessResponseDto {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready', type: ReadinessResponseDto })
  async ready(): Promise<ReadinessResponseDto> {
    const dbOk = await this.checkDatabase();
    if (!dbOk) throw new Error('Database not connected');
    return { status: 'ok' };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      this.db.all('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
