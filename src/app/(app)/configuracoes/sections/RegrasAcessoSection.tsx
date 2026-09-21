"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        enabled ? "bg-primary-600" : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function RegrasAcessoSection() {
  const [bloquearInadimplente, setBloquearInadimplente] = useState(true);
  const [reentrada, setReentrada] = useState<"unica" | "reentrada" | "ilimitado">("reentrada");
  const [tolerancia, setTolerancia] = useState("3");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-gray-800">Regras de Acesso</h2>
        <p className="text-xs text-gray-500">Essas regras controlam como as catracas autorizam ou bloqueiam entradas.</p>
      </div>

      <div className="flex items-start justify-between rounded-[6px] border border-gray-200 p-4">
        <div>
          <p className="text-sm font-medium text-gray-800">Bloquear acesso de associados inadimplentes</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Quando ativo, associados com mensalidade vencida têm o acesso negado automaticamente na catraca.
          </p>
        </div>
        <Toggle enabled={bloquearInadimplente} onChange={setBloquearInadimplente} />
      </div>

      <div className="rounded-[6px] border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">Tipo de acesso padrão</p>
        <p className="mt-0.5 mb-3 text-xs text-gray-500">Define se a credencial permite apenas uma entrada, reentrada ou acesso ilimitado no período.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "unica", label: "Entrada única" },
            { key: "reentrada", label: "Entrada e reentrada" },
            { key: "ilimitado", label: "Acesso ilimitado" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setReentrada(opt.key as typeof reentrada)}
              className={cn(
                "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
                reentrada === opt.key ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[6px] border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">Tolerância entre leituras (minutos)</p>
        <p className="mt-0.5 mb-3 text-xs text-gray-500">Tempo mínimo entre duas leituras da mesma credencial para evitar duplicidade.</p>
        <input
          type="number"
          value={tolerancia}
          onChange={(e) => setTolerancia(e.target.value)}
          className="h-9 w-24 rounded-[4px] border border-gray-300 px-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>
    </div>
  );
}
