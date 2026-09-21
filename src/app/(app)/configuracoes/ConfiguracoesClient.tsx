"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DadosParqueSection } from "./sections/DadosParqueSection";
import { UsuariosSection } from "./sections/UsuariosSection";
import { PermissoesSection } from "./sections/PermissoesSection";
import { PlanosSection } from "./sections/PlanosSection";
import { TiposIngressoSection } from "./sections/TiposIngressoSection";
import { RegrasAcessoSection } from "./sections/RegrasAcessoSection";
import { CatracasSection } from "./sections/CatracasSection";
import { Empresa } from "@/lib/contracts/variables";
import { Plano } from "@/types";

const SECTION_KEYS = ["parque", "usuarios", "permissoes", "planos", "ingressos", "regras", "catracas"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

export function ConfiguracoesClient({ empresa, planos }: { empresa: Empresa; planos: Plano[] }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("section");
  const section: SectionKey = (SECTION_KEYS as readonly string[]).includes(requested ?? "")
    ? (requested as SectionKey)
    : "parque";

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Parâmetros gerais do sistema e do parque" />

      <Card className="p-5">
        {section === "parque" && <DadosParqueSection empresa={empresa} />}
        {section === "usuarios" && <UsuariosSection />}
        {section === "permissoes" && <PermissoesSection />}
        {section === "planos" && <PlanosSection planos={planos} />}
        {section === "ingressos" && <TiposIngressoSection />}
        {section === "regras" && <RegrasAcessoSection />}
        {section === "catracas" && <CatracasSection />}
      </Card>
    </div>
  );
}
