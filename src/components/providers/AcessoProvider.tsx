"use client";

import { createContext, useContext, useMemo } from "react";
import { AcessoUsuario, temAlgumaPermissao, temPermissao } from "@/lib/permissoes";

interface AcessoContexto {
  acesso: AcessoUsuario;
  /** O usuário tem esta permissão? (esconde botões — quem realmente barra é o servidor) */
  pode: (chave: string) => boolean;
  podeAlguma: (...chaves: string[]) => boolean;
}

const Contexto = createContext<AcessoContexto | null>(null);

export function AcessoProvider({ acesso, children }: { acesso: AcessoUsuario; children: React.ReactNode }) {
  const valor = useMemo<AcessoContexto>(
    () => ({
      acesso,
      pode: (chave) => temPermissao(acesso, chave),
      podeAlguma: (...chaves) => temAlgumaPermissao(acesso, chaves),
    }),
    [acesso],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAcesso() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAcesso precisa estar dentro de <AcessoProvider>.");
  return ctx;
}
