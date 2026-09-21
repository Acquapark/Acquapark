"use client";

import { Suspense, useEffect, useState } from "react";
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
import { useAcesso } from "@/components/providers/AcessoProvider";
import { ROTAS, SECOES_CONFIGURACOES } from "@/lib/permissoes";

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

const CONFIG_ICONS = {
  parque: Building2,
  usuarios: Users,
  permissoes: KeyRound,
  planos: CreditCard,
  ingressos: Ticket,
  regras: ShieldCheck,
  catracas: DoorClosed,
} as const;

function ConfigNavView({ activeSection, onNavigate }: { activeSection: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isConfigRoute = pathname.startsWith("/configuracoes");
  const { pode } = useAcesso();
  const secoes = SECOES_CONFIGURACOES.filter((s) => pode(s.permissao));
  const [expanded, setExpanded] = useState(isConfigRoute);

  useEffect(() => {
    if (isConfigRoute) setExpanded(true);
  }, [isConfigRoute]);

  if (secoes.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium transition-colors",
          isConfigRoute ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        )}
      >
        <Settings size={17} strokeWidth={2} className={isConfigRoute ? "text-primary-600" : "text-gray-400"} />
        <span className="flex-1 text-left">Configurações</span>
        <ChevronDown size={15} className={cn("text-gray-400 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-gray-200 pl-3.5">
          {secoes.map((item) => {
            const active = isConfigRoute && activeSection === item.key;
            const Icon = CONFIG_ICONS[item.key];
            return (
              <Link
                key={item.key}
                href={`/configuracoes?section=${item.key}`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active ? "bg-primary-50 text-primary-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
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
  );
}

/** Lê ?section= da URL; isolado aqui porque useSearchParams exige Suspense em páginas pré-renderizadas. */
function ConfigNavConnected({ onNavigate }: { onNavigate?: () => void }) {
  const searchParams = useSearchParams();
  return <ConfigNavView activeSection={searchParams.get("section") ?? "parque"} onNavigate={onNavigate} />;
}

function ConfigNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<ConfigNavView activeSection="parque" onNavigate={onNavigate} />}>
      <ConfigNavConnected onNavigate={onNavigate} />
    </Suspense>
  );
}

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { podeAlguma } = useAcesso();
  const itens = NAV_ITEMS.filter((item) => {
    const regra = ROTAS.find((r) => r.prefixo === item.href);
    return !regra || podeAlguma(...regra.qualquer);
  });

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
          {itens.map((item) => {
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

          <ConfigNav onNavigate={onClose} />
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-[11px] text-gray-400">Aqua Park Manager v0.1</p>
        </div>
      </aside>
    </>
  );
}
