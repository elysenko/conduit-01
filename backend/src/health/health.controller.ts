import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Deliberately touches nothing — no DB, no outbound HTTP.
   * A liveness probe coupled to Postgres turns a brief DB blip into a pod
   * restart loop, which is strictly worse than serving 503s from readiness.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe (no dependencies)' })
  live(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness. Proves the connection pool can actually round-trip a query. */
  @Get('deep')
  @ApiOperation({ summary: 'Readiness probe (executes SELECT 1)' })
  async deep(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.error('Readiness check failed', error instanceof Error ? error.stack : error);
      // 503, never 500: this is a dependency outage, not a bug in the handler.
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}
