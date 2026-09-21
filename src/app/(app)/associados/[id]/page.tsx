import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssociadoById, getPlanos } from "@/lib/supabase/associados";
import { getContratosGeradosDoAssociado, getModelosAtivos } from "@/lib/supabase/contratos";
import { getContratoAtivo } from "@/lib/supabase/contrato-associado";
import { getAcessoAssociado } from "@/lib/supabase/acesso";
import { AssociadoProfileClient } from "./AssociadoProfileClient";

export default async function AssociadoProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [result, planos, contratosGerados, modelosAtivos, contratoAtivo, acesso] = await Promise.all([
    getAssociadoById(supabase, id),
    getPlanos(supabase),
    getContratosGeradosDoAssociado(supabase, id),
    getModelosAtivos(supabase),
    getContratoAtivo(supabase, id),
    getAcessoAssociado(supabase, id),
  ]);

  if (!result) notFound();

  return (
    <AssociadoProfileClient
      key={id}
      associado={result.associado}
      planoId={result.planoId}
      credencialCodigo={result.credencialCodigo}
      planos={planos}
      contratosGerados={contratosGerados}
      modelosAtivos={modelosAtivos}
      contratoAtivo={contratoAtivo}
      acesso={acesso}
    />
  );
}
