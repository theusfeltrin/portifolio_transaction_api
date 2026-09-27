import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_KEY: z.string().min(1, "API_KEY é obrigatória"),

  REDIS_URL: z.string().min(1, "REDIS_URL é obrigatória"),

  SUPABASE_URL: z.string().url("SUPABASE_URL inválida"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY é obrigatória"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),

  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86_400),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Em ambiente de teste, permite valores fictícios para não quebrar o setup do Jest.
  if (process.env.NODE_ENV === "test") {
    return {
      PORT: 3000,
      NODE_ENV: "test",
      API_KEY: process.env.API_KEY ?? "test-api-key",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "https://test.supabase.co",
      SUPABASE_SECRET_KEY:
        process.env.SUPABASE_SECRET_KEY ?? "test-service-role-key",
      RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
      RATE_LIMIT_MAX_REQUESTS: Number(
        process.env.RATE_LIMIT_MAX_REQUESTS ?? 60,
      ),
      IDEMPOTENCY_TTL_SECONDS: Number(
        process.env.IDEMPOTENCY_TTL_SECONDS ?? 86_400,
      ),
    };
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Variáveis de ambiente inválidas:",
      parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
