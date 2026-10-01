"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { aceitarTermos } from "@/app/portal/actions";

export function AceiteTermosForm({ versaoId, conteudo }: { versaoId: string; conteudo: string }) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    setEnviando(true);
    setError("");
    const result = await aceitarTermos(versaoId);
    if ("error" in result) {
      setEnviando(false);
      setError(result.error);
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700 shadow-sm">
        {conteudo}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        <span className="text-sm text-gray-700">
          <strong>Li e aceito os Termos de Adesão.</strong>
        </span>
      </label>

      {error && <div className="rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">{error}</div>}

      <button
        type="button"
        onClick={confirmar}
        disabled={!aceito || enviando}
        className="h-12 w-full rounded-[6px] bg-primary-600 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
      >
        {enviando ? "Registrando..." : "Aceitar e continuar"}
      </button>

      {/* Pagamento continua liberado mesmo antes do aceite. */}
      <Link href="/portal/mensalidades" className="block text-center text-sm font-medium text-primary-600">
        Só quero pagar uma mensalidade agora
      </Link>
    </div>
  );
}
