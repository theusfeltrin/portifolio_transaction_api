import { Request, Response } from 'express';
import { createTransactionSchema } from '../types/schemas';
import { TransactionsService } from '../services/transactions.service';
import { AppError } from '../middlewares/errorHandler';

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError(400, 'INVALID_USER_ID', 'Header x-user-id ausente ou não é um UUID válido.');
  }
  return req.userId;
}

export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  create = async (req: Request, res: Response) => {
    const idempotencyKey = req.header('idempotency-key');
    if (!idempotencyKey) {
      throw new AppError(
        400,
        'MISSING_IDEMPOTENCY_KEY',
        'Header Idempotency-Key é obrigatório para criar uma transação.'
      );
    }

    const input = createTransactionSchema.parse(req.body);
    const transaction = await this.service.createTransaction(
      requireUserId(req),
      input,
      idempotencyKey
    );
    res.status(201).json({ data: transaction });
  };

  getById = async (req: Request, res: Response) => {
    const transaction = await this.service.getTransaction(requireUserId(req), req.params.id);
    res.status(200).json({ data: transaction });
  };

  list = async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const result = await this.service.listTransactions(requireUserId(req), page, pageSize);
    res.status(200).json(result);
  };
}
