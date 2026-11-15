import { createClient } from "@/lib/supabase/server";
import { getEmpresasParceiras } from "@/lib/supabase/empresas-parceiras";
import { EmpresasClient } from "./EmpresasClient";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const empresas = await getEmpresasParceiras(supabase);
  return <EmpresasClient empresas={empresas} />;
}
