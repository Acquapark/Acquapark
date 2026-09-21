"use client";

import { useState } from "react";
import { Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { AssociadoFormState } from "../form-types";
import { formatCPF, formatDate } from "@/lib/utils";
import { Dependente, Plano } from "@/types";

const emptyDependente = { nome: "", cpf: "", rg: "", nascimento: "", parentesco: "", sexo: "", observacoes: "" };

export function StepDependentes({
  form,
  update,
  planos,
}: {
  form: AssociadoFormState;
  update: (patch: Partial<AssociadoFormState>) => void;
  planos: Plano[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDependente);
  const [limitError, setLimitError] = useState("");

  const plano = planos.find((p) => p.id === form.planoId);
  const limite = plano?.dependentesPermitidos ?? null;
  const semPlano = !form.planoId;

  function handleAdd() {
    if (semPlano) {
      setLimitError("Selecione um plano na etapa anterior antes de adicionar dependentes.");
      return;
    }
    if (limite !== null && form.dependentes.length >= limite) {
      setLimitError(
        `O plano ${plano?.nome} permite no máximo ${limite} dependente(s). Remova um dependente ou altere o plano na etapa anterior.`,
      );
      return;
    }
    if (!draft.nome || !draft.parentesco) return;

    const novo: Dependente = {
      id: `dep-${Date.now()}`,
      nome: draft.nome,
      cpf: draft.cpf,
      parentesco: draft.parentesco,
      nascimento: draft.nascimento,
      status: "Ativo",
    };
    update({ dependentes: [...form.dependentes, novo] });
    setDraft(emptyDependente);
    setShowForm(false);
    setLimitError("");
  }

  function handleRemove(id: string) {
    update({ dependentes: form.dependentes.filter((d) => d.id !== id) });
    setLimitError("");
  }

  function handleOpenForm() {
    if (semPlano) {
      setLimitError("Selecione um plano na etapa anterior antes de adicionar dependentes.");
      return;
    }
    if (limite !== null && form.dependentes.length >= limite) {
      setLimitError(
        `O plano ${plano?.nome} permite no máximo ${limite} dependente(s). Remova um dependente ou altere o plano na etapa anterior.`,
      );
      return;
    }
    setLimitError("");
    setShowForm(true);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Dependentes vinculados</p>
          <p className="text-xs text-gray-500">
            {plano ? `Plano ${plano.nome} permite até ${limite} dependente(s).` : "Selecione um plano na etapa anterior para definir o limite de dependentes."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleOpenForm} disabled={semPlano}>
          <Plus size={14} />
          Adicionar Dependente
        </Button>
      </div>

      {limitError && (
        <div className="mb-3 rounded-[4px] border border-warning-600/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
          {limitError}
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
          {form.dependentes.length === 0 && (
            <TableEmpty colSpan={6} message="Nenhum dependente adicionado ainda." />
          )}
          {form.dependentes.map((d) => (
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
                <button
                  onClick={() => handleRemove(d.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-400 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 size={14} />
                </button>
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
              <Input value={draft.rg} onChange={(e) => setDraft({ ...draft, rg: e.target.value })} />
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
            <Button size="sm" onClick={handleAdd}>
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
