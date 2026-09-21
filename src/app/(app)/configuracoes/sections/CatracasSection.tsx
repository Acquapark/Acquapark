"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { catracas } from "@/lib/mock-data";
import { useAcesso } from "@/components/providers/AcessoProvider";

export function CatracasSection() {
  const { pode } = useAcesso();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Catracas</h2>
        {pode("catracas.criar") && (
          <Button size="sm">
            <Plus size={14} />
            Nova Catraca
          </Button>
        )}
      </div>

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>Local</Th>
            <Th>Tipo</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {catracas.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium text-gray-800">{c.nome}</Td>
              <Td>{c.local}</Td>
              <Td>{c.tipo}</Td>
              <Td>
                <Badge tone={c.status === "Online" ? "success" : c.status === "Offline" ? "danger" : "warning"}>{c.status}</Badge>
              </Td>
              <Td>
                {pode("catracas.editar") && (
                  <Button variant="secondary" size="sm">
                    Configurar
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
