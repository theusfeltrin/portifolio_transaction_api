# Integração Frontend — Transactions API

Guia para integrar um frontend (browser) à Transactions API. Pode ser entregue a um agente
(ex.: Claude Code) em outro repositório: contém o contrato completo da API, as regras de
comportamento e uma implementação de referência do client.

---

## 1. Resumo rápido

| Item | Valor |
|------|-------|
| Base URL (local) | `http://localhost:3000/api/v1` |
| Formato | JSON (`Content-Type: application/json`), limite de 1 MB por corpo |
| Autenticação | Header `x-api-key` (chave fixa da aplicação) |
| Identificação do usuário | Header `x-user-id` (UUID v4 guardado no `sessionStorage`) |
| Criação de transação | Header `Idempotency-Key` obrigatório (UUID novo por operação) |
| Rate limit | 60 requisições / 60 s (padrão), contado **por API key** |
| CORS | Liberado para qualquer origem |
| Swagger | `http://localhost:3000/docs` · spec JSON em `http://localhost:3000/docs.json` |

### Headers obrigatórios em toda chamada para `/api/v1/transactions`

```
x-api-key: <API_KEY>
x-user-id: <uuid-do-usuario>
```

E, **somente no `POST`**:

```
Content-Type: application/json
Idempotency-Key: <uuid-novo-por-operacao>
```

Ordem de validação no backend: `x-api-key` (401) → `x-user-id` (400) → rate limit (429) →
idempotência (409/422) → validação do corpo/regra de negócio (400/404).

---

## 2. Identificação do usuário (`x-user-id`)

O usuário não faz login. Cada sessão do navegador tem um UUID que identifica o "dono" das
transações. A API grava esse UUID em cada transação criada e **só retorna transações do
mesmo UUID**: um usuário nunca vê transações de outro.

Regras:

- Gerar com `crypto.randomUUID()` na primeira vez e guardar no `sessionStorage` (chave sugerida: `userId`).
- Reutilizar o mesmo valor em **todas** as requisições enquanto a sessão existir.
- Precisa ser um UUID válido; caso contrário a API responde `400 INVALID_USER_ID`.
- A API normaliza para minúsculas; o frontend pode enviar como `crypto.randomUUID()` gera.
- `sessionStorage` é por aba e é apagado ao fechar a aba: uma nova aba ou sessão gera um
  novo usuário, que **não verá** as transações anteriores. Esse é o comportamento esperado
  do requisito atual. Se for preciso persistir entre abas/sessões, trocar por `localStorage`.
- Não é autenticação: o UUID funciona como um segredo do usuário. Não exibi-lo em URLs,
  logs ou analytics.

```ts
const USER_ID_STORAGE_KEY = 'userId';

export function getUserId(): string {
  let userId = sessionStorage.getItem(USER_ID_STORAGE_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    sessionStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }
  return userId;
}
```

---

## 3. Endpoints

### 3.1 `POST /transactions` — criar transação

**Headers:** `x-api-key`, `x-user-id`, `Content-Type: application/json`, `Idempotency-Key`.

**Body:**

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `type` | `"DEPOSIT" \| "WITHDRAWAL" \| "TRANSFER"` | sim | exatamente um desses valores |
| `amount` | `number` | sim | maior que zero (enviar como número, não string); até 2 casas decimais são persistidas |
| `currency` | `string` | sim | exatamente 3 caracteres, ISO 4217 (ex.: `BRL`, `USD`); a API converte para maiúsculas |
| `description` | `string` | não | até 255 caracteres; omitir o campo em vez de enviar `null` |
| `metadata` | `object` | não | objeto JSON livre (chave → valor); omitir em vez de enviar `null` |

```json
{
  "type": "DEPOSIT",
  "amount": 250.5,
  "currency": "BRL",
  "description": "Depósito inicial",
  "metadata": { "origem": "web" }
}
```

**Resposta `201 Created`:**

