import { createClient } from "@/lib/supabase/server";
import { getAssociados, getPlanos } from "@/lib/supabase/associados";
import { AssociadosClient } from "./AssociadosClient";

export default async function AssociadosPage() {
  const supabase = await createClient();
  const [associados, planos] = await Promise.all([getAssociados(supabase), getPlanos(supabase)]);

  return <AssociadosClient associados={associados} planos={planos} />;
}
