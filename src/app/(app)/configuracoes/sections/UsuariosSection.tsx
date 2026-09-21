"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

const USUARIOS = [
  { nome: "Administrador Geral", email: "admin@aquapark.com.br", perfil: "Administrador", status: "Ativo" },
  { nome: "Bruna Martins", email: "bruna.martins@aquapark.com.br", perfil: "Gerente", status: "Ativo" },
  { nome: "Felipe Nogueira", email: "felipe.nogueira@aquapark.com.br", perfil: "Bilheteria", status: "Ativo" },
  { nome: "Larissa Prado", email: "larissa.prado@aquapark.com.br", perfil: "Recepção", status: "Inativo" },
  { nome: "Henrique Dias", email: "henrique.dias@aquapark.com.br", perfil: "Financeiro", status: "Ativo" },
];

export function UsuariosSection() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Usuários</h2>
        <Button size="sm">
          <Plus size={14} />
          Novo Usuário
        </Button>
      </div>

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Perfil</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {USUARIOS.map((u) => (
            <Tr key={u.email}>
              <Td className="font-medium text-gray-800">{u.nome}</Td>
              <Td>{u.email}</Td>
              <Td>{u.perfil}</Td>
              <Td>
                <Badge tone={u.status === "Ativo" ? "success" : "neutral"}>{u.status}</Badge>
              </Td>
              <Td>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm">
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm">
                    {u.status === "Ativo" ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
