"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Ticket,
  ScanLine,
  Wallet,
  FileSignature,
  BarChart3,
  Settings,
  Waves,
  X,
  Building2,
  CreditCard,
  DoorClosed,
  ShieldCheck,
  KeyRound,
  ChevronDown,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/associados", label: "Associados", icon: Users },
  { href: "/bilheteria", label: "Bilheteria", icon: Ticket },
  { href: "/caixa", label: "Caixa", icon: Banknote },
  { href: "/controle-acesso", label: "Controle de Acesso", icon: ScanLine },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/contratos", label: "Contratos", icon: FileSignature },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

const CONFIG_SUBITEMS = [
  { key: "parque", label: "Dados do Parque", icon: Building2 },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "permissoes", label: "Permissões", icon: KeyRound },
  { key: "planos", label: "Planos", icon: CreditCard },
  { key: "ingressos", label: "Tipos de Ingresso", icon: Ticket },
  { key: "regras", label: "Regras de Acesso", icon: ShieldCheck },
  { key: "catracas", label: "Catracas", icon: DoorClosed },
];

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isConfigRoute = pathname.startsWith("/configuracoes");
  const activeSection = searchParams.get("section") ?? "parque";
  const [configExpanded, setConfigExpanded] = useState(isConfigRoute);

  useEffect(() => {
    if (isConfigRoute) setConfigExpanded(true);
  }, [isConfigRoute]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 -translate-x-full flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-gray-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-primary-600 text-white">
              <Waves size={16} strokeWidth={2.25} />
            </div>
            <span className="text-sm font-semibold text-gray-900">Aqua Park</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-400 hover:bg-gray-100 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <Icon size={17} strokeWidth={2} className={active ? "text-primary-600" : "text-gray-400"} />
                {item.label}
              </Link>
            );
          })}

          <div>
            <button
              type="button"
              onClick={() => setConfigExpanded((prev) => !prev)}
              aria-expanded={configExpanded}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium transition-colors",
                isConfigRoute
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Settings size={17} strokeWidth={2} className={isConfigRoute ? "text-primary-600" : "text-gray-400"} />
              <span className="flex-1 text-left">Configurações</span>
              <ChevronDown
                size={15}
                className={cn("text-gray-400 transition-transform", configExpanded && "rotate-180")}
              />
            </button>

            {configExpanded && (
              <div className="mt-0.5 space-y-0.5 border-l border-gray-200 pl-3.5">
                {CONFIG_SUBITEMS.map((item) => {
                  const active = isConfigRoute && activeSection === item.key;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={`/configuracoes?section=${item.key}`}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-primary-50 text-primary-700"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                      )}
                    >
                      <Icon size={15} strokeWidth={2} className={active ? "text-primary-600" : "text-gray-400"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-[11px] text-gray-400">Aqua Park Manager v0.1</p>
        </div>
      </aside>
    </>
  );
}
