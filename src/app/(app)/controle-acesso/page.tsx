import { DoorOpen, DoorClosed, Users, ShieldAlert, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { getAcessosRecentes } from "@/lib/supabase/bilheteria";
import { getAcessosHoje, getCatracas } from "@/lib/supabase/acessos";
import { getAcessoAtual } from "@/lib/auth/acesso-atual";
import { temPermissao } from "@/lib/permissoes";
import { CatracaCard } from "./CatracaCard";
import { QrValidator } from "./QrValidator";
import { AutoRefresh } from "./AutoRefresh";

const qtd = (n: number, singular: string, plural: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;

// Os KPIs são "de hoje" — não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

export default async function ControleAcessoPage() {
  const supabase = await createClient();
  const podeValidar = temPermissao(await getAcessoAtual(), "controle_acesso.validar");
  const [acessosRecentes, acessosHoje, catracas] = await Promise.all([
    getAcessosRecentes(supabase, 8),
    getAcessosHoje(supabase),
    getCatracas(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Controle de Acesso" subtitle="Monitoramento das catracas em tempo real" />

      <AutoRefresh intervaloSegundos={30} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Associados que entraram hoje"
          value={acessosHoje.associados.toLocaleString("pt-BR")}
          icon={UserCheck}
          tone="success"
          hint={
            acessosHoje.acessosAssociados === acessosHoje.associados
              ? "Entradas autorizadas de hoje"
              : `${qtd(acessosHoje.acessosAssociados, "acesso", "acessos")}, contando reentradas`
          }
        />
        <KpiCard
          label="Pessoas no parque"
          value={acessosHoje.pessoasNoParque.toLocaleString("pt-BR")}
          icon={Users}
          tone="primary"
          hint="Entradas menos saídas hoje"
        />
        <KpiCard
          label="Entradas hoje"
          value={acessosHoje.entradas.total.toLocaleString("pt-BR")}
          icon={DoorOpen}
          tone="success"
          hint={[
            `${acessosHoje.entradas.ingressos.toLocaleString("pt-BR")} de ingressos`,
            `${acessosHoje.entradas.associados.toLocaleString("pt-BR")} de associados`,
            ...(acessosHoje.entradas.reentradas > 0 ? [qtd(acessosHoje.entradas.reentradas, "reentrada", "reentradas")] : []),
          ].join(" · ")}
        />
        <KpiCard label="Saídas hoje" value={acessosHoje.saidas.toLocaleString("pt-BR")} icon={DoorClosed} tone="info" />
        <KpiCard
          label="Acessos negados hoje"
          value={acessosHoje.negados.total.toLocaleString("pt-BR")}
          icon={ShieldAlert}
          tone="danger"
          hint={
            acessosHoje.negados.total === 0
              ? "Nenhum acesso barrado hoje"
              : [
                  qtd(acessosHoje.negados.negados, "negado", "negados"),
                  qtd(acessosHoje.negados.bloqueados, "bloqueado", "bloqueados"),
                ].join(" · ")
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Catracas" subtitle="Status dos equipamentos em operação" />
            {catracas.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma catraca cadastrada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {catracas.map((c) => (
                  <CatracaCard key={c.id} catraca={c} />
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <CardHeader title="Últimos acessos" />
            <div className="divide-y divide-gray-100">
              {acessosRecentes.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum acesso registrado ainda.</p>
              )}
              {acessosRecentes.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{a.quem}</p>
                    <p className="text-xs text-gray-500">
                      {a.origem} · {a.tipo} ·{" "}
                      <span className={a.resultado === "Autorizado" ? "text-success-700" : "text-danger-600"}>
                        {a.resultado}
                      </span>
                      {a.motivo ? ` — ${a.motivo}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(a.registradoEm).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {podeValidar && <QrValidator />}
      </div>
    </div>
  );
}
