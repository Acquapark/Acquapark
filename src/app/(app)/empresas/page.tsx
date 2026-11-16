import { createClient } from "@/lib/supabase/server";
import { getEmpresasParceiras } from "@/lib/supabase/empresas-parceiras";
import { getCupons } from "@/lib/supabase/bilheteria";
import { EmpresasClient } from "./EmpresasClient";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const [empresas, cupons] = await Promise.all([getEmpresasParceiras(supabase), getCupons(supabase)]);
  // Só cupons que valem para plano podem ser o desconto dos funcionários.
  const cuponsPlano = cupons.filter((c) => c.aplicaA !== "ingressos");
  return <EmpresasClient empresas={empresas} cuponsPlano={cuponsPlano} />;
}
