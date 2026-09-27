import { z } from 'zod';

export const createTransactionSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']),
  amount: z.number().positive('amount deve ser maior que zero'),
  currency: z
    .string()
    .length(3, 'currency deve seguir o padrão ISO 4217 (ex: BRL, USD)')
    .toUpperCase(),
  description: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateTransactionBody = z.infer<typeof createTransactionSchema>;
