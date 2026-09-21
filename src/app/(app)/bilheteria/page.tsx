"use client";

import { useState } from "react";
import { Plus, Ticket as TicketIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { ingressos, tiposIngresso } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function BilheteriaPage() {
  const [tab, setTab] = useState<"ingressos" | "tipos">("ingressos");

  return (
    <div>
      <PageHeader
        title="Bilheteria"
        subtitle="Venda de ingressos avulsos e gestão de tipos de ingresso"
        action={
          <Button>
            <Plus size={16} />
            {tab === "ingressos" ? "Nova Venda" : "Novo Tipo de Ingresso"}
          </Button>
        }
      />

      <Card>
        <div className="px-4">
          <Tabs
            tabs={[
              { key: "ingressos", label: "Ingressos" },
              { key: "tipos", label: "Tipos de Ingresso" },
            ]}
            active={tab}
            onChange={(k) => setTab(k as "ingressos" | "tipos")}
          />
        </div>

        {tab === "ingressos" ? (
          <Table>
            <Thead>
              <tr>
                <Th>Número</Th>
                <Th>Tipo</Th>
                <Th>Comprador</Th>
                <Th>Data de utilização</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </Thead>
            <Tbody>
              {ingressos.length === 0 && <TableEmpty colSpan={7} message="Nenhum ingresso emitido." />}
              {ingressos.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <div className="flex items-center gap-1.5 font-medium text-gray-800">
                      <TicketIcon size={13} className="text-gray-400" />
                      {i.numero}
                    </div>
                  </Td>
                  <Td>{i.tipo}</Td>
                  <Td>{i.comprador}</Td>
                  <Td>{formatDate(i.dataUtilizacao)}</Td>
                  <Td>{formatCurrency(i.valor)}</Td>
                  <Td>
                    <StatusBadge status={i.status} map={StatusMaps.ingresso} />
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm">
                        QR Code
                      </Button>
                      {i.status === "Disponível" && (
                        <Button variant="ghost" size="sm">
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Table>
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
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm">
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm">
                        Desativar
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
