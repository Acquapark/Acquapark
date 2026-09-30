import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Procura um login do Supabase Auth pelo e-mail. A API admin não filtra por
 * e-mail, então percorre as páginas (o volume de logins do parque é pequeno).
 */
async function buscarLoginPorEmail(admin: SupabaseClient, email: string) {
  const alvo = email.trim().toLowerCase();
  const porPagina = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: porPagina });
    if (error) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (achado) return achado;
    if (data.users.length < porPagina) return null;
  }
}

/**
 * Cria o login do associado no Portal e o vincula em `associado_acessos`.
 *
 * Se o e-mail já tiver um login que não pertence a ninguém — sobra de um
 * associado excluído antes de a exclusão passar a apagar o login — ele é
 * reaproveitado com a nova senha. Login de alguém da equipe ou de outro
 * associado nunca é tocado.
 */
export async function criarLoginDoAssociado(
  admin: SupabaseClient,
  params: { associadoId: string; email: string; senha: string },
): Promise<{ error: string } | { ok: true }> {
  const email = params.email.trim();
  let userId: string;
  let criadoAgora = false;

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: params.senha,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
    criadoAgora = true;
  } else {
    const existente = authError?.code === "email_exists" || /already|registered/i.test(authError?.message ?? "")
      ? await buscarLoginPorEmail(admin, email)
      : null;
    if (!existente) return { error: authError?.message ?? "Não foi possível criar o acesso." };

    const [{ data: daEquipe }, { data: deAssociado }] = await Promise.all([
      admin.from("usuarios").select("id").eq("id", existente.id).maybeSingle(),
      admin.from("associado_acessos").select("id").eq("id", existente.id).maybeSingle(),
    ]);
    if (daEquipe || deAssociado) return { error: "Este e-mail já é usado por outro acesso." };

    const { error: updateError } = await admin.auth.admin.updateUserById(existente.id, {
      password: params.senha,
      email_confirm: true,
    });
    if (updateError) return { error: updateError.message };
    userId = existente.id;
  }

  const { error: linkError } = await admin.from("associado_acessos").insert({
    id: userId,
    associado_id: params.associadoId,
    email,
    status: "Ativo",
  });
  if (linkError) {
    if (criadoAgora) await admin.auth.admin.deleteUser(userId);
    return { error: linkError.message };
  }
  return { ok: true };
}

/**
 * Logins do Portal de um associado. Leia ANTES de excluí-lo: a exclusão apaga
 * `associado_acessos` em cascata, mas não o login no Auth — que ficava órfão
 * e travava um novo cadastro com o mesmo e-mail.
 */
export async function loginsDoAssociado(admin: SupabaseClient, associadoId: string): Promise<string[]> {
  const { data } = await admin.from("associado_acessos").select("id").eq("associado_id", associadoId);
  return (data ?? []).map((a) => a.id as string);
}

/** Apaga esses logins do Auth — depois de o associado ter sido excluído com sucesso. */
export async function apagarLogins(admin: SupabaseClient, userIds: string[]) {
  for (const id of userIds) {
    const { data: daEquipe } = await admin.from("usuarios").select("id").eq("id", id).maybeSingle();
    if (daEquipe) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error("Login do associado excluído não foi apagado:", error.message);
  }
}
