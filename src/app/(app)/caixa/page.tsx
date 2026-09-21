import { createClient } from "@/lib/supabase/server";
import { getCaixaAberto, getCaixaResumo, getCaixas } from "@/lib/supabase/caixa";
import { CaixaClient } from "./CaixaClient";

export default async function CaixaPage() {
  const supabase = await createClient();
  // Validação local do JWT (o proxy já barrou quem não está logado): evita uma ida ao Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const caixaAberto = userId ? await getCaixaAberto(supabase, userId) : null;
  const [resumoAberto, historico] = await Promise.all([
    caixaAberto ? getCaixaResumo(supabase, caixaAberto.id) : Promise.resolve(null),
    getCaixas(supabase, 40),
  ]);

  return <CaixaClient resumoAberto={resumoAberto} historico={historico} />;
}