```json
{
  "data": {
    "id": "5c1d7a2e-3f4b-4a6c-9d8e-1f2a3b4c5d6e",
    "user_id": "9b2f6c1e-7d3a-4c5b-8e9f-0a1b2c3d4e5f",
    "idempotency_key": "3f2504e0-4f89-11ee-be56-0242ac120002",
    "type": "DEPOSIT",
    "amount": 250.5,
    "currency": "BRL",
    "description": "Depósito inicial",
    "status": "COMPLETED",
    "metadata": { "origem": "web" },
    "created_at": "2026-10-27T14:32:10.123Z"
  }
}
```

**Erros possíveis:** `400 VALIDATION_ERROR`, `400 MISSING_IDEMPOTENCY_KEY`,
`400 INVALID_USER_ID`, `401 UNAUTHORIZED`, `409 IDEMPOTENT_REQUEST_IN_PROGRESS`,
`422 IDEMPOTENCY_KEY_REUSED`, `429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR`.

### 3.2 `GET /transactions/:id` — buscar transação

**Headers:** `x-api-key`, `x-user-id`.

- `:id` deve ser o UUID de uma transação. Só chamar com IDs vindos da própria API: um valor
  que não seja UUID resulta em `500`.
- Transações de outro usuário retornam `404` (igual a inexistente).

**Resposta `200 OK`:** `{ "data": Transaction }` (mesmo formato do POST).

**Erros possíveis:** `404 TRANSACTION_NOT_FOUND`, `400 INVALID_USER_ID`, `401 UNAUTHORIZED`,
`429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR`.

### 3.3 `GET /transactions?page=&pageSize=` — listar transações do usuário

**Headers:** `x-api-key`, `x-user-id`.

| Query | Tipo | Padrão | Regras |
|-------|------|--------|--------|
| `page` | inteiro | `1` | enviar sempre inteiro ≥ 1 |
| `pageSize` | inteiro | `20` | entre 1 e 100 (valores maiores são limitados a 100) |

Ordenação: mais recentes primeiro (`created_at` desc).

**Resposta `200 OK`.** Atenção: aqui **não** existe o wrapper `data`.

```json
{
  "items": [ /* Transaction[] */ ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

- `totalPages` é no mínimo `1`, mesmo com `total: 0`.
- Usar `pagination.pageSize` da resposta (já limitado) para cálculos de UI.
- Enviar `page`/`pageSize` não numéricos quebra a paginação: validar no frontend.

**Erros possíveis:** `400 INVALID_USER_ID`, `401 UNAUTHORIZED`, `429 RATE_LIMIT_EXCEEDED`,
`500 INTERNAL_SERVER_ERROR`.

### 3.4 Outros

| Método | Rota (fora de `/api/v1`) | Uso |
|--------|--------------------------|-----|
| `GET` | `http://localhost:3000/health` | Health check, sem headers: `{ "status": "ok", "timestamp": "..." }` |
| `GET` | `http://localhost:3000/docs` | Swagger UI |

---

## 4. Tipos TypeScript

```ts
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;            // uuid
  user_id: string;       // uuid do usuário (x-user-id)
  idempotency_key: string;
  type: TransactionType;
  amount: number;
  currency: string;      // ISO 4217, maiúsculas
  description: string | null;
  status: TransactionStatus; // hoje a API sempre cria como COMPLETED
  metadata: Record<string, unknown> | null;
  created_at: string;    // ISO 8601
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionResponse {
  data: Transaction;
}

export interface TransactionListResponse {
  items: Transaction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;                      // mensagem em português, pode ser exibida ao usuário
  details?: Record<string, string[]>;   // só em VALIDATION_ERROR: erros por campo
  retryAfter?: number;                  // só em RATE_LIMIT_EXCEEDED: segundos
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_USER_ID'
  | 'INVALID_AMOUNT'
  | 'UNAUTHORIZED'
  | 'TRANSACTION_NOT_FOUND'
  | 'NOT_FOUND'
  | 'IDEMPOTENT_REQUEST_IN_PROGRESS'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR';
```

---

## 5. Erros

Todas as respostas de erro têm o formato `{ "error": "<CODIGO>", "message": "<texto>" }`.

