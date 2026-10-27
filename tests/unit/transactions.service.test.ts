import { TransactionsService } from '../../src/services/transactions.service';
import { TransactionsRepository } from '../../src/repositories/transactions.repository';
import { AppError } from '../../src/middlewares/errorHandler';
import { Transaction } from '../../src/types/transaction';

function makeRepositoryMock(): jest.Mocked<TransactionsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn()
  } as unknown as jest.Mocked<TransactionsRepository>;
}

const userId = '9b2f6c1e-7d3a-4c5b-8e9f-0a1b2c3d4e5f';

const sampleTransaction: Transaction = {
  id: 'tx-1',
  user_id: userId,
  idempotency_key: 'key-1',
  type: 'DEPOSIT',
  amount: 100,
  currency: 'BRL',
  description: null,
  status: 'COMPLETED',
  metadata: null,
  created_at: new Date().toISOString()
};

describe('TransactionsService', () => {
  let repository: jest.Mocked<TransactionsRepository>;
  let service: TransactionsService;

  beforeEach(() => {
    repository = makeRepositoryMock();
    service = new TransactionsService(repository);
  });

  describe('createTransaction', () => {
    it('cria uma transação de depósito válida', async () => {
      repository.create.mockResolvedValue(sampleTransaction);

      const result = await service.createTransaction(
        userId,
        { type: 'DEPOSIT', amount: 100, currency: 'BRL' },
        'key-1'
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          idempotency_key: 'key-1',
          amount: 100,
          type: 'DEPOSIT'
        })
      );
      expect(result).toEqual(sampleTransaction);
    });

    it('rejeita saque com amount menor ou igual a zero', async () => {
      await expect(
        service.createTransaction(userId, { type: 'WITHDRAWAL', amount: 0, currency: 'BRL' }, 'key-2')
      ).rejects.toThrow(AppError);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('getTransaction', () => {
    it('retorna a transação quando encontrada', async () => {
      repository.findById.mockResolvedValue(sampleTransaction);

      const result = await service.getTransaction(userId, 'tx-1');

      expect(repository.findById).toHaveBeenCalledWith(userId, 'tx-1');
      expect(result).toEqual(sampleTransaction);
    });

    it('lança AppError 404 quando a transação não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getTransaction(userId, 'nao-existe')).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRANSACTION_NOT_FOUND'
      });
    });
  });

  describe('listTransactions', () => {
    it('calcula paginação corretamente', async () => {
      repository.list.mockResolvedValue({ items: [sampleTransaction], total: 25 });

      const result = await service.listTransactions(userId, 2, 10);

      expect(repository.list).toHaveBeenCalledWith({ userId, limit: 10, offset: 10 });
      expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 25, totalPages: 3 });
    });

    it('limita pageSize a no máximo 100', async () => {
      repository.list.mockResolvedValue({ items: [], total: 0 });

      await service.listTransactions(userId, 1, 500);

      expect(repository.list).toHaveBeenCalledWith({ userId, limit: 100, offset: 0 });
    });
  });
});
