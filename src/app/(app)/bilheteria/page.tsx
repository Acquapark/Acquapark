import { createClient } from "@/lib/supabase/server";
import { getIngressos, getTiposIngresso } from "@/lib/supabase/bilheteria";
import { getCaixaAberto } from "@/lib/supabase/caixa";
import { BilheteriaClient } from "./BilheteriaClient";

export default async function BilheteriaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ingressos, tipos, caixaAberto] = await Promise.all([
    getIngressos(supabase),
    getTiposIngresso(supabase),
    user ? getCaixaAberto(supabase, user.id) : Promise.resolve(null),
  ]);

  return (
    <BilheteriaClient
      ingressos={ingressos}
      tipos={tipos}
      caixa={caixaAberto ? { numero: caixaAberto.numero, operadorNome: caixaAberto.operadorNome } : null}
    />
  );
}
