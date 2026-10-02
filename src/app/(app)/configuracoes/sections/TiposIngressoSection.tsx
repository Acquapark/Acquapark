"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { TiposIngressoManager } from "@/components/bilheteria/TiposIngressoManager";
import { Select } from "@/components/ui/Field";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { definirTipoCortesia } from "@/app/(app)/bilheteria/actions";
import { TipoIngresso } from "@/types";

export function TiposIngressoSection({ tipos, cortesiaTipoId }: { tipos: TipoIngresso[]; cortesiaTipoId: string | null }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [tipoCortesia, setTipoCortesia] = useState(cortesiaTipoId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const selecionado = tipos.find((t) => t.id === tipoCortesia);

  async function handleChange(novo: string) {
    const anterior = tipoCortesia;
    setTipoCortesia(novo);
    setSalvando(true);
    setError("");
    const result = await definirTipoCortesia(novo || null);
    setSalvando(false);
    if (result.error) {
      setTipoCortesia(anterior);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 rounded-[6px] border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <Gift size={18} className="mt-0.5 shrink-0 text-primary-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Cortesia mensal dos associados</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Todo associado ativo com plano pode resgatar 1 ingresso de cortesia por mês, pelo Portal ou pelo perfil dele no
              painel. Escolha o tipo de ingresso emitido na cortesia (o valor sai zerado). Sem tipo escolhido, o resgate fica
              indisponível.
            </p>
            <div className="mt-3 sm:w-80">
              <Select
                value={tipoCortesia}
                onChange={(e) => handleChange(e.target.value)}
                disabled={!pode("tipos_ingresso.editar") || salvando}
              >
                <option value="">Cortesia desligada</option>
                {tipos
                  .filter((t) => t.ativo || t.id === tipoCortesia)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {t.ativo ? "" : " (inativo)"}
                    </option>
                  ))}
              </Select>
            </div>
            {selecionado && !selecionado.ativo && (
              <p className="mt-1.5 text-xs text-warning-700">Este tipo está inativo: o resgate fica indisponível até ativá-lo.</p>
            )}
            {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
          </div>
        </div>
      </div>

      <TiposIngressoManager tipos={tipos} />
    </div>
  );
}
