import { createClient } from "@/lib/supabase/server";
import { getIngressos, getTiposIngresso } from "@/lib/supabase/bilheteria";
import { getCaixaAberto } from "@/lib/supabase/caixa";
import { BilheteriaClient } from "./BilheteriaClient";

export default async function BilheteriaPage() {
  const supabase = await createClient();
  // Validação local do JWT (o proxy já barrou quem não está logado): evita uma ida ao Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const [ingressos, tipos, caixaAberto] = await Promise.all([
    getIngressos(supabase),
    getTiposIngresso(supabase),
    userId ? getCaixaAberto(supabase, userId) : Promise.resolve(null),
  ]);

  return (
    <BilheteriaClient
      ingressos={ingressos}
      tipos={tipos}
      caixa={caixaAberto ? { numero: caixaAberto.numero, operadorNome: caixaAberto.operadorNome } : null}
    />
  );
}
