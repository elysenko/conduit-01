import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Every route lives under /api so nginx can proxy a single prefix to this service.
  // Swagger is mounted at an absolute path below and is unaffected by this.
  app.setGlobalPrefix('api');

  // The SPA is served from a separate nginx container, so its origin is not known
  // here. Reflecting the request origin is the only workable setting; there are no
  // cookie-based sessions to protect — auth is a bearer token the client must
  // attach deliberately, so CSRF is not in play.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist strips undeclared properties: this is what stops a registration
      // payload carrying `role: "ADMIN"` from ever reaching the persistence layer.
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Conduit API')
    .setDescription('RealWorld-shaped blogging API — NestJS + Prisma')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // 3001 matches colossus.yaml's `backend.port`, which the deploy agent wires the
  // Service and probes to. Overridable via PORT for local runs.
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`Conduit API listening on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger UI at http://0.0.0.0:${port}/api/docs`);
}

void bootstrap();
