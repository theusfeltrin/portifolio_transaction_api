import { NextFunction, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { env } from '../config/env';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  /** Função para derivar a chave de identificação do cliente (IP, API key, etc). */
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiter baseado em "sliding window log", implementado com um
 * Redis Sorted Set por cliente:
 *  - cada requisição é registrada com score = timestamp (ms)
 *  - a cada chamada, removemos entradas fora da janela
 *  - se o total de entradas na janela ultrapassar o limite, a requisição é bloqueada
 *
 * Mais preciso que "fixed window counter" (evita bursts na borda da janela)
 * e continua O(log N) por operação graças ao sorted set do Redis.
 */
export function rateLimiter(redis: Redis, options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? env.RATE_LIMIT_MAX_REQUESTS;
  const keyGenerator =
    options.keyGenerator ?? ((req: Request) => (req.header('x-api-key') || req.ip || 'anonymous'));

  return async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
    const identifier = keyGenerator(req);
    const redisKey = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const pipeline = redis.multi();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      pipeline.zcard(redisKey);
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();
      const requestCount = (results?.[2]?.[1] as number) ?? 0;

      const remaining = Math.max(0, maxRequests - requestCount);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

      if (requestCount > maxRequests) {
        const retryAfterSeconds = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Limite de ${maxRequests} requisições por ${windowMs / 1000}s excedido.`,
          retryAfter: retryAfterSeconds
        });
      }

      return next();
    } catch (err) {
      // Falha no Redis não deve derrubar a API: loga e segue (fail-open).
      req.log?.error({ err }, 'Falha ao aplicar rate limit');
      return next();
    }
  };
}
