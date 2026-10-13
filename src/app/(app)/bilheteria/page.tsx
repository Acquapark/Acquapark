import { createClient } from "@/lib/supabase/server";
import { getCupons, getIngressos, getTiposIngresso } from "@/lib/supabase/bilheteria";
import { getCaixaAberto } from "@/lib/supabase/caixa";
import { hojeBR } from "@/lib/datas-br";
import { getPedidosOnline } from "@/lib/venda-online/servidor";
import { BilheteriaClient } from "./BilheteriaClient";

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

// A lista padrão é "vendas de hoje" — não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export default async function BilheteriaPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { de: deParam, ate: ateParam } = await searchParams;
  const hoje = hojeBR();
  const de = deParam && DATA_VALIDA.test(deParam) ? deParam : hoje;
  const ate = ateParam && DATA_VALIDA.test(ateParam) ? ateParam : hoje;

  const supabase = await createClient();
  // Validação local do JWT (o proxy já barrou quem não está logado): evita uma ida ao Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const [ingressos, tipos, cupons, caixaAberto, pedidosOnline] = await Promise.all([
    getIngressos(supabase, { de, ate }),
    getTiposIngresso(supabase),
    getCupons(supabase),
    userId ? getCaixaAberto(supabase, userId) : Promise.resolve(null),
    // Antes de rodar supabase/venda_online.sql a tabela não existe: a aba só fica vazia.
    getPedidosOnline(supabase).catch(() => []),
  ]);

  return (
    <BilheteriaClient
      ingressos={ingressos}
      tipos={tipos}
      cupons={cupons}
      pedidosOnline={pedidosOnline}
      periodo={{ de, ate }}
      caixa={caixaAberto ? { numero: caixaAberto.numero, operadorNome: caixaAberto.operadorNome } : null}
    />
  );
}
