"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CONTRACT_VARIABLES, VariableDef } from "@/lib/contracts/variables";
import { Button } from "@/components/ui/Button";

const GROUP_ORDER: VariableDef["group"][] = ["Associado", "Plano", "Contrato", "Empresa", "Dependentes"];

export function InsertVariableMenu({ onInsert }: { onInsert: (key: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-block text-left"
      tabIndex={-1}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        Inserir variável
        <ChevronDown size={14} />
      </Button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-[6px] border border-gray-200 bg-white py-1 shadow-lg">
          {GROUP_ORDER.map((group) => (
            <div key={group}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group}</p>
              {CONTRACT_VARIABLES.filter((v) => v.group === group).map((v) => (
                <button
                  key={v.key}
                  onMouseDown={(e) => {
                    e.preventDefault(); // preserva a seleção/cursor no editor
                    onInsert(v.key);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                >
                  {v.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
