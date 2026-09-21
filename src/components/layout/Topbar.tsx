"use client";

import { Bell, Menu, Search } from "lucide-react";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
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
        <div className="hidden items-center gap-2 border-l border-gray-200 pl-3 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            AD
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-gray-800">Administrador</p>
            <p className="text-[11px] text-gray-400">Acesso total</p>
          </div>
        </div>
      </div>
    </header>
  );
}
