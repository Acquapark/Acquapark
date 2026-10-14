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
  ScrollText,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
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
  termos: ScrollText,
  usuarios: Users,
  permissoes: KeyRound,
  planos: CreditCard,
  ingressos: Ticket,
  venda_online: Globe,
  regras: ShieldCheck,
  catracas: DoorClosed,
} as const;

function ConfigNavView({
  activeSection,
  onNavigate,
  recolhido = false,
}: {
  activeSection: string;
  onNavigate?: () => void;
  recolhido?: boolean;
}) {
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
      {recolhido && (
        <Link
          href={`/configuracoes?section=${secoes[0].key}`}
          title="Configurações"
          aria-label="Configurações"
          className={cn(
            "hidden h-9 items-center justify-center rounded-[4px] transition-colors lg:flex",
            isConfigRoute ? "bg-primary-50" : "hover:bg-gray-50",
          )}
        >
          <Settings size={17} strokeWidth={2} className={isConfigRoute ? "text-primary-600" : "text-gray-400"} />
        </Link>
      )}
      <div className={cn(recolhido && "lg:hidden")}>
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
    </div>
  );
}

/** Lê ?section= da URL; isolado aqui porque useSearchParams exige Suspense em páginas pré-renderizadas. */
function ConfigNavConnected({ onNavigate, recolhido }: { onNavigate?: () => void; recolhido?: boolean }) {
  const searchParams = useSearchParams();
  return <ConfigNavView activeSection={searchParams.get("section") ?? "parque"} onNavigate={onNavigate} recolhido={recolhido} />;
}

function ConfigNav({ onNavigate, recolhido }: { onNavigate?: () => void; recolhido?: boolean }) {
  return (
    <Suspense fallback={<ConfigNavView activeSection="parque" onNavigate={onNavigate} recolhido={recolhido} />}>
      <ConfigNavConnected onNavigate={onNavigate} recolhido={recolhido} />
    </Suspense>
  );
}

export function Sidebar({
  mobileOpen = false,
  onClose,
  recolhido = false,
  onAlternarRecolhido,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
  /** Só no computador (lg): menu estreito, apenas ícones. No celular o menu abre sempre inteiro. */
  recolhido?: boolean;
  onAlternarRecolhido?: () => void;
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 -translate-x-full flex-col border-r border-gray-200 bg-white transition-[transform,width] duration-200 lg:static lg:translate-x-0",
          mobileOpen && "translate-x-0",
          recolhido && "lg:w-16",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center justify-between gap-2 border-b border-gray-200 px-4",
            recolhido && "lg:justify-center lg:px-0",
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-primary-600 text-white">
              <Waves size={16} strokeWidth={2.25} />
            </div>
            <span className={cn("text-sm font-semibold text-gray-900", recolhido && "lg:hidden")}>Aqua Park</span>
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
                title={recolhido ? item.label : undefined}
                aria-label={item.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium transition-colors",
                  recolhido && "lg:justify-center lg:px-0",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <Icon size={17} strokeWidth={2} className={cn("shrink-0", active ? "text-primary-600" : "text-gray-400")} />
                <span className={cn("truncate", recolhido && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}

          <ConfigNav onNavigate={onClose} recolhido={recolhido} />
        </nav>

        <div className={cn("border-t border-gray-200 px-2 py-2", recolhido && "lg:px-0")}>
          {onAlternarRecolhido && (
            <button
              type="button"
              onClick={onAlternarRecolhido}
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              className={cn(
                "hidden w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:flex",
                recolhido && "justify-center px-0",
              )}
            >
              {recolhido ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!recolhido && <span>Recolher menu</span>}
            </button>
          )}
          <p className={cn("px-2.5 py-1 text-[11px] text-gray-400", recolhido && "lg:hidden")}>Aqua Park Manager v0.1</p>
        </div>
      </aside>
    </>
  );
}
