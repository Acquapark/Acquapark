import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveCatracaValida } from "@/lib/catraca/chave-api";

/** Validade dos links das fotos: a ponte baixa logo em seguida. */
const VALIDADE_FOTO_S = 15 * 60;

/**
 * Lista de rostos que a ponte sincroniza com o leitor facial (Hikvision): todo
 * associado titular com foto, menos os inativos. O leitor só reconhece quem
 * está cadastrado nele — quem decide se entra continua sendo o sistema
 * (POST /api/catraca/validar com o número do associado).
 *
 * `versao` muda quando a foto ou o nome mudam: é por ela que a ponte sabe o
 * que reenviar ao aparelho. A foto vai como link temporário (bucket privado).
 */
export async function GET(request: NextRequest) {
  if (!chaveCatracaValida(request)) return NextResponse.json({ error: "Chave inválida." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("associados")
    .select("numero, nome, foto_url")
    .not("foto_url", "is", null)
    .neq("status", "Inativo")
    .order("numero");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const linhas = data ?? [];
  const caminhos = linhas.map((a) => a.foto_url as string);
  const { data: assinadas } = caminhos.length
    ? await admin.storage.from("associados-fotos").createSignedUrls(caminhos, VALIDADE_FOTO_S)
    : { data: [] };
  const urlPorCaminho = new Map((assinadas ?? []).map((s) => [s.path, s.signedUrl]));

  const rostos = linhas
    .map((a) => ({
      numero: a.numero as string,
      nome: a.nome as string,
      fotoUrl: urlPorCaminho.get(a.foto_url as string) ?? null,
      versao: `${a.foto_url}|${a.nome}`,
    }))
    .filter((r) => r.fotoUrl);

  return NextResponse.json({ rostos });
}
