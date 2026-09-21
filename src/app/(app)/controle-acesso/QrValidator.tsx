"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { validarCodigo, type ValidacaoResultado } from "./actions";

export function QrValidator() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [result, setResult] = useState<ValidacaoResultado | null>(null);
  const [validating, setValidating] = useState(false);

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || validating) return;
    setValidating(true);
    setResult(null);
    const resultado = await validarCodigo(codigo);
    setResult(resultado);
    setValidating(false);
    setCodigo("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Validação de QR Code" subtitle="Ingressos e credenciais de associados" />
      <form onSubmit={handleValidate} className="flex flex-col items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-32 w-32 items-center justify-center rounded-[6px] border-2 border-dashed",
            validating ? "border-primary-400 bg-primary-50" : "border-gray-300 bg-gray-50",
          )}
        >
          <ScanLine size={32} className={validating ? "animate-pulse text-primary-500" : "text-gray-400"} />
        </div>

        <div className="w-full">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Leia o QR Code ou digite o código"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Leitores de QR Code USB digitam o código aqui e confirmam com Enter.
          </p>
        </div>

        <Button type="submit" disabled={validating || !codigo.trim()} className="w-full">
          {validating ? "Validando..." : "Validar acesso"}
        </Button>

        {result && (
          <div
            className={cn(
              "w-full rounded-[6px] border px-4 py-3 text-center",
              result.autorizado ? "border-success-600/30 bg-success-50" : "border-danger-600/30 bg-danger-50",
            )}
          >
            {result.autorizado ? (
              <>
                <CheckCircle2 size={22} className="mx-auto text-success-600" />
                <p className="mt-1.5 text-sm font-semibold text-success-700">ACESSO AUTORIZADO</p>
                <p className="text-xs text-success-700">{result.titulo}</p>
                {result.detalhe && <p className="text-xs text-success-600">{result.detalhe}</p>}
              </>
            ) : (
              <>
                <XCircle size={22} className="mx-auto text-danger-600" />
                <p className="mt-1.5 text-sm font-semibold text-danger-700">ACESSO NEGADO</p>
                {result.titulo && <p className="text-xs text-danger-700">{result.titulo}</p>}
                <p className="text-xs text-danger-600">{result.motivo}</p>
              </>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
