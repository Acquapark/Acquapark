"use client";

import { useState } from "react";
import { CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Result =
  | { kind: "autorizado"; nome: string; detalhe: string }
  | { kind: "negado"; motivo: string }
  | null;

const SCENARIOS: Result[] = [
  { kind: "autorizado", nome: "João da Silva", detalhe: "Associado — Plano Familiar" },
  { kind: "negado", motivo: "Associação inadimplente." },
  { kind: "negado", motivo: "Credencial expirada." },
  { kind: "autorizado", nome: "Ingresso ING-10236", detalhe: "Ingresso — Diária Família" },
];

export function QrValidator() {
  const [result, setResult] = useState<Result>(null);
  const [scanning, setScanning] = useState(false);

  function simulate() {
    setScanning(true);
    setResult(null);
    setTimeout(() => {
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      setResult(scenario);
      setScanning(false);
    }, 700);
  }

  return (
    <Card>
      <CardHeader title="Validação de QR Code" subtitle="Simulação de leitura na catraca" />
      <div className="flex flex-col items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-32 w-32 items-center justify-center rounded-[6px] border-2 border-dashed",
            scanning ? "border-primary-400 bg-primary-50" : "border-gray-300 bg-gray-50",
          )}
        >
          <ScanLine size={32} className={scanning ? "animate-pulse text-primary-500" : "text-gray-400"} />
        </div>

        <Button onClick={simulate} disabled={scanning} className="w-full">
          {scanning ? "Lendo credencial..." : "Simular leitura de QR Code"}
        </Button>

        {result && (
          <div
            className={cn(
              "w-full rounded-[6px] border px-4 py-3 text-center",
              result.kind === "autorizado" ? "border-success-600/30 bg-success-50" : "border-danger-600/30 bg-danger-50",
            )}
          >
            {result.kind === "autorizado" ? (
              <>
                <CheckCircle2 size={22} className="mx-auto text-success-600" />
                <p className="mt-1.5 text-sm font-semibold text-success-700">ACESSO AUTORIZADO</p>
                <p className="text-xs text-success-700">{result.nome}</p>
                <p className="text-xs text-success-600">{result.detalhe}</p>
              </>
            ) : (
              <>
                <XCircle size={22} className="mx-auto text-danger-600" />
                <p className="mt-1.5 text-sm font-semibold text-danger-700">ACESSO NEGADO</p>
                <p className="text-xs text-danger-600">{result.motivo}</p>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
