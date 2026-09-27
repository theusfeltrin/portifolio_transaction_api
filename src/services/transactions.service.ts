import { AppError } from '../middlewares/errorHandler';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { CreateTransactionInput, Transaction } from '../types/transaction';

export class TransactionsService {
  constructor(private readonly repository: TransactionsRepository) {}

  async createTransaction(input: CreateTransactionInput, idempotencyKey: string): Promise<Transaction> {
    if (input.type === 'WITHDRAWAL' && input.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'amount deve ser positivo para saques.');
    }

    return this.repository.create({
      idempotency_key: idempotencyKey,
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      metadata: input.metadata
    });
  }

  async getTransaction(id: string): Promise<Transaction> {
    const transaction = await this.repository.findById(id);
    if (!transaction) {
      throw new AppError(404, 'TRANSACTION_NOT_FOUND', `Transação ${id} não encontrada.`);
    }
    return transaction;
  }

  async listTransactions(page: number, pageSize: number) {
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const offset = Math.max(page - 1, 0) * limit;
    const { items, total } = await this.repository.list({ limit, offset });

    return {
      items,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }
}
