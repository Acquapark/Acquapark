import { createClient } from "@/lib/supabase/server";
import { getAssociados, getPlanos } from "@/lib/supabase/associados";
import { getEmpresasParceiras } from "@/lib/supabase/empresas-parceiras";
import { AssociadosClient } from "./AssociadosClient";

export default async function AssociadosPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  const supabase = await createClient();
  const [associados, planos, empresas] = await Promise.all([
    getAssociados(supabase),
    getPlanos(supabase),
    getEmpresasParceiras(supabase),
  ]);

  return (
    <AssociadosClient
      associados={associados}
      planos={planos}
      // Filtro: todas as empresas (inclusive inativas, que ainda têm associados).
      empresasFiltro={empresas.map((e) => ({ id: e.id, nome: e.ativa ? e.nome : `${e.nome} (inativa)` }))}
      // Cadastro novo: só as ativas.
      empresasCadastro={empresas.filter((e) => e.ativa).map((e) => ({ id: e.id, nome: e.nome, cupom: e.cupom }))}
      empresaInicial={empresa && empresas.some((e) => e.id === empresa) ? empresa : undefined}
    />
  );
}
