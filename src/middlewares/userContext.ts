import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

const USER_ID_HEADER = 'x-user-id';
const userIdSchema = z.string().uuid();

/**
 * Identifica o usuário dono da requisição via header `x-user-id`
 * (UUID gerado pelo frontend e guardado na sessão do navegador).
 * Todas as transações são lidas/gravadas no escopo desse usuário,
 * garantindo que um usuário nunca veja transações de outro.
 */
export function userContext(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.header(USER_ID_HEADER));

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_USER_ID',
      message: 'Header x-user-id ausente ou não é um UUID válido.'
    });
  }

  req.userId = parsed.data.toLowerCase();
  return next();
}
