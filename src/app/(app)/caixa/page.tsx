import { createClient } from "@/lib/supabase/server";
import { getCaixaAberto, getCaixaResumo, getCaixas } from "@/lib/supabase/caixa";
import { getAcessoAtual } from "@/lib/auth/acesso-atual";
import { temPermissao } from "@/lib/permissoes";
import { CaixaClient } from "./CaixaClient";

export default async function CaixaPage() {
  const supabase = await createClient();
  // Validação local do JWT (o proxy já barrou quem não está logado): evita uma ida ao Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const caixaAberto = userId ? await getCaixaAberto(supabase, userId) : null;
  const [resumoAberto, historico] = await Promise.all([
    caixaAberto ? getCaixaResumo(supabase, caixaAberto.id) : Promise.resolve(null),
    // Sem "ver caixas de outros operadores", o histórico mostra só os do próprio usuário.
    getCaixas(supabase, 40, temPermissao(await getAcessoAtual(), "caixa.ver_todos") ? undefined : (userId ?? undefined)),
  ]);

  return <CaixaClient resumoAberto={resumoAberto} historico={historico} />;
}
