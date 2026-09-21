import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getModeloById } from "@/lib/supabase/contratos";
import { getAssociados } from "@/lib/supabase/associados";
import { ModeloEditorClient } from "./ModeloEditorClient";

export default async function ModeloEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [modelo, associados] = await Promise.all([getModeloById(supabase, id), getAssociados(supabase)]);

  if (!modelo) notFound();

  return (
    <ModeloEditorClient
      modelo={modelo}
      associadosOptions={associados.map((a) => ({ id: a.id, nome: a.nome, numero: a.numero }))}
    />
  );
}
