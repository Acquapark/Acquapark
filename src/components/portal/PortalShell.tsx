"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Receipt, FileText, IdCard, LogOut, Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/portal", label: "Início", icon: Home },
  { href: "/portal/mensalidades", label: "Mensalidades", icon: Receipt },
  { href: "/portal/contrato", label: "Contrato", icon: FileText },
  { href: "/portal/credencial", label: "Credencial", icon: IdCard },
];

export function PortalShell({ associadoNome, children }: { associadoNome: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
  }

  const primeiroNome = associadoNome.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary-600 text-white">
            <Waves size={16} strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] leading-none text-gray-400">Aqua Park</p>
            <p className="text-sm font-semibold leading-tight text-gray-900">Olá, {primeiroNome}</p>
          </div>
        </div>
        <button
          onClick={handleSair}
          className="flex h-9 w-9 items-center justify-center rounded-[6px] text-gray-400 hover:bg-gray-100 hover:text-danger-600"
          aria-label="Sair"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary-600" : "text-gray-400",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
