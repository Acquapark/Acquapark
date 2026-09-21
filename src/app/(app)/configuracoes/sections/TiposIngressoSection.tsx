"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td } from "@/components/ui/Table";
import { tiposIngresso } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export function TiposIngressoSection() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Tipos de Ingresso</h2>
        <Button size="sm">
          <Plus size={14} />
          Novo Tipo
        </Button>
      </div>

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>Descrição</Th>
            <Th>Valor</Th>
            <Th>Validade</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {tiposIngresso.map((t) => (
            <Tr key={t.id}>
              <Td className="font-medium text-gray-800">{t.nome}</Td>
              <Td className="max-w-xs whitespace-normal text-gray-500">{t.descricao}</Td>
              <Td>{formatCurrency(t.valor)}</Td>
              <Td>{t.validade}</Td>
              <Td>
                <Button variant="secondary" size="sm">
                  Editar
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
