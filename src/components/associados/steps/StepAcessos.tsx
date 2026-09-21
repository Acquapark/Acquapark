"use client";

import { LogIn, LogOut, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { AcessoRegistro } from "@/types";
import { formatDate } from "@/lib/utils";

const tipoIcon = { Entrada: LogIn, Saída: LogOut, Reentrada: RotateCcw };

export function StepAcessos({ acessos }: { acessos: AcessoRegistro[] }) {
  const ultimo = acessos[0];
  const ultimaEntrada = acessos.find((a) => a.tipo === "Entrada");
  const ultimaSaida = acessos.find((a) => a.tipo === "Saída");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-gray-500">Total de acessos</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{acessos.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Último acesso</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{ultimo ? `${formatDate(ultimo.data)} ${ultimo.horario}` : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Última entrada</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{ultimaEntrada ? ultimaEntrada.horario : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Última saída</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{ultimaSaida ? ultimaSaida.horario : "—"}</p>
        </Card>
      </div>

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Data</Th>
            <Th>Horário</Th>
            <Th>Tipo</Th>
            <Th>Catraca</Th>
            <Th>Resultado</Th>
          </tr>
        </Thead>
        <Tbody>
          {acessos.length === 0 && <TableEmpty colSpan={5} message="Nenhum acesso registrado ainda." />}
          {acessos.map((a) => {
            const Icon = tipoIcon[a.tipo];
            return (
              <Tr key={a.id}>
                <Td>{formatDate(a.data)}</Td>
                <Td>{a.horario}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className="text-gray-400" />
                    {a.tipo}
                  </div>
                </Td>
                <Td>{a.catraca}</Td>
                <Td>
                  <div>
                    <StatusBadge status={a.resultado} map={StatusMaps.acesso} />
                    {a.motivo && <p className="mt-0.5 text-[11px] text-gray-400">{a.motivo}</p>}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}
