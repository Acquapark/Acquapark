import { Card, CardHeader } from "@/components/ui/Card";
import { CONTRACT_VARIABLES, VariableDef } from "@/lib/contracts/variables";

const GROUP_ORDER: VariableDef["group"][] = ["Associado", "Plano", "Contrato", "Empresa", "Dependentes"];

export function VariaveisTab() {
  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    items: CONTRACT_VARIABLES.filter((v) => v.group === group),
  }));

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Variáveis disponíveis para uso nos modelos de contrato. Insira-as no editor pelo botão{" "}
        <span className="font-medium text-gray-700">Inserir variável</span> — não é necessário decorar a sintaxe.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byGroup.map(({ group, items }) => (
          <Card key={group}>
            <CardHeader title={group} />
            <div className="divide-y divide-gray-100">
              {items.map((v) => (
                <div key={v.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-700">{v.label}</span>
                  <code className="rounded-[4px] bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{`{{${v.key}}}`}</code>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
