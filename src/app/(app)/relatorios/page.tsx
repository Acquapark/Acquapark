import { hojeBR } from "@/lib/datas-br";
import { RelatoriosClient } from "./RelatoriosClient";

// As datas padrão dependem do dia de hoje: não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export default function RelatoriosPage() {
  const hoje = hojeBR();
  return <RelatoriosClient inicioPadrao={`${hoje.slice(0, 7)}-01`} fimPadrao={hoje} />;
}