| Status | `error` | Quando | Ação sugerida no frontend |
|--------|---------|--------|---------------------------|
| 400 | `VALIDATION_ERROR` | Corpo inválido. Traz `details` com erros por campo | Mostrar `details[campo][0]` ao lado de cada campo do formulário |
| 400 | `MISSING_IDEMPOTENCY_KEY` | POST sem `Idempotency-Key` | Bug do client: sempre enviar |
| 400 | `INVALID_USER_ID` | `x-user-id` ausente ou não-UUID | Regenerar o UUID no `sessionStorage` e tentar de novo |
| 400 | `INVALID_AMOUNT` | Saque com valor ≤ 0 | Validar `amount > 0` antes de enviar |
| 401 | `UNAUTHORIZED` | `x-api-key` ausente ou errada | Erro de configuração: checar variável de ambiente |
| 404 | `TRANSACTION_NOT_FOUND` | ID inexistente ou de outro usuário | Exibir "Transação não encontrada" |
| 404 | `NOT_FOUND` | Rota inexistente | Bug do client (URL errada) |
| 409 | `IDEMPOTENT_REQUEST_IN_PROGRESS` | Mesma `Idempotency-Key` ainda sendo processada | Aguardar ~1 s e repetir **com a mesma chave e o mesmo corpo** |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Mesma chave reutilizada com corpo diferente | Bug do client: gerar chave nova por operação |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite excedido. Traz `retryAfter` (segundos) | Desabilitar ações e tentar após `retryAfter` segundos |
| 500 | `INTERNAL_SERVER_ERROR` | Erro inesperado | Mensagem genérica de erro |

Exemplo de `VALIDATION_ERROR`:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Payload inválido.",
  "details": {
    "amount": ["amount deve ser maior que zero"],
    "currency": ["currency deve seguir o padrão ISO 4217 (ex: BRL, USD)"]
  }
}
```

---

## 6. Idempotência (como usar `Idempotency-Key`)

Garante que um retry (timeout, duplo clique, queda de rede) **não crie a transação duas vezes**.

1. Gerar `crypto.randomUUID()` **uma vez por operação de criação**, ou seja, quando o
   usuário inicia a submissão do formulário, e não a cada tentativa HTTP.
2. Em retries automáticos dessa mesma operação (erro de rede, timeout, `409`), reenviar
   **a mesma chave e exatamente o mesmo corpo**.
3. Se a API já processou aquela chave, ela devolve a resposta original (mesmo status `201`
   e o mesmo `data`) sem criar outra transação.
4. Quando a API **responder** (qualquer status, inclusive 4xx/5xx), o resultado fica
   registrado para aquela chave por 24 h. Para uma nova tentativa após corrigir o
   formulário, **gerar uma chave nova**. Reenviar a mesma chave com corpo diferente retorna `422`.
5. Nunca reutilizar a chave de uma transação já concluída para outra transação.
6. Desabilitar o botão de submit enquanto a requisição está em andamento.

Fluxo recomendado:

```
usuário clica "Salvar"
  └─ key = randomUUID()  (guardar junto do estado do formulário)
     └─ POST com key
          ├─ erro de rede / timeout → retry com a MESMA key (até 3x, backoff)
          ├─ 409                    → esperar ~1 s, retry com a MESMA key
          ├─ 201                    → sucesso; descartar key e limpar o formulário
          └─ 4xx / 5xx              → mostrar erro; descartar key (próximo submit gera outra)
```

---

## 7. Rate limit

- Padrão: 60 requisições em uma janela deslizante de 60 s (configurável no backend).
- É contado **por API key**. Como todos os usuários do frontend usam a mesma chave, o
  limite é **compartilhado entre todos os usuários**. Evitar polling e refetch desnecessário.
- Ao receber `429`, usar o campo `retryAfter` do **corpo** da resposta.
- A API envia os headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`,
  `Retry-After` e `Idempotent-Replay`, mas eles **não ficam legíveis pelo JavaScript do
  browser em chamadas cross-origin** (o backend não os expõe via
  `Access-Control-Expose-Headers`). Não depender desses headers no frontend.

---

## 8. Configuração no frontend

