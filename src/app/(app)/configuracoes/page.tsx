import { createClient } from "@/lib/supabase/server";
import { getEmpresa } from "@/lib/supabase/contratos";
import { getPlanosTodos } from "@/lib/supabase/associados";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [empresa, planos] = await Promise.all([getEmpresa(supabase), getPlanosTodos(supabase)]);

  return <ConfiguracoesClient empresa={empresa} planos={planos} />;
}
