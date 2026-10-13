import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatewayReal } from "@/lib/gateway";
import { getPedidoPorToken } from "@/lib/venda-online/servidor";
import { PedidoClient } from "./PedidoClient";

export const metadata: Metadata = {
  title: "Seu pedido — Acqua Park",
  // Link pessoal com os ingressos: não deve aparecer em buscadores.
  robots: { index: false, follow: false },
};

export default async function PedidoPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  // O token longo e aleatório é a "senha" do pedido — quem tem o link vê os ingressos.
  const resultado = await getPedidoPorToken(createAdminClient(), token);
  if (!resultado) notFound();

  return <PedidoClient pedido={resultado.pedido} ingressos={resultado.ingressos} simulacao={!gatewayReal} />;
}
