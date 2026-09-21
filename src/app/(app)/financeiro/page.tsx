import { createClient } from "@/lib/supabase/server";
import { getContasReceber, getDespesas, getRecebimentos } from "@/lib/supabase/financeiro";
import { hojeBR, mesAtualBR, mesValido } from "@/lib/datas-br";
import { FinanceiroClient } from "./FinanceiroClient";

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const mes = mesValido(mesParam) ? mesParam : mesAtualBR();

  const supabase = await createClient();
  const [contas, recebimentos, despesas] = await Promise.all([
    getContasReceber(supabase),
    getRecebimentos(supabase, mes),
    getDespesas(supabase),
  ]);

  return <FinanceiroClient mes={mes} hoje={hojeBR()} contas={contas} recebimentos={recebimentos} despesas={despesas} />;
}
