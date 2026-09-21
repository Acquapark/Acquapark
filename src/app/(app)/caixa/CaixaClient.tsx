"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, MinusCircle, PlusCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Caixa, CaixaMovimentoTipo, CaixaResumo } from "@/types";
import { CaixaResumoView } from "@/components/caixa/CaixaResumoView";
import {
  AbrirCaixaModal,
  DetalheCaixaModal,
  FecharCaixaModal,
  MovimentoModal,
} from "@/components/caixa/CaixaModals";
import { reabrirCaixa } from "./actions";

export function CaixaClient({ resumoAberto, historico }: { resumoAberto: CaixaResumo | null; historico: Caixa[] }) {
  const router = useRouter();
  const [abrirOpen, setAbrirOpen] = useState(false);
  const [movTipo, setMovTipo] = useState<CaixaMovimentoTipo | null>(null);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [reabrindoId, setReabrindoId] = useState<string | null>(null);
  const [reabrirSaving, setReabrirSaving] = useState(false);
  const [error, setError] = useState("");

  const aberto = resumoAberto?.caixa ?? null;

  async function handleReabrir(id: string) {
    setReabrirSaving(true);
    setError("");
    const result = await reabrirCaixa(id);
    setReabrirSaving(false);
    setReabrindoId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Caixa"
        subtitle="Abertura, fechamento e movimentações do caixa"
        action={
          !aberto ? (
            <Button onClick={() => setAbrirOpen(true)}>
              <LockOpen size={16} />
              Abrir caixa
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}

      {aberto && resumoAberto ? (
        <div className="mb-6">
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">Caixa {aberto.numero}</h2>
                  <Badge tone="success">Aberto</Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Aberto em {formatDateTime(aberto.abertoEm)} por {aberto.operadorNome}
                  {aberto.reaberturas > 0 && ` · reaberto ${aberto.reaberturas}x`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setMovTipo("Suprimento")}>
                  <PlusCircle size={14} />
                  Suprimento
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMovTipo("Sangria")}>
                  <MinusCircle size={14} />
                  Sangria
                </Button>
                <Button size="sm" onClick={() => setFecharOpen(true)}>
                  <Lock size={14} />
                  Fechar caixa
                </Button>
              </div>
            </div>
          </Card>

          <CaixaResumoView resumo={resumoAberto} />
        </div>
      ) : (
        <Card className="mb-6">
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Lock size={22} />
            </div>
            <p className="text-sm font-semibold text-gray-800">Nenhum caixa aberto</p>
            <p className="max-w-sm text-xs text-gray-500">
              Abra o caixa para começar a vender ingressos. Sem um caixa aberto a Bilheteria fica bloqueada.
            </p>
            <Button className="mt-2" onClick={() => setAbrirOpen(true)}>
              <LockOpen size={16} />
              Abrir caixa
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Histórico de caixas" subtitle="Últimos caixas de todos os operadores" />
        <Table>
          <Thead>
            <tr>
              <Th>Caixa</Th>
              <Th>Operador</Th>
              <Th>Abertura</Th>
              <Th>Fechamento</Th>
              <Th>Esperado</Th>
              <Th>Contado</Th>
              <Th>Diferença</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </Thead>
          <Tbody>
            {historico.length === 0 && <TableEmpty colSpan={9} message="Nenhum caixa aberto até agora." />}
            {historico.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium text-gray-800">{c.numero}</Td>
                <Td>{c.operadorNome}</Td>
                <Td>{formatDateTime(c.abertoEm)}</Td>
                <Td>{c.fechadoEm ? formatDateTime(c.fechadoEm) : "—"}</Td>
                <Td>{c.valorEsperado !== null ? formatCurrency(c.valorEsperado) : "—"}</Td>
                <Td>{c.valorContado !== null ? formatCurrency(c.valorContado) : "—"}</Td>
                <Td
                  className={
                    c.diferenca === null ? "" : c.diferenca === 0 ? "text-success-700" : "font-medium text-danger-600"
                  }
                >
                  {c.diferenca !== null ? formatCurrency(c.diferenca) : "—"}
                </Td>
                <Td>
                  <Badge tone={c.status === "Aberto" ? "success" : "neutral"}>{c.status}</Badge>
                </Td>
                <Td>
                  {reabrindoId === c.id ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-warning-700">Reabrir?</span>
                      <button
                        onClick={() => handleReabrir(c.id)}
                        disabled={reabrirSaving}
                        className="font-semibold text-primary-700 hover:underline disabled:opacity-50"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setReabrindoId(null)}
                        disabled={reabrirSaving}
                        className="text-gray-500 hover:underline"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setDetalheId(c.id)}>
                        Detalhes
                      </Button>
                      {c.status === "Fechado" && (
                        <Button variant="ghost" size="sm" onClick={() => setReabrindoId(c.id)}>
                          <RotateCcw size={13} />
                          Reabrir
                        </Button>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      <AbrirCaixaModal open={abrirOpen} onClose={() => setAbrirOpen(false)} />
      {aberto && resumoAberto && movTipo && (
        <MovimentoModal
          key={movTipo}
          open
          onClose={() => setMovTipo(null)}
          tipo={movTipo}
          caixa={aberto}
          dinheiroEmCaixa={resumoAberto.dinheiroEsperado}
        />
      )}
      {aberto && resumoAberto && fecharOpen && (
        <FecharCaixaModal
          open
          onClose={() => setFecharOpen(false)}
          caixa={aberto}
          dinheiroEsperado={resumoAberto.dinheiroEsperado}
        />
      )}
      <DetalheCaixaModal caixaId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
