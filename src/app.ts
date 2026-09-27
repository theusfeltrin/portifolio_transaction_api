import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { Redis } from 'ioredis';
import { SupabaseClient } from '@supabase/supabase-js';

import { logger } from './config/logger';
import { swaggerSpec } from './docs/swagger';
import { apiKeyAuth } from './middlewares/auth';
import { rateLimiter } from './middlewares/rateLimiter';
import { idempotency } from './middlewares/idempotency';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { transactionsRouter } from './routes/transactions.routes';
import { TransactionsController } from './controllers/transactions.controller';
import { TransactionsService } from './services/transactions.service';
import { TransactionsRepository } from './repositories/transactions.repository';

export function createApp(deps: { redis: Redis; supabase: SupabaseClient }): Express {
  const { redis, supabase } = deps;
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: process.env.NODE_ENV !== 'test' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

  // Injeção de dependências manual (sem framework de DI para manter o projeto enxuto).
  const repository = new TransactionsRepository(supabase);
  const service = new TransactionsService(repository);
  const controller = new TransactionsController(service);

  app.use(
    '/api/v1/transactions',
    apiKeyAuth,
    rateLimiter(redis),
    idempotency(redis),
    transactionsRouter(controller)
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
