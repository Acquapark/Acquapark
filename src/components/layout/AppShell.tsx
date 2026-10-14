"use client";

import { useState, useSyncExternalStore } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Menu lateral recolhido (só ícones) no computador — preferência guardada no
 * navegador. useSyncExternalStore lê o localStorage sem divergir do HTML do
 * servidor (que sempre renderiza o menu aberto).
 */
const CHAVE_MENU_RECOLHIDO = "aquapark:menu-recolhido";
const ouvintes = new Set<() => void>();

function lerRecolhido() {
  try {
    return localStorage.getItem(CHAVE_MENU_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function gravarRecolhido(valor: boolean) {
  try {
    localStorage.setItem(CHAVE_MENU_RECOLHIDO, valor ? "1" : "0");
  } catch {
    // Navegador sem armazenamento (ex: aba anônima bloqueada): vale só nesta página.
  }
  ouvintes.forEach((o) => o());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const recolhido = useSyncExternalStore(assinar, lerRecolhido, () => false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        recolhido={recolhido}
        onAlternarRecolhido={() => gravarRecolhido(!recolhido)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
