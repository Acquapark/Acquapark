"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { EmpresaParceiraModal } from "@/components/empresas/EmpresaParceiraModal";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { EmpresaParceira } from "@/types";
import { deleteEmpresaParceira } from "./actions";

type FiltroSituacao = "todas" | "ativas" | "inativas";

export function EmpresasClient({ empresas }: { empresas: EmpresaParceira[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [modal, setModal] = useState<{ empresa: EmpresaParceira | null } | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<EmpresaParceira | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "erro" | "ok"; texto: string } | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = busca.replace(/\D/g, "");
    return empresas.filter((e) => {
      const casaBusca =
        !termo ||
        e.nome.toLowerCase().includes(termo) ||
        e.contatoNome.toLowerCase().includes(termo) ||
        (digitos.length > 0 && e.cnpj.replace(/\D/g, "").includes(digitos));
      const casaSituacao = situacao === "todas" || (situacao === "ativas" ? e.ativa : !e.ativa);
      return casaBusca && casaSituacao;
    });
  }, [empresas, busca, situacao]);

  const totalAssociados = empresas.reduce((s, e) => s + e.totalAssociados, 0);

  async function excluir(empresa: EmpresaParceira) {
    setExcluindo(true);
    setMensagem(null);
    const resultado = await deleteEmpresaParceira(empresa.id);
    setExcluindo(false);
    setConfirmarExclusao(null);
    if (resultado.error) {
      setMensagem({ tom: "erro", texto: resultado.error });
      return;
    }
    setMensagem({ tom: "ok", texto: `Empresa "${empresa.nome}" excluída.` });
    router.refresh();
  }

  function itensDoMenu(empresa: EmpresaParceira): RowMenuItem[] {
    const itens: RowMenuItem[] = [];
    if (pode("associados.visualizar")) {
      itens.push({ label: "Ver associados", onClick: () => router.push(`/associados?empresa=${empresa.id}`) });
    }
    if (pode("empresas_parceiras.editar")) itens.push({ label: "Editar", onClick: () => setModal({ empresa }) });
    if (pode("empresas_parceiras.excluir")) {
      itens.push({ label: "Excluir", destructive: true, onClick: () => setConfirmarExclusao(empresa) });
    }
    return itens;
  }

  return (
    <div>
      <PageHeader
        title="Empresas Parceiras"
        subtitle={`${empresas.length} empresa(s) · ${totalAssociados} associado(s) vinculado(s)`}
        action={
          pode("empresas_parceiras.criar") ? (
            <Button onClick={() => setModal({ empresa: null })}>
              <Plus size={16} />
              Nova Empresa
            </Button>
          ) : undefined
        }
      />

      {mensagem && (
        <div
          className={`mb-4 rounded-[4px] border px-3 py-2 text-xs ${
            mensagem.tom === "erro"
              ? "border-danger-600/30 bg-danger-50 text-danger-700"
              : "border-success-600/30 bg-success-50 text-success-700"
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      {confirmarExclusao && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          <span>
            Excluir a empresa <strong>{confirmarExclusao.nome}</strong>? Esta ação não pode ser desfeita.
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirmarExclusao(null)} disabled={excluindo}>
              Não
            </Button>
            <Button size="sm" variant="destructive" onClick={() => excluir(confirmarExclusao)} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Sim, excluir"}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
          <div className="relative w-72 max-w-full">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou contato..."
              className="h-8 w-full rounded-[4px] border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <Select value={situacao} onChange={(e) => setSituacao(e.target.value as FiltroSituacao)} className="h-8 w-40">
            <option value="todas">Todas</option>
            <option value="ativas">Só ativas</option>
            <option value="inativas">Só inativas</option>
          </Select>
          <span className="ml-auto text-xs text-gray-400">{filtradas.length} resultado(s)</span>
        </div>

        <Table>
          <Thead>
            <tr>
              <Th>Empresa</Th>
              <Th>CNPJ</Th>
              <Th>Contato</Th>
              <Th>Associados</Th>
              <Th>Situação</Th>
              <Th className="w-10" />
            </tr>
          </Thead>
          <Tbody>
            {filtradas.length === 0 && (
              <TableEmpty
                colSpan={6}
                message={empresas.length === 0 ? "Nenhuma empresa parceira cadastrada ainda." : "Nenhuma empresa encontrada."}
              />
            )}
            {filtradas.map((e) => {
              const itens = itensDoMenu(e);
              return (
                <Tr key={e.id}>
                  <Td>
                    <p className="font-medium text-gray-800">{e.nome}</p>
                    {e.observacoes && <p className="max-w-xs truncate text-xs text-gray-500">{e.observacoes}</p>}
                  </Td>
                  <Td>{e.cnpj || "—"}</Td>
                  <Td>
                    {e.contatoNome || e.telefone || e.email ? (
                      <div className="text-xs">
                        {e.contatoNome && <p className="text-gray-700">{e.contatoNome}</p>}
                        {e.telefone && <p className="text-gray-500">{e.telefone}</p>}
                        {e.email && <p className="text-gray-500">{e.email}</p>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {e.totalAssociados > 0 && pode("associados.visualizar") ? (
                      <button
                        onClick={() => router.push(`/associados?empresa=${e.id}`)}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {e.totalAssociados}
                      </button>
                    ) : (
                      e.totalAssociados
                    )}
                  </Td>
                  <Td>
                    <Badge tone={e.ativa ? "success" : "neutral"}>{e.ativa ? "Ativa" : "Inativa"}</Badge>
                  </Td>
                  <Td>{itens.length > 0 && <RowMenu items={itens} />}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>

      {modal && (
        <EmpresaParceiraModal
          key={modal.empresa?.id ?? "nova"}
          empresa={modal.empresa}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
