import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: ['warn', 'error'] });
  }

  /**
   * Connect eagerly so a bad DATABASE_URL surfaces at boot rather than on the first
   * request. A failure here is logged but NOT rethrown: the pod must still come up
   * and serve /api/health (liveness) so Kubernetes reports "unready", not
   * "crash-looping", while Postgres finishes starting.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (error) {
      this.logger.error(
        'Prisma failed to connect at startup; readiness will report down until the database is reachable',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
