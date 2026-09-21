import { diasEntre } from "@/lib/datas-br";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 731;

/** Devolve a mensagem de erro, ou null quando o período é válido. */
export function validarPeriodo(de: string, ate: string): string | null {
  if (!DATA.test(de) || !DATA.test(ate)) return "Informe a data inicial e a data final.";
  if (de > ate) return "A data inicial não pode ser depois da data final.";
  if (diasEntre(de, ate) > MAX_DIAS) return "O período máximo é de 2 anos.";
  return null;
}
