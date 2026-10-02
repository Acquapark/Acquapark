import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Confere os dígitos verificadores do CPF (aceita com ou sem máscara). */
export function isCPFValido(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digits[i]) * (tamanho + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(digits[tamanho])) return false;
  }
  return true;
}

export const RG_TAMANHO_MAXIMO = 20;

/**
 * RG não tem padrão nacional: o tamanho varia por estado (de 7 a 14 dígitos)
 * e alguns têm letras (ex: "MG-12.345.678"). Por isso não há máscara — só
 * maiúsculas e os caracteres que aparecem em RGs, como a pessoa digitar.
 */
export function formatRG(value: string) {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z.\-/ ]/g, "")
    .slice(0, RG_TAMANHO_MAXIMO);
}

/** As 27 unidades federativas, para as listas de UF dos formulários. */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCEP(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

/** Converte o que o usuário digitou ("1.234,56", "50,5", "50.5") em número. NaN se inválido. */
export function parseMoney(value: string): number {
  const raw = value.trim();
  if (!raw) return NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | Date) {
  // Datas "YYYY-MM-DD" (colunas `date` do Postgres) são interpretadas como UTC por
  // `new Date(string)`; formatá-las direto evita o dia deslocar em fusos negativos (ex: Brasil).
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
