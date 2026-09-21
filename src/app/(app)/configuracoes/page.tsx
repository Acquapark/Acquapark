import { createClient } from "@/lib/supabase/server";
import { getEmpresa } from "@/lib/supabase/contratos";
import { getPlanosTodos } from "@/lib/supabase/associados";
import { getTiposIngresso } from "@/lib/supabase/bilheteria";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [empresa, planos, tiposIngresso] = await Promise.all([
    getEmpresa(supabase),
    getPlanosTodos(supabase),
    getTiposIngresso(supabase),
  ]);

  return <ConfiguracoesClient empresa={empresa} planos={planos} tiposIngresso={tiposIngresso} />;
}
