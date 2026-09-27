import { Router } from 'express';
import { TransactionsController } from '../controllers/transactions.controller';
import { asyncHandler } from '../utils/asyncHandler';

export function transactionsRouter(controller: TransactionsController): Router {
  const router = Router();

  /**
   * @openapi
   * /transactions:
   *   post:
   *     summary: Cria uma nova transação
   *     description: >
   *       Cria uma transação financeira. Requer o header `Idempotency-Key` para
   *       garantir que retries do cliente não gerem duplicidade. Requisições
   *       repetidas com a mesma chave e mesmo corpo retornam a resposta original
   *       (replay), sem reprocessar a operação.
   *     tags: [Transactions]
   *     security: [{ ApiKeyAuth: [] }]
   *     parameters:
   *       - in: header
   *         name: Idempotency-Key
   *         required: true
   *         schema: { type: string, example: "a1b2c3d4-uuid-do-cliente" }
   *         description: Chave única gerada pelo cliente para esta operação.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/CreateTransactionInput' }
   *     responses:
   *       201:
   *         description: Transação criada com sucesso.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/TransactionResponse' }
   *       200:
   *         description: Replay de uma requisição idempotente já concluída anteriormente.
   *       400:
   *         description: Payload inválido ou header Idempotency-Key ausente.
   *       401:
   *         description: API key ausente ou inválida.
   *       409:
   *         description: Requisição concorrente com a mesma Idempotency-Key ainda em processamento.
   *       422:
   *         description: Idempotency-Key reutilizada com um corpo de requisição diferente.
   *       429:
   *         description: Rate limit excedido.
   */
  router.post('/', asyncHandler(controller.create));

  /**
   * @openapi
   * /transactions/{id}:
   *   get:
   *     summary: Busca uma transação pelo ID
   *     tags: [Transactions]
   *     security: [{ ApiKeyAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Transação encontrada.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/TransactionResponse' }
   *       404:
   *         description: Transação não encontrada.
   */
  router.get('/:id', asyncHandler(controller.getById));

  /**
   * @openapi
   * /transactions:
   *   get:
   *     summary: Lista transações paginadas
   *     tags: [Transactions]
   *     security: [{ ApiKeyAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: pageSize
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200:
   *         description: Lista paginada de transações.
   */
  router.get('/', asyncHandler(controller.list));

  return router;
}
