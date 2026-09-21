import { DoorOpen, DoorClosed, Users, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { catracas } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { getAcessosRecentes } from "@/lib/supabase/bilheteria";
import { CatracaCard } from "./CatracaCard";
import { QrValidator } from "./QrValidator";

export default async function ControleAcessoPage() {
  const supabase = await createClient();
  const acessosRecentes = await getAcessosRecentes(supabase, 8);

  return (
    <div>
      <PageHeader title="Controle de Acesso" subtitle="Monitoramento das catracas em tempo real" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Pessoas no parque" value="284" icon={Users} tone="primary" />
        <KpiCard label="Entradas hoje" value="412" icon={DoorOpen} tone="success" />
        <KpiCard label="Saídas hoje" value="128" icon={DoorClosed} tone="info" />
        <KpiCard label="Acessos negados hoje" value="6" icon={ShieldAlert} tone="danger" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Catracas" subtitle="Status dos equipamentos em operação" />
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {catracas.map((c) => (
                <CatracaCard key={c.id} catraca={c} />
              ))}
            </div>
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

        <QrValidator />
      </div>
    </div>
  );
}
