import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key — ignora RLS.
 * Uso exclusivo em Server Actions e Route Handlers confiáveis:
 * operações administrativas (criar/redefinir senha de associado no Auth)
 * e no webhook de pagamento (que não chega com sessão de usuário).
 * NUNCA importar isto em um Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
