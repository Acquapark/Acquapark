import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresa } from "@/lib/supabase/contratos";
import { gerarRelatorio } from "@/lib/supabase/relatorios";
import { hojeBR } from "@/lib/datas-br";
import { validarPeriodo } from "@/lib/relatorios/periodo";
import { relatorioIdValido } from "@/lib/relatorios/tipos";
import { RelatorioPrint } from "./RelatorioPrint";

export default async function ImprimirRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; de?: string; ate?: string; auto?: string }>;
}) {
  const { id, de, ate, auto } = await searchParams;
  if (!id || !relatorioIdValido(id)) notFound();

  // Relatórios sem período (base de associados) ignoram as datas.
  const hoje = hojeBR();
  const inicio = de ?? `${hoje.slice(0, 7)}-01`;
  const fim = ate ?? hoje;
  if (id !== "associados" && validarPeriodo(inicio, fim)) notFound();

  const supabase = await createClient();
  const [relatorio, empresa] = await Promise.all([gerarRelatorio(supabase, id, inicio, fim), getEmpresa(supabase)]);

  return <RelatorioPrint relatorio={relatorio} empresaNome={empresa.nome} empresaCnpj={empresa.cnpj} auto={auto === "1"} />;
}
