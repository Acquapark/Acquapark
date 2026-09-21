import { DoorOpen, DoorClosed, Users, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { catracas, associados } from "@/lib/mock-data";
import { CatracaCard } from "./CatracaCard";
import { QrValidator } from "./QrValidator";

export default function ControleAcessoPage() {
  const acessosRecentes = associados
    .flatMap((a) => a.acessos.map((ac) => ({ ...ac, associado: a.nome })))
    .slice(0, 8);

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
              {acessosRecentes.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{a.associado}</p>
                    <p className="text-xs text-gray-500">
                      {a.tipo} · {a.catraca}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{a.horario}</span>
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
