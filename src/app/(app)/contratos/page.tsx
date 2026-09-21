import { createClient } from "@/lib/supabase/server";
import { getModelos } from "@/lib/supabase/contratos";
import { ContratosClient } from "./ContratosClient";

export default async function ContratosPage() {
  const supabase = await createClient();
  const modelos = await getModelos(supabase);

  return <ContratosClient modelos={modelos} />;
}
