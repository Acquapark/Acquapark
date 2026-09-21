"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Label, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Empresa } from "@/lib/contracts/variables";
import { saveEmpresa } from "@/app/(app)/contratos/actions";
import { formatCEP } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";

export function DadosParqueSection({ empresa }: { empresa: Empresa }) {
  const { pode } = useAcesso();
  const [form, setForm] = useState(empresa);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  function update(patch: Partial<Empresa>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        update({
          endereco: data.logradouro ?? "",
          bairro: data.bairro ?? "",
          cidade: data.localidade ?? "",
          estado: data.uf ?? "",
        });
      }
    } catch {
      // silencioso — usuário pode preencher manualmente
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    const result = await saveEmpresa(form);
    setSaving(false);
    if (!result.error) {
      setSavedMsg("Dados salvos com sucesso.");
      setTimeout(() => setSavedMsg(""), 3000);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-gray-800">Dados do Parque</h2>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[6px] border border-dashed border-gray-300 bg-gray-50 text-gray-400">
          <Building2 size={22} />
        </div>
        <div>
          <Button variant="secondary" size="sm" disabled>
            Alterar logo
          </Button>
          <p className="mt-1 text-[11px] text-gray-400">PNG ou SVG, fundo transparente recomendado.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>Nome do parque</Label>
          <Input value={form.nome} onChange={(e) => update({ nome: e.target.value })} />
        </div>
        <div>
          <Label>Razão social</Label>
          <Input value={form.razaoSocial} onChange={(e) => update({ razaoSocial: e.target.value })} />
        </div>
        <div>
          <Label required>CNPJ</Label>
          <Input value={form.cnpj} onChange={(e) => update({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.telefone} onChange={(e) => update({ telefone: e.target.value })} placeholder="(00) 0000-0000" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="contato@aquapark.com.br" />
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Endereço</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>CEP</Label>
            <Input
              value={form.cep}
              onChange={(e) => update({ cep: formatCEP(e.target.value) })}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              maxLength={9}
            />
            {buscandoCep && <p className="mt-1 text-[11px] text-gray-400">Buscando endereço...</p>}
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={(e) => update({ endereco: e.target.value })} placeholder="Rua, avenida..." />
          </div>

          <div>
            <Label>Número</Label>
            <Input value={form.numeroEndereco} onChange={(e) => update({ numeroEndereco: e.target.value })} />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={(e) => update({ complemento: e.target.value })} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={(e) => update({ bairro: e.target.value })} />
          </div>

          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => update({ cidade: e.target.value })} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.estado} onChange={(e) => update({ estado: e.target.value })} maxLength={2} placeholder="UF" />
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        Esses dados são usados nas variáveis {"{{empresa.*}}"} ao gerar contratos.
      </p>

      <div className="mt-5 flex items-center justify-end gap-3">
        {savedMsg && <span className="text-xs font-medium text-success-600">{savedMsg}</span>}
        {pode("parque.editar") && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        )}
      </div>
    </div>
  );
}
