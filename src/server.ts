import { env } from './config/env';
import { redis } from './config/redis';
import { supabase } from './config/supabase';
import { logger } from './config/logger';
import { createApp } from './app';

const app = createApp({ redis, supabase });

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Transactions API rodando na porta ${env.PORT} (${env.NODE_ENV})`);
  logger.info(`📚 Swagger disponível em http://localhost:${env.PORT}/docs`);
});

function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando graciosamente...`);
  server.close(() => {
    redis.disconnect();
    logger.info('Servidor encerrado.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
