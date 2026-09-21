import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AcessoProvider } from "@/components/providers/AcessoProvider";
import { getAcessoAtual } from "@/lib/auth/acesso-atual";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const acesso = await getAcessoAtual();
  // O proxy já barra quem não é da equipe; isto só cobre o caso de a sessão cair entre uma coisa e outra.
  if (!acesso) redirect("/login");

  return (
    <AcessoProvider acesso={acesso}>
      <AppShell>{children}</AppShell>
    </AcessoProvider>
  );
}