Variáveis de ambiente (adaptar o prefixo ao framework: `VITE_`, `NEXT_PUBLIC_`, etc.):

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_KEY=change-me-local-dev-key
```

- O valor de `API_KEY` deve ser igual ao configurado no `.env` do backend.
- A API key vai para o bundle do browser, então **não é secreta**. Ela só impede o uso
  anônimo da API e não protege dados. Quem isola os dados de cada usuário é o `x-user-id`.

---

## 9. Implementação de referência do client (fetch, sem dependências)

```ts
// src/api/transactionsClient.ts
import type {
  ApiErrorBody,
  CreateTransactionInput,
  Transaction,
  TransactionListResponse,
  TransactionResponse
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
const API_KEY = import.meta.env.VITE_API_KEY as string;
const USER_ID_STORAGE_KEY = 'userId';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

export function getUserId(): string {
  let userId = sessionStorage.getItem(USER_ID_STORAGE_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    sessionStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }
  return userId;
}

function resetUserId(): void {
  sessionStorage.removeItem(USER_ID_STORAGE_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-api-key', API_KEY);
  headers.set('x-user-id', getUserId());
  if (init.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (body?.error === 'INVALID_USER_ID') resetUserId();
    throw new ApiError(
      res.status,
      body ?? { error: 'INTERNAL_SERVER_ERROR', message: 'Resposta inválida do servidor.' }
    );
  }
  return body as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cria uma transação com idempotência.
 * Passe a mesma `idempotencyKey` apenas para retries da MESMA operação.
 */
export async function createTransaction(
  input: CreateTransactionInput,
  idempotencyKey: string = crypto.randomUUID(),
  maxAttempts = 3
): Promise<Transaction> {
  const body = JSON.stringify(input); // mesmo corpo em todas as tentativas

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await request<TransactionResponse>('/transactions', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body
      });
      return res.data;
    } catch (err) {
      const retriable =
        !(err instanceof ApiError) || // erro de rede
        err.body.error === 'IDEMPOTENT_REQUEST_IN_PROGRESS';
      if (!retriable || attempt >= maxAttempts) throw err;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

export async function getTransaction(id: string): Promise<Transaction> {
  const res = await request<TransactionResponse>(`/transactions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function listTransactions(page = 1, pageSize = 20): Promise<TransactionListResponse> {
  const params = new URLSearchParams({
    page: String(Math.max(1, Math.trunc(page))),
    pageSize: String(Math.min(100, Math.max(1, Math.trunc(pageSize))))
  });
  return request<TransactionListResponse>(`/transactions?${params}`);
}
```

---

## 10. Instruções para o agente que fará a integração

Tarefa: integrar o frontend a esta API seguindo o contrato acima.

Checklist:

- [ ] Ler a stack do projeto (framework, gerenciador de estado, lib de fetch/query já usada) e adaptar o client da seção 9, mantendo o comportamento descrito.
- [ ] Criar as variáveis de ambiente `API_BASE_URL` e `API_KEY` (com o prefixo do framework) e documentá-las no `.env.example` do frontend.
- [ ] Criar os tipos da seção 4.
- [ ] Implementar `getUserId()` com `sessionStorage` e enviar `x-user-id` em **todas** as chamadas para `/transactions`.
- [ ] `POST`: gerar `Idempotency-Key` por submissão de formulário; retry só em erro de rede ou `409`, com a mesma chave e o mesmo corpo; desabilitar o submit durante o envio.
- [ ] Validar no formulário antes de enviar: `type` do enum, `amount > 0` (número), `currency` com 3 letras, `description` ≤ 255.
- [ ] Mapear `VALIDATION_ERROR.details` para erros por campo no formulário.
- [ ] Listagem: lembrar que a resposta é `{ items, pagination }` (sem `data`); paginar com `page`/`pageSize` inteiros válidos.
- [ ] Detalhe: tratar `404 TRANSACTION_NOT_FOUND` como "não encontrada".
- [ ] `429`: usar `retryAfter` do corpo; não ler headers `X-RateLimit-*`.
- [ ] Tratar `amount` como número; formatar na UI com `Intl.NumberFormat` usando o `currency` da transação.
- [ ] Não logar nem exibir `x-user-id`/API key.

Para conferir o contrato ao vivo, com o backend rodando: `GET http://localhost:3000/docs.json`
(OpenAPI 3).
