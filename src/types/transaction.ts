export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;
  idempotency_key: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  status: TransactionStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
