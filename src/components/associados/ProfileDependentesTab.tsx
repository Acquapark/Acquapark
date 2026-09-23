"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatCPF, formatDate, formatRG } from "@/lib/utils";
import { Dependente, Plano } from "@/types";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { addDependente, removeDependente } from "@/app/(app)/associados/actions";

const emptyDraft = { nome: "", cpf: "", rg: "", nascimento: "", parentesco: "", sexo: "" };

export function ProfileDependentesTab({
  associadoId,
  dependentes,
  plano,
}: {
  associadoId: string;
  dependentes: Dependente[];
  plano: Plano | null;
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const limite = plano?.dependentesPermitidos ?? null;
  const semPlano = !plano;

  function handleOpenForm() {
    if (semPlano) {
      setError("Este associado ainda não tem um plano vinculado. Vincule um plano na aba \"Plano\" antes de adicionar dependentes.");
      return;
    }
    if (limite !== null && dependentes.length >= limite) {
      setError(
        `O plano ${plano?.nome} permite no máximo ${limite} dependente(s). Remova um dependente ou altere o plano do associado.`,
      );
      return;
    }
    setError("");
    setDraft(emptyDraft);
    setShowForm(true);
  }

  async function handleAdd() {
    if (semPlano) {
      setError("Este associado ainda não tem um plano vinculado. Vincule um plano na aba \"Plano\" antes de adicionar dependentes.");
      return;
    }
    if (limite !== null && dependentes.length >= limite) {
      setError(`O plano ${plano?.nome} permite no máximo ${limite} dependente(s).`);
      return;
    }
    if (!draft.nome || !draft.parentesco) {
      setError("Preencha ao menos nome e parentesco.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await addDependente(associadoId, draft);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    setDraft(emptyDraft);
    router.refresh();
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    await removeDependente(id, associadoId);
    setRemovingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Dependentes vinculados</p>
          <p className="text-xs text-gray-500">
            {plano ? `Plano ${plano.nome} permite até ${limite} dependente(s).` : "Vincule um plano ao associado para poder adicionar dependentes."}
          </p>
        </div>
        {pode("dependentes.criar") && (
          <Button size="sm" variant="secondary" onClick={handleOpenForm} disabled={semPlano}>
            <Plus size={14} />
            Adicionar Dependente
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-[4px] border border-warning-600/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
          {error}
        </div>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>CPF</Th>
            <Th>Parentesco</Th>
            <Th>Nascimento</Th>
            <Th>Status</Th>
            <Th className="w-10" />
          </tr>
        </Thead>
        <Tbody>
          {dependentes.length === 0 && <TableEmpty colSpan={6} message="Nenhum dependente cadastrado." />}
          {dependentes.map((d) => (
            <Tr key={d.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <UserRound size={14} className="text-gray-400" />
                  {d.nome}
                </div>
              </Td>
              <Td>{d.cpf || "—"}</Td>
              <Td>{d.parentesco}</Td>
              <Td>{d.nascimento ? formatDate(d.nascimento) : "—"}</Td>
              <Td>
                <Badge tone="success">{d.status}</Badge>
              </Td>
              <Td>
                {pode("dependentes.excluir") && (
                  <button
                    onClick={() => handleRemove(d.id)}
                    disabled={removingId === d.id}
                    className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-400 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {showForm && (
        <div className="mt-4 rounded-[6px] border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Novo dependente</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label required>Nome completo</Label>
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={draft.cpf} onChange={(e) => setDraft({ ...draft, cpf: formatCPF(e.target.value) })} maxLength={14} />
            </div>

            <div>
              <Label>RG</Label>
              <Input value={draft.rg} onChange={(e) => setDraft({ ...draft, rg: formatRG(e.target.value) })} maxLength={12} />
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={draft.nascimento} onChange={(e) => setDraft({ ...draft, nascimento: e.target.value })} />
            </div>
            <div>
              <Label required>Parentesco</Label>
              <Select value={draft.parentesco} onChange={(e) => setDraft({ ...draft, parentesco: e.target.value })}>
                <option value="">Selecione</option>
                <option value="Cônjuge">Cônjuge</option>
                <option value="Filho">Filho(a)</option>
                <option value="Pai">Pai</option>
                <option value="Mãe">Mãe</option>
                <option value="Outro">Outro</option>
              </Select>
            </div>

            <div>
              <Label>Sexo</Label>
              <Select value={draft.sexo} onChange={(e) => setDraft({ ...draft, sexo: e.target.value })}>
                <option value="">Selecione</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Outro">Outro</option>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
