import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../types/transaction';

const TABLE = 'transactions';

export class TransactionsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(data: {
    idempotency_key: string;
    type: Transaction['type'];
    amount: number;
    currency: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Transaction> {
    const { data: row, error } = await this.db
      .from(TABLE)
      .insert({
        idempotency_key: data.idempotency_key,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description ?? null,
        metadata: data.metadata ?? null,
        status: 'COMPLETED'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Falha ao criar transação: ${error.message}`);
    }

    return row as Transaction;
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.db.from(TABLE).select('*').eq('id', id).maybeSingle();

    if (error) {
      throw new Error(`Falha ao buscar transação: ${error.message}`);
    }

    return (data as Transaction) ?? null;
  }

  async list(params: { limit: number; offset: number }): Promise<{ items: Transaction[]; total: number }> {
    const { data, error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) {
      throw new Error(`Falha ao listar transações: ${error.message}`);
    }

    return { items: (data as Transaction[]) ?? [], total: count ?? 0 };
  }
}
