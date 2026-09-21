import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresa } from "@/lib/supabase/contratos";
import { TicketPrint } from "./TicketPrint";

export default async function ImprimirIngressoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string; auto?: string }>;
}) {
  const { id } = await params;
  const { w, auto } = await searchParams;

  const supabase = await createClient();
  const [{ data }, empresa] = await Promise.all([
    supabase
      .from("ingressos")
      .select("numero, codigo, comprador_nome, data_utilizacao, valor, forma_pagamento, regra_reentrada, created_at, tipos_ingresso ( nome )")
      .eq("id", id)
      .maybeSingle(),
    getEmpresa(supabase),
  ]);

  if (!data) notFound();
  const row = data as unknown as Record<string, unknown>;

  return (
    <TicketPrint
      ticket={{
        numero: row.numero as string,
        codigo: row.codigo as string,
        tipo: ((row.tipos_ingresso as Record<string, unknown> | null)?.nome as string) ?? "Ingresso",
        comprador: (row.comprador_nome as string) ?? "",
        dataUtilizacao: row.data_utilizacao as string,
        valor: Number(row.valor),
        formaPagamento: (row.forma_pagamento as string) ?? null,
        regraReentrada: (row.regra_reentrada as "unica" | "reentrada" | "ilimitado") ?? "unica",
        emitidoEm: row.created_at as string,
      }}
      empresaNome={empresa.nome}
      empresaCnpj={empresa.cnpj}
      width={w === "58" ? "58" : "80"}
      auto={auto === "1"}
    />
  );
}
