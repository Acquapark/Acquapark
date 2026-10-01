import type { Metadata } from "next";
import { connection } from "next/server";
import { Waves } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanosAutocadastro } from "@/lib/associados/autocadastro";
import { camposExigidosPeloContrato } from "@/lib/associados/cadastro";
import { getTermoVigente } from "@/lib/termos";
import { AutocadastroClient } from "./AutocadastroClient";

export const metadata: Metadata = {
  title: "Seja associado — Aqua Park",
  description: "Faça seu cadastro de associado do Aqua Park pela internet.",
};

export default async function CadastroPage() {
  // Sempre na hora da requisição: marcar/desmarcar um plano vale imediatamente.
  await connection();

  // Página pública, sem sessão: os planos são lidos pelo servidor e só os
  // campos que a página precisa chegam ao navegador.
  const admin = createAdminClient();
  const [planos, camposContrato, termo] = await Promise.all([
    getPlanosAutocadastro(admin),
    camposExigidosPeloContrato(admin),
    getTermoVigente(admin),
  ]);

  // Sem termos publicados ninguém se cadastra pela internet: o aceite é obrigatório.
  if (planos.length === 0 || !termo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
          <Waves size={26} strokeWidth={2.25} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Cadastro online indisponível</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          No momento o cadastro pela internet não está disponível. Procure a secretaria do Aqua Park para se associar.
        </p>
      </div>
    );
  }

  return (
    <AutocadastroClient
      planos={planos}
      camposContrato={camposContrato.map((c) => c.campo)}
      termo={{ id: termo.id, versao: termo.versao, conteudo: termo.conteudo }}
    />
  );
}
