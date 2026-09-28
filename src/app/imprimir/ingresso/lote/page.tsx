import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresa } from "@/lib/supabase/contratos";
import { carregarTickets } from "../carregar";
import { TicketPrint } from "../[id]/TicketPrint";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImprimirLoteIngressosPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; w?: string; auto?: string }>;
}) {
  const { ids, w, auto } = await searchParams;
  const lista = (ids ?? "").split(",").filter((id) => UUID.test(id)).slice(0, 50);

  const supabase = await createClient();
  const [tickets, empresa] = await Promise.all([carregarTickets(supabase, lista), getEmpresa(supabase)]);

  if (tickets.length === 0) notFound();

  return (
    <TicketPrint
      tickets={tickets}
      empresaNome={empresa.nome}
      empresaCnpj={empresa.cnpj}
      width={w === "58" ? "58" : "80"}
      auto={auto === "1"}
    />
  );
}
