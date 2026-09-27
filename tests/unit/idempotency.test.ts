import express from 'express';
import request from 'supertest';
import RedisMock from 'ioredis-mock';
import { idempotency } from '../../src/middlewares/idempotency';

type MockRedis = InstanceType<typeof RedisMock>;

function buildApp(redis: MockRedis, handlerDelayMs = 0) {
  const app = express();
  app.use(express.json());
  app.use(idempotency(redis));

  let callCount = 0;
  app.post('/charge', async (req, res) => {
    callCount += 1;
    if (handlerDelayMs) await new Promise((r) => setTimeout(r, handlerDelayMs));
    res.status(201).json({ id: `charge-${callCount}`, amount: req.body.amount, calls: callCount });
  });

  return { app, getCallCount: () => callCount };
}

describe('idempotency middleware', () => {
  let redis: MockRedis;

  beforeEach(async () => {
    redis = new RedisMock();
    // ioredis-mock compartilha o mesmo store em memória entre instâncias por padrão;
    // limpamos explicitamente para garantir isolamento entre os testes.
    await redis.flushall();
  });

  it('processa normalmente quando nenhuma Idempotency-Key é enviada', async () => {
    const { app } = buildApp(redis);

    const res1 = await request(app).post('/charge').send({ amount: 100 });
    const res2 = await request(app).post('/charge').send({ amount: 100 });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).not.toBe(res2.body.id); // sem idempotência, cada chamada é um novo efeito
  });

  it('retorna a mesma resposta (replay) para requisições repetidas com a mesma chave e mesmo corpo', async () => {
    const { app, getCallCount } = buildApp(redis);
    const key = 'idem-key-123';

    const res1 = await request(app).post('/charge').set('Idempotency-Key', key).send({ amount: 100 });
    const res2 = await request(app).post('/charge').set('Idempotency-Key', key).send({ amount: 100 });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res2.body).toEqual(res1.body);
    expect(res2.headers['idempotent-replay']).toBe('true');
    expect(getCallCount()).toBe(1); // o handler de negócio só rodou uma vez
  });

  it('retorna 422 quando a mesma chave é reutilizada com um corpo diferente', async () => {
    const { app } = buildApp(redis);
    const key = 'idem-key-456';

    const res1 = await request(app).post('/charge').set('Idempotency-Key', key).send({ amount: 100 });
    const res2 = await request(app).post('/charge').set('Idempotency-Key', key).send({ amount: 999 });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(422);
    expect(res2.body.error).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('retorna 409 para requisições concorrentes com a mesma chave ainda em processamento', async () => {
    const { app } = buildApp(redis, 50); // handler lento simula processamento em andamento
    const key = 'idem-key-concurrent';

    const [res1, res2] = await Promise.all([
      request(app).post('/charge').set('Idempotency-Key', key).send({ amount: 100 }),
      new Promise<request.Response>((resolve) =>
        setTimeout(
          () =>
            request(app)
              .post('/charge')
              .set('Idempotency-Key', key)
              .send({ amount: 100 })
              .then(resolve),
          10
        )
      )
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('IDEMPOTENT_REQUEST_IN_PROGRESS');
  });
});
