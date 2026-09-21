"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A service role key ignora RLS — então as ações abaixo (que a usam para
 * criar/editar login de associado no Supabase Auth) checam explicitamente
 * se quem está chamando é da equipe antes de fazer qualquer coisa.
 */
async function assertStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("usuarios").select("id").eq("id", user.id).maybeSingle();
  return !!data;
}

export async function criarAcessoAssociado(associadoId: string, email: string, senha: string) {
  if (!(await assertStaff())) return { error: "Não autorizado." };
  if (!email) return { error: "Informe o e-mail de acesso." };
  if (senha.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };

  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { error: authError?.message ?? "Não foi possível criar o acesso." };
  }

  const { error: linkError } = await admin.from("associado_acessos").insert({
    id: created.user.id,
    associado_id: associadoId,
    email,
    status: "Ativo",
  });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: linkError.message };
  }

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function redefinirSenhaAssociado(associadoId: string, acessoId: string, novaSenha: string) {
  if (!(await assertStaff())) return { error: "Não autorizado." };
  if (novaSenha.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(acessoId, { password: novaSenha });
  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function setAcessoStatus(associadoId: string, status: "Ativo" | "Bloqueado") {
  if (!(await assertStaff())) return { error: "Não autorizado." };

  const supabase = await createClient();
  const { error } = await supabase.from("associado_acessos").update({ status }).eq("associado_id", associadoId);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}
