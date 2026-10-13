import type { Metadata } from "next";
import { connection } from "next/server";
import { Waves } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigVendaOnline, getTiposOnline, janelaDeDatas } from "@/lib/venda-online/servidor";
import { CompraClient } from "./CompraClient";

export const metadata: Metadata = {
  title: "Comprar ingressos — Acqua Park",
  description: "Compre seus ingressos do Acqua Park pela internet com Pix ou cartão.",
};

export default async function ComprarPage() {
  // Sempre na hora: preços, tipos e datas mudam pelo painel.
  await connection();

  const admin = createAdminClient();
  const [config, tipos] = await Promise.all([getConfigVendaOnline(admin), getTiposOnline(admin)]);

  if (!config.ativa || tipos.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
          <Waves size={26} strokeWidth={2.25} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Venda online indisponível</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          No momento os ingressos não estão à venda pela internet. Você pode comprar na bilheteria do Acqua Park.
        </p>
      </div>
    );
  }

  const janela = janelaDeDatas(config);
  return <CompraClient tipos={tipos} primeiraData={janela.primeira} ultimaData={janela.ultima} />;
}
