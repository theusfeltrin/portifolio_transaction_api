import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Cliente Supabase usando a service_role key.
 * Deve ser usado apenas no backend (nunca exposto ao cliente/frontend),
 * pois ignora as políticas de RLS (Row Level Security).
 */
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
