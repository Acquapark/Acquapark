import { createClient } from "@/lib/supabase/server";
import { getCaixaAberto, getCaixaResumo, getCaixas } from "@/lib/supabase/caixa";
import { CaixaClient } from "./CaixaClient";

export default async function CaixaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caixaAberto = user ? await getCaixaAberto(supabase, user.id) : null;
  const [resumoAberto, historico] = await Promise.all([
    caixaAberto ? getCaixaResumo(supabase, caixaAberto.id) : Promise.resolve(null),
    getCaixas(supabase, 40),
  ]);

  return <CaixaClient resumoAberto={resumoAberto} historico={historico} />;
}
