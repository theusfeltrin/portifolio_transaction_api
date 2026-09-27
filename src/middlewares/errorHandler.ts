import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'NOT_FOUND', message: `Rota ${req.method} ${req.originalUrl} não existe.` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Payload inválido.',
      details: err.flatten().fieldErrors
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }

  req.log?.error({ err }, 'Erro não tratado');
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno inesperado.' });
}
