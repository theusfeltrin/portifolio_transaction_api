import express from 'express';
import request from 'supertest';
import { userContext } from '../../src/middlewares/userContext';

function buildApp() {
  const app = express();
  app.use(userContext);
  app.get('/whoami', (req, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('userContext middleware', () => {
  it('retorna 400 quando o header x-user-id não é enviado', async () => {
    const res = await request(buildApp()).get('/whoami');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_USER_ID');
  });

  it('retorna 400 quando o header x-user-id não é um UUID', async () => {
    const res = await request(buildApp()).get('/whoami').set('x-user-id', 'nao-e-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_USER_ID');
  });

  it('expõe o UUID normalizado em req.userId', async () => {
    const res = await request(buildApp())
      .get('/whoami')
      .set('x-user-id', '9B2F6C1E-7D3A-4C5B-8E9F-0A1B2C3D4E5F');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('9b2f6c1e-7d3a-4c5b-8e9f-0a1b2c3d4e5f');
  });
});
