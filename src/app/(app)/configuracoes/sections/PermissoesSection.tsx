"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PERFIS = ["Administrador", "Gerente", "Bilheteria", "Recepção", "Financeiro"];
const MODULOS = [
  "Dashboard",
  "Associados",
  "Bilheteria",
  "Controle de Acesso",
  "Financeiro",
  "Relatórios",
  "Configurações",
];

function defaultAccess(perfil: string, modulo: string) {
  if (perfil === "Administrador") return true;
  if (perfil === "Gerente") return modulo !== "Configurações";
  if (perfil === "Bilheteria") return ["Dashboard", "Bilheteria", "Controle de Acesso"].includes(modulo);
  if (perfil === "Recepção") return ["Dashboard", "Associados", "Controle de Acesso"].includes(modulo);
  if (perfil === "Financeiro") return ["Dashboard", "Financeiro", "Relatórios"].includes(modulo);
  return false;
}

export function PermissoesSection() {
  const [access, setAccess] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of PERFIS) for (const m of MODULOS) initial[`${p}:${m}`] = defaultAccess(p, m);
    return initial;
  });

  function toggle(key: string) {
    setAccess((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-gray-800">Permissões por Perfil</h2>
      <p className="mb-4 text-xs text-gray-500">Defina quais módulos cada nível de acesso pode utilizar.</p>

      <div className="overflow-x-auto rounded-[6px] border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Módulo
              </th>
              {PERFIS.map((p) => (
                <th key={p} className="whitespace-nowrap px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MODULOS.map((m) => (
              <tr key={m} className="bg-white">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-700">{m}</td>
                {PERFIS.map((p) => {
                  const key = `${p}:${m}`;
                  const enabled = access[key];
                  return (
                    <td key={key} className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggle(key)}
                        disabled={p === "Administrador"}
                        className={cn(
                          "mx-auto flex h-5 w-5 items-center justify-center rounded-[4px] border transition-colors",
                          enabled ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300 bg-white",
                          p === "Administrador" && "opacity-60",
                        )}
                      >
                        {enabled && <Check size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
