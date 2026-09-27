import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * Autenticação simples via header `x-api-key`.
 * Serve tanto para identificar o chamador (usado como chave no rate limiter)
 * quanto para proteger a API contra uso não autorizado.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.header('x-api-key');

  if (!providedKey || providedKey !== env.API_KEY) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Header x-api-key ausente ou inválido.'
    });
  }

  return next();
}
