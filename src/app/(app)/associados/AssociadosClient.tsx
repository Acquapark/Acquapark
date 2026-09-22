"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AssociadoModal } from "@/components/associados/AssociadoModal";
import { Associado, AssociadoStatus, Plano } from "@/types";
import { deleteAssociado } from "./actions";
import { useAcesso } from "@/components/providers/AcessoProvider";

const PAGE_SIZE = 5;

export function AssociadosClient({ associados, planos }: { associados: Associado[]; planos: Plano[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssociadoStatus | "Todos">("Todos");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleConfirmDelete(id: string) {
    setDeletingId(id);
    setConfirmId(null);
    setDeleteError("");
    const result = await deleteAssociado(id);
    setDeletingId(null);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    router.refresh();
  }

  const filtered = useMemo(() => {
    return associados.filter((a) => {
      const matchesSearch =
        a.nome.toLowerCase().includes(search.toLowerCase()) || a.cpf.includes(search) || a.numero.includes(search);
      const matchesStatus = statusFilter === "Todos" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [associados, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Associados"
        subtitle={`${associados.length} associados cadastrados`}
        action={
          pode("associados.criar") ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Novo Associado
            </Button>
          ) : undefined
        }
      />

      {deleteError && (
        <div className="mb-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{deleteError}</div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
          <div className="relative w-72 max-w-full">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, CPF ou número..."
              className="h-8 w-full rounded-[4px] border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AssociadoStatus | "Todos");
                setPage(1);
              }}
              className="h-8 w-40"
            >
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Inativo">Inativo</option>
            </Select>
          </div>

          <span className="ml-auto text-xs text-gray-400">{filtered.length} resultado(s)</span>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Associado</Th>
              <Th>CPF</Th>
              <Th>Plano</Th>
              <Th>Status</Th>
              <Th>Mensalidade</Th>
              <Th>Vencimento</Th>
              <Th>Último acesso</Th>
              <Th className="w-10" />
            </tr>
          </Thead>
          <Tbody>
            {paginated.length === 0 && <TableEmpty colSpan={8} message="Nenhum associado encontrado." />}
            {paginated.map((a) => (
              <Tr key={a.id} onClick={() => router.push(`/associados/${a.id}`)}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                      {a.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{a.nome}</p>
                      <p className="text-xs text-gray-500">Nº {a.numero}</p>
                    </div>
                  </div>
                </Td>
                <Td>{a.cpf}</Td>
                <Td>{a.plano}</Td>
                <Td>
                  <StatusBadge status={a.status} map={StatusMaps.associado} />
                </Td>
                <Td>{formatCurrency(a.mensalidade)}</Td>
                <Td>{a.vencimento ? formatDate(a.vencimento) : "—"}</Td>
                <Td>{a.ultimoAcesso}</Td>
                <Td>
                  {!pode("associados.excluir") ? null : confirmId === a.id ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-danger-600">Excluir?</span>
                      <button
                        onClick={() => handleConfirmDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="rounded-[4px] bg-danger-600 px-2 py-1 text-xs font-medium text-white hover:bg-danger-700 disabled:opacity-50"
                      >
                        {deletingId === a.id ? "..." : "Sim"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-[4px] border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(a.id);
                      }}
                      title="Excluir associado"
                      className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <AssociadoModal open={modalOpen} onClose={() => setModalOpen(false)} planos={planos} />
    </div>
  );
}
