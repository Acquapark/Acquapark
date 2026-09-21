"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAcesso } from "@/components/providers/AcessoProvider";

function iniciais(nome: string) {
  const partes = nome.trim().split(/s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { acesso } = useAcesso();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function sair() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="relative w-full max-w-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar associado, ingresso, contrato..."
            className="h-8 w-full rounded-[4px] border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button className="relative flex h-8 w-8 items-center justify-center rounded-[4px] text-gray-500 hover:bg-gray-100">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-600" />
        </button>
        <div ref={menuRef} className="relative border-l border-gray-200 pl-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-[4px] py-0.5 pr-1 text-left hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
              {iniciais(acesso.nome)}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-40 truncate text-xs font-medium text-gray-800">{acesso.nome}</p>
              <p className="max-w-40 truncate text-[11px] text-gray-400">{acesso.grupoNome ?? "Sem grupo"}</p>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-[6px] border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="truncate text-xs font-medium text-gray-800">{acesso.nome}</p>
                <p className="truncate text-[11px] text-gray-400">{acesso.email}</p>
              </div>
              <button
                type="button"
                onClick={sair}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
