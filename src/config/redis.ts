import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: env.NODE_ENV === 'test'
});

redis.on('error', (err) => {
  logger.error({ err }, 'Erro na conexão com o Redis');
});

redis.on('connect', () => {
  logger.info('Conectado ao Redis');
});
