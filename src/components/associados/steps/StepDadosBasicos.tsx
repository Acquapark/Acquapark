"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { AssociadoFormState } from "../form-types";
import { formatCEP, formatCPF, formatPhone } from "@/lib/utils";

export function StepDadosBasicos({
  form,
  update,
  disabled = false,
}: {
  form: AssociadoFormState;
  update: (patch: Partial<AssociadoFormState>) => void;
  disabled?: boolean;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-5">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-[6px] border border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-primary-400 hover:text-primary-500 cursor-pointer">
          <Camera size={20} />
          <span className="text-[10px] font-medium">Foto</span>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label required>Nome completo</Label>
            <Input
              value={form.nome}
              onChange={(e) => update({ nome: e.target.value })}
              placeholder="Nome completo do associado"
              disabled={disabled}
            />
          </div>
          <div>
            <Label required>CPF</Label>
            <Input
              value={form.cpf}
              onChange={(e) => update({ cpf: formatCPF(e.target.value) })}
              placeholder="000.000.000-00"
              maxLength={14}
              disabled={disabled}
            />
          </div>

          <div>
            <Label>RG</Label>
            <Input value={form.rg} onChange={(e) => update({ rg: e.target.value })} placeholder="00.000.000-0" disabled={disabled} />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.nascimento} onChange={(e) => update({ nascimento: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <Label>Sexo</Label>
            <Select value={form.sexo} onChange={(e) => update({ sexo: e.target.value })} disabled={disabled}>
              <option value="">Selecione</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Telefone</Label>
          <Input
            value={form.telefone}
            onChange={(e) => update({ telefone: formatPhone(e.target.value) })}
            placeholder="(00) 0000-0000"
            maxLength={15}
            disabled={disabled}
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            value={form.whatsapp}
            onChange={(e) => update({ whatsapp: formatPhone(e.target.value) })}
            placeholder="(00) 00000-0000"
            maxLength={15}
            disabled={disabled}
          />
        </div>
        <div>
          <Label required>E-mail</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="email@exemplo.com"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5">
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
              disabled={disabled}
            />
            {buscandoCep && <p className="mt-1 text-[11px] text-gray-400">Buscando endereço...</p>}
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={(e) => update({ endereco: e.target.value })} placeholder="Rua, avenida..." disabled={disabled} />
          </div>

          <div>
            <Label>Número</Label>
            <Input value={form.numero} onChange={(e) => update({ numero: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={(e) => update({ complemento: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={(e) => update({ bairro: e.target.value })} disabled={disabled} />
          </div>

          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => update({ cidade: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.estado} onChange={(e) => update({ estado: e.target.value })} maxLength={2} placeholder="UF" disabled={disabled} />
          </div>
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => update({ observacoes: e.target.value })}
          placeholder="Informações adicionais..."
          disabled={disabled}
        />
      </div>
    </div>
  );
}
