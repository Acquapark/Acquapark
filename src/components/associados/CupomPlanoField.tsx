"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Label, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CupomPlano, descreverCupomPlano } from "@/lib/cupom-plano";
import { conferirCupomPlanoPainel } from "@/app/(app)/associados/actions";

/** Campo "Cupom de desconto" do plano no painel: confere o código e mostra o desconto. */
export function CupomPlanoField({ cupom, onChange }: { cupom: CupomPlano | null; onChange: (cupom: CupomPlano | null) => void }) {
  const [codigo, setCodigo] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState("");

  async function aplicar() {
    setConferindo(true);
    setErro("");
    const resultado = await conferirCupomPlanoPainel(codigo);
    setConferindo(false);
    if ("error" in resultado) {
      setErro(resultado.error);
      return;
    }
    onChange(resultado.cupom);
  }

  if (cupom) {
    return (
      <div>
        <Label>Cupom de desconto</Label>
        <div className="flex items-center gap-2 rounded-[4px] border border-success-600/30 bg-success-50 px-3 py-2 text-xs text-success-700">
          <CheckCircle2 size={14} />
          <span className="flex-1">
            <strong>{cupom.codigo}</strong> — {descreverCupomPlano(cupom)}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setCodigo("");
            }}
            title="Remover cupom"
            className="text-success-700 hover:text-success-900"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label>Cupom de desconto</Label>
      <div className="flex gap-2">
        <Input
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.toUpperCase());
            setErro("");
          }}
          placeholder="Código do cupom"
          className="uppercase"
        />
        <Button type="button" variant="secondary" onClick={aplicar} disabled={conferindo || !codigo.trim()}>
          {conferindo ? "..." : "Aplicar"}
        </Button>
      </div>
      {erro && <p className="mt-1 text-[11px] text-danger-600">{erro}</p>}
    </div>
  );
}
