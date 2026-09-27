import express from 'express';
import request from 'supertest';
import RedisMock from 'ioredis-mock';
import { rateLimiter } from '../../src/middlewares/rateLimiter';

type MockRedis = InstanceType<typeof RedisMock>;

function buildApp(redis: MockRedis, maxRequests: number, windowMs: number) {
  const app = express();
  app.use(rateLimiter(redis, { maxRequests, windowMs, keyGenerator: () => 'fixed-client' }));
  app.get('/ping', (_req, res) => res.status(200).json({ pong: true }));
  return app;
}

describe('rate limiter middleware', () => {
  let redis: MockRedis;

  beforeEach(async () => {
    redis = new RedisMock();
    // ioredis-mock compartilha o mesmo store em memória entre instâncias por padrão;
    // limpamos explicitamente para garantir isolamento entre os testes.
    await redis.flushall();
  });

  it('permite requisições dentro do limite', async () => {
    const app = buildApp(redis, 3, 60_000);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  });

  it('bloqueia com 429 ao exceder o limite dentro da janela', async () => {
    const app = buildApp(redis, 2, 60_000);

    await request(app).get('/ping');
    await request(app).get('/ping');
    const blocked = await request(app).get('/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('inclui os headers X-RateLimit-* na resposta', async () => {
    const app = buildApp(redis, 5, 60_000);

    const res = await request(app).get('/ping');

    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('libera novamente após a janela expirar', async () => {
    const app = buildApp(redis, 1, 200); // janela curta para o teste

    const first = await request(app).get('/ping');
    const secondBlocked = await request(app).get('/ping');

    await new Promise((r) => setTimeout(r, 250));

    const afterWindow = await request(app).get('/ping');

    expect(first.status).toBe(200);
    expect(secondBlocked.status).toBe(429);
    expect(afterWindow.status).toBe(200);
  });
});
