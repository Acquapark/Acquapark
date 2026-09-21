"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DadosParqueSection } from "./sections/DadosParqueSection";
import { UsuariosSection } from "./sections/UsuariosSection";
import { GruposSection } from "./sections/GruposSection";
import { PlanosSection } from "./sections/PlanosSection";
import { TiposIngressoSection } from "./sections/TiposIngressoSection";
import { RegrasAcessoSection } from "./sections/RegrasAcessoSection";
import { CatracasSection } from "./sections/CatracasSection";
import { Empresa } from "@/lib/contracts/variables";
import { Plano, TipoIngresso } from "@/types";
import { GrupoAcesso, UsuarioEquipe } from "@/lib/supabase/usuarios-grupos";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { SECOES_CONFIGURACOES } from "@/lib/permissoes";

export function ConfiguracoesClient({
  empresa,
  planos,
  tiposIngresso,
  usuarios,
  grupos,
}: {
  empresa: Empresa;
  planos: Plano[];
  tiposIngresso: TipoIngresso[];
  usuarios: UsuarioEquipe[];
  grupos: GrupoAcesso[];
}) {
  const { pode } = useAcesso();
  const searchParams = useSearchParams();
  const requested = searchParams.get("section");
  // Só as seções que o grupo do usuário pode ver; se pediram uma proibida (ou nenhuma), abre a primeira liberada.
  const permitidas = SECOES_CONFIGURACOES.filter((s) => pode(s.permissao));
  const section = permitidas.find((s) => s.key === requested)?.key ?? permitidas[0]?.key ?? null;

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Parâmetros gerais do sistema e do parque" />

      <Card className="p-5">
        {section === "parque" && <DadosParqueSection empresa={empresa} />}
        {section === "usuarios" && <UsuariosSection usuarios={usuarios} grupos={grupos} />}
        {section === "permissoes" && <GruposSection grupos={grupos} />}
        {section === "planos" && <PlanosSection planos={planos} />}
        {section === "ingressos" && <TiposIngressoSection tipos={tiposIngresso} />}
        {section === "regras" && <RegrasAcessoSection />}
        {section === "catracas" && <CatracasSection />}
      </Card>
    </div>
  );
}
