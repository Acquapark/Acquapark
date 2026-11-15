"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { formatCNPJ, formatPhone } from "@/lib/utils";
import { EmpresaParceira } from "@/types";
import { createEmpresaParceira, updateEmpresaParceira } from "@/app/(app)/empresas/actions";

export function EmpresaParceiraModal({ empresa, onClose }: { empresa: EmpresaParceira | null; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? "");
  const [contatoNome, setContatoNome] = useState(empresa?.contatoNome ?? "");
  const [telefone, setTelefone] = useState(empresa?.telefone ?? "");
  const [email, setEmail] = useState(empresa?.email ?? "");
  const [observacoes, setObservacoes] = useState(empresa?.observacoes ?? "");
  const [ativa, setAtiva] = useState(empresa?.ativa ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    const input = { nome, cnpj, contatoNome, telefone, email, observacoes, ativa };
    const resultado = empresa ? await updateEmpresaParceira(empresa.id, input) : await createEmpresaParceira(input);
    setSalvando(false);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader title={empresa ? "Editar empresa parceira" : "Nova empresa parceira"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Nome da empresa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Metalúrgica Silva" autoFocus />
            <p className="mt-1 text-[11px] text-gray-400">
              É este nome que aparece para o funcionário depois que ele digita o código no cadastro.
            </p>
          </div>
          {empresa ? (
            <div className="rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Código da empresa: <span className="font-mono text-sm font-semibold tracking-wider text-gray-900">{empresa.codigo}</span>
              <span className="block text-[11px] text-gray-500">Para trocar, use &ldquo;Gerar novo código&rdquo; no menu da empresa.</span>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">O código da empresa é gerado automaticamente ao salvar.</p>
          )}
          <div>
            <Label>CNPJ</Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Pessoa de contato</Label>
              <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="Quem cuida da parceria" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Condições combinadas, vigência da parceria..."
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            <span className="text-sm text-gray-700">
              Ativa
              <span className="block text-xs text-gray-500">
                Empresa inativa some da lista do cadastro pelo painel e o código dela deixa de ser aceito na internet. Os
                associados já vinculados continuam mostrando a empresa.
              </span>
            </span>
          </label>

          {erro && (
            <div className="rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{erro}</div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
