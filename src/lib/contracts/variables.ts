import { Associado, Dependente, Plano } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface VariableDef {
  key: string; // e.g. "associado.nome" — used as {{associado.nome}}
  label: string;
  group: "Associado" | "Plano" | "Contrato" | "Empresa" | "Dependentes";
}

export const CONTRACT_VARIABLES: VariableDef[] = [
  { key: "associado.nome", label: "Nome completo", group: "Associado" },
  { key: "associado.cpf", label: "CPF", group: "Associado" },
  { key: "associado.rg", label: "RG", group: "Associado" },
  { key: "associado.data_nascimento", label: "Data de nascimento", group: "Associado" },
  { key: "associado.telefone", label: "Telefone", group: "Associado" },
  { key: "associado.email", label: "E-mail", group: "Associado" },
  { key: "associado.endereco", label: "Endereço", group: "Associado" },
  { key: "associado.numero", label: "Número", group: "Associado" },
  { key: "associado.bairro", label: "Bairro", group: "Associado" },
  { key: "associado.cidade", label: "Cidade", group: "Associado" },
  { key: "associado.estado", label: "Estado", group: "Associado" },
  { key: "associado.cep", label: "CEP", group: "Associado" },

  { key: "plano.nome", label: "Nome do plano", group: "Plano" },
  { key: "plano.valor", label: "Valor", group: "Plano" },
  { key: "plano.data_inicio", label: "Data de início", group: "Plano" },
  { key: "plano.data_vencimento", label: "Vencimento", group: "Plano" },

  { key: "contrato.numero", label: "Número", group: "Contrato" },
  { key: "contrato.data", label: "Data", group: "Contrato" },
  { key: "contrato.data_inicio", label: "Data de início", group: "Contrato" },
  { key: "contrato.data_fim", label: "Data de fim", group: "Contrato" },

  { key: "empresa.nome", label: "Nome", group: "Empresa" },
  { key: "empresa.razao_social", label: "Razão social", group: "Empresa" },
  { key: "empresa.cnpj", label: "CNPJ", group: "Empresa" },
  { key: "empresa.endereco", label: "Endereço", group: "Empresa" },
  { key: "empresa.numero", label: "Número", group: "Empresa" },
  { key: "empresa.bairro", label: "Bairro", group: "Empresa" },
  { key: "empresa.cidade", label: "Cidade", group: "Empresa" },
  { key: "empresa.estado", label: "Estado", group: "Empresa" },
  { key: "empresa.cep", label: "CEP", group: "Empresa" },
  { key: "empresa.telefone", label: "Telefone", group: "Empresa" },
  { key: "empresa.email", label: "E-mail", group: "Empresa" },

  { key: "dependentes", label: "Tabela de dependentes", group: "Dependentes" },
];

export interface Empresa {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  numeroEndereco: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface ContratoMeta {
  numero: string;
  data: string;
  dataInicio: string;
  dataFim: string;
}

export interface ContractData {
  associado: Associado;
  plano: Plano | null;
  empresa: Empresa;
  contrato: ContratoMeta;
}

const TOKEN_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

function safeDate(value: string) {
  if (!value) return "";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function resolveValue(key: string, data: ContractData): string {
  switch (key) {
    case "associado.nome":
      return data.associado.nome ?? "";
    case "associado.cpf":
      return data.associado.cpf ?? "";
    case "associado.rg":
      return data.associado.rg ?? "";
    case "associado.data_nascimento":
      return data.associado.nascimento ? safeDate(data.associado.nascimento) : "";
    case "associado.telefone":
      return data.associado.telefone ?? "";
    case "associado.email":
      return data.associado.email ?? "";
    case "associado.endereco":
      return data.associado.endereco ?? "";
    case "associado.numero":
      return data.associado.numeroEndereco ?? "";
    case "associado.bairro":
      return data.associado.bairro ?? "";
    case "associado.cidade":
      return data.associado.cidade ?? "";
    case "associado.estado":
      return data.associado.estado ?? "";
    case "associado.cep":
      return data.associado.cep ?? "";

    case "plano.nome":
      return data.plano?.nome ?? "";
    case "plano.valor":
      return data.plano ? formatCurrency(data.plano.valor) : "";
    case "plano.data_inicio":
      return safeDate(data.contrato.dataInicio);
    case "plano.data_vencimento":
      return data.associado.vencimento ? safeDate(data.associado.vencimento) : "";

    case "contrato.numero":
      return data.contrato.numero ?? "";
    case "contrato.data":
      return safeDate(data.contrato.data);
    case "contrato.data_inicio":
      return safeDate(data.contrato.dataInicio);
    case "contrato.data_fim":
      return data.contrato.dataFim ? safeDate(data.contrato.dataFim) : "";

    case "empresa.nome":
      return data.empresa.nome ?? "";
    case "empresa.razao_social":
      return data.empresa.razaoSocial ?? "";
    case "empresa.cnpj":
      return data.empresa.cnpj ?? "";
    case "empresa.endereco":
      return data.empresa.endereco ?? "";
    case "empresa.numero":
      return data.empresa.numeroEndereco ?? "";
    case "empresa.bairro":
      return data.empresa.bairro ?? "";
    case "empresa.cidade":
      return data.empresa.cidade ?? "";
    case "empresa.estado":
      return data.empresa.estado ?? "";
    case "empresa.cep":
      return data.empresa.cep ?? "";
    case "empresa.telefone":
      return data.empresa.telefone ?? "";
    case "empresa.email":
      return data.empresa.email ?? "";

    default:
      return "";
  }
}

function dependentesTableHtml(dependentes: Dependente[]): string {
  if (dependentes.length === 0) {
    return "<p><em>Nenhum dependente vinculado.</em></p>";
  }
  const rows = dependentes
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.nome)}</td><td>${escapeHtml(d.cpf || "—")}</td><td>${escapeHtml(d.parentesco)}</td></tr>`,
    )
    .join("");
  return `<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><thead><tr><th>Nome</th><th>CPF</th><th>Parentesco</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Retorna a lista de variáveis (associado.* e plano.*) usadas no template cujo valor resolvido está vazio. */
export function findMissingVariables(templateHtml: string, data: ContractData): VariableDef[] {
  const used = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_REGEX);
  while ((match = regex.exec(templateHtml)) !== null) {
    used.add(match[1]);
  }

  const missing: VariableDef[] = [];
  used.forEach((key) => {
    if (key === "dependentes") return;
    if (!key.startsWith("associado.") && !key.startsWith("plano.") && !key.startsWith("contrato.")) return;
    const value = resolveValue(key, data);
    if (!value) {
      const def = CONTRACT_VARIABLES.find((v) => v.key === key);
      if (def) missing.push(def);
    }
  });
  return missing;
}

/** Substitui todos os tokens {{...}} do template pelos valores reais. */
export function substituteVariables(templateHtml: string, data: ContractData): string {
  return templateHtml.replace(TOKEN_REGEX, (_, key: string) => {
    if (key === "dependentes") return dependentesTableHtml(data.associado.dependentes);
    return resolveValue(key, data) || `<span style="color:#dc2626">[${key}]</span>`;
  });
}
