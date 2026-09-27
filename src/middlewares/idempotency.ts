import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { env } from '../config/env';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const LOCK_TTL_SECONDS = 30; // tempo máximo que consideramos uma requisição "em andamento"

interface StoredResponse {
  status: 'IN_PROGRESS' | 'COMPLETED';
  statusCode?: number;
  body?: unknown;
  requestHash: string;
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

function keyFor(idempotencyKey: string): string {
  return `idempotency:${idempotencyKey}`;
}

/**
 * Garante que requisições repetidas com o mesmo header `Idempotency-Key`
 * (ex.: retries de cliente após timeout) produzam exatamente UM efeito colateral.
 *
 * Fluxo:
 *  1. Cliente não envia o header -> segue normalmente, sem garantias de idempotência.
 *  2. Chave nunca vista -> grava um "lock" (IN_PROGRESS) e deixa a requisição prosseguir.
 *     Ao final, intercepta res.json/res.send e persiste a resposta final com TTL.
 *  3. Chave já COMPLETED -> retorna a resposta armazenada, sem reexecutar a lógica de negócio.
 *  4. Chave IN_PROGRESS (requisição concorrente ainda rodando) -> 409 Conflict.
 *  5. Chave reaproveitada com corpo de requisição DIFERENTE -> 422, pois isso indica
 *     uso incorreto da idempotency key (mesma chave para operações diferentes).
 */
export function idempotency(redis: Redis) {
  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER);

    // Idempotência só se aplica a métodos que alteram estado.
    if (!idempotencyKey || !['POST', 'PATCH', 'PUT'].includes(req.method)) {
      return next();
    }

    const redisKey = keyFor(idempotencyKey);
    const requestHash = hashPayload(req.body);

    try {
      const existingRaw = await redis.get(redisKey);

      if (existingRaw) {
        const existing: StoredResponse = JSON.parse(existingRaw);

        if (existing.requestHash !== requestHash) {
          return res.status(422).json({
            error: 'IDEMPOTENCY_KEY_REUSED',
            message:
              'Esta Idempotency-Key já foi usada com um corpo de requisição diferente. Utilize uma nova chave para uma nova operação.'
          });
        }

        if (existing.status === 'COMPLETED') {
          res.setHeader('Idempotent-Replay', 'true');
          return res.status(existing.statusCode ?? 200).json(existing.body);
        }

        // status === 'IN_PROGRESS' -> outra requisição concorrente com a mesma chave.
        return res.status(409).json({
          error: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
          message: 'Uma requisição com esta Idempotency-Key ainda está em processamento.'
        });
      }

      // Lock atômico: só grava se a chave não existir (evita corrida entre requisições simultâneas).
      const lockPayload: StoredResponse = { status: 'IN_PROGRESS', requestHash };
      const setResult = await redis.set(
        redisKey,
        JSON.stringify(lockPayload),
        'EX',
        LOCK_TTL_SECONDS,
        'NX'
      );

      if (setResult === null) {
        // Perdeu a corrida: outra requisição criou o lock entre o GET e o SET.
        return res.status(409).json({
          error: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
          message: 'Uma requisição com esta Idempotency-Key ainda está em processamento.'
        });
      }

      // Intercepta o envio da resposta para persistir o resultado final.
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const finalPayload: StoredResponse = {
          status: 'COMPLETED',
          statusCode: res.statusCode,
          body,
          requestHash
        };
        redis
          .set(redisKey, JSON.stringify(finalPayload), 'EX', env.IDEMPOTENCY_TTL_SECONDS)
          .catch((err) => req.log?.error({ err }, 'Falha ao persistir resposta idempotente'));
        return originalJson(body);
      }) as typeof res.json;

      return next();
    } catch (err) {
      req.log?.error({ err }, 'Falha no middleware de idempotência');
      // Fail-open: não bloqueia a requisição por indisponibilidade do Redis.
      return next();
    }
  };
}
