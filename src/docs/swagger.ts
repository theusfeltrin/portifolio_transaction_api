import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Transactions API',
      version: '1.0.0',
      description:
        'API de Transações com Idempotência e Rate Limiting. Projeto de portfólio ' +
        'demonstrando Node.js + TypeScript, Redis, Supabase (PostgreSQL) e boas práticas ' +
        'de design de APIs financeiras.',
      contact: { name: 'Seu Nome', url: 'https://seu-portfolio.dev' },
      license: { name: 'MIT' }
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Ambiente local' }
    ],
    tags: [{ name: 'Transactions', description: 'Operações de transações financeiras' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
      },
      schemas: {
        CreateTransactionInput: {
          type: 'object',
          required: ['type', 'amount', 'currency'],
          properties: {
            type: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'], example: 'DEPOSIT' },
            amount: { type: 'number', example: 250.5 },
            currency: { type: 'string', example: 'BRL' },
            description: { type: 'string', example: 'Depósito inicial' },
            metadata: { type: 'object', additionalProperties: true }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            idempotency_key: { type: 'string' },
            type: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'] },
            amount: { type: 'number' },
            currency: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED'] },
            metadata: { type: 'object', nullable: true, additionalProperties: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        TransactionResponse: {
          type: 'object',
          properties: { data: { $ref: '#/components/schemas/Transaction' } }
        }
      }
    },
    security: [{ ApiKeyAuth: [] }]
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js']
});
