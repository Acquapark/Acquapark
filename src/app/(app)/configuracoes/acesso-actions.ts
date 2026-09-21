"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirPermissao, getAcessoAtual } from "@/lib/auth/acesso-atual";
import { normalizarPermissoes, temPermissao } from "@/lib/permissoes";

/**
 * Grupos e usuários da equipe. Escrevem com a service role (o RLS não deixa o
 * navegador gravar nestas tabelas), então CADA ação começa checando a
 * permissão de quem chama. Regras que valem para todas:
 *  - ninguém concede permissão (ou grupo) que ele mesmo não tem — senão
 *    "editar grupos" viraria "virar administrador";
 *  - só quem tem acesso total mexe em administradores;
 *  - o sistema sempre mantém pelo menos um administrador ativo.
 */

type Resultado = { success: true } | { error: string };

export interface GrupoInput {
  nome: string;
  descricao: string;
  permissoes: string[];
}

const ERRO_NOME_DUPLICADO = "Já existe um grupo com este nome.";

function validarNome(nome: string) {
  const limpo = nome.trim();
  if (limpo.length < 2) return "Informe o nome do grupo (mínimo 2 caracteres).";
  if (limpo.length > 60) return "O nome do grupo pode ter no máximo 60 caracteres.";
  return null;
}

async function contarAdminsAtivos(admin: ReturnType<typeof createAdminClient>, ignorarUsuarioId: string) {
  const { count } = await admin
    .from("usuarios")
    .select("id, grupos_acesso!inner ( acesso_total )", { count: "exact", head: true })
    .eq("ativo", true)
    .eq("grupos_acesso.acesso_total", true)
    .neq("id", ignorarUsuarioId);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export async function criarGrupo(input: GrupoInput): Promise<Resultado & { id?: string }> {
  const negado = await exigirPermissao("grupos.criar");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  const erroNome = validarNome(input.nome);
  if (erroNome) return { error: erroNome };

  const permissoes = normalizarPermissoes(input.permissoes);
  if (!acesso.acessoTotal && permissoes.some((p) => !temPermissao(acesso, p))) {
    return { error: "Você só pode conceder permissões que você mesmo possui." };
  }

  const admin = createAdminClient();
  const { data: grupo, error } = await admin
    .from("grupos_acesso")
    .insert({ nome: input.nome.trim(), descricao: input.descricao.trim() || null })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? ERRO_NOME_DUPLICADO : error.message };

  if (permissoes.length > 0) {
    const { error: permError } = await admin
      .from("grupo_permissoes")
      .insert(permissoes.map((permissao) => ({ grupo_id: grupo.id, permissao })));
    if (permError) {
      await admin.from("grupos_acesso").delete().eq("id", grupo.id);
      return { error: permError.message };
    }
  }

  revalidatePath("/configuracoes");
  return { success: true, id: grupo.id as string };
}

export async function atualizarGrupo(id: string, input: GrupoInput): Promise<Resultado> {
  const negado = await exigirPermissao("grupos.editar");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  const erroNome = validarNome(input.nome);
  if (erroNome) return { error: erroNome };

  const admin = createAdminClient();
  const { data: grupo } = await admin
    .from("grupos_acesso")
    .select("id, acesso_total, grupo_permissoes ( permissao )")
    .eq("id", id)
    .maybeSingle();
  if (!grupo) return { error: "Grupo não encontrado." };
  if (grupo.acesso_total && !acesso.acessoTotal) {
    return { error: "Apenas administradores podem alterar o grupo de acesso total." };
  }

  const { error } = await admin
    .from("grupos_acesso")
    .update({ nome: input.nome.trim(), descricao: input.descricao.trim() || null })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? ERRO_NOME_DUPLICADO : error.message };

  // O grupo de acesso total já tem tudo; suas permissões não são editáveis.
  if (!grupo.acesso_total) {
    const atuais = new Set((grupo.grupo_permissoes as { permissao: string }[]).map((p) => p.permissao));
    const novas = normalizarPermissoes(input.permissoes);
    const alvo = new Set(novas);

    const concedidas = novas.filter((p) => !atuais.has(p));
    if (!acesso.acessoTotal && concedidas.some((p) => !temPermissao(acesso, p))) {
      return { error: "Você só pode conceder permissões que você mesmo possui." };
    }

    const remover = [...atuais].filter((p) => !alvo.has(p));
    if (remover.length > 0) {
      const { error: delError } = await admin
        .from("grupo_permissoes")
        .delete()
        .eq("grupo_id", id)
        .in("permissao", remover);
      if (delError) return { error: delError.message };
    }
    if (concedidas.length > 0) {
      const { error: insError } = await admin
        .from("grupo_permissoes")
        .insert(concedidas.map((permissao) => ({ grupo_id: id, permissao })));
      if (insError) return { error: insError.message };
    }
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function duplicarGrupo(id: string): Promise<Resultado> {
  const negado = await exigirPermissao("grupos.criar");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  const admin = createAdminClient();
  const { data: origem } = await admin
    .from("grupos_acesso")
    .select("nome, descricao, acesso_total, grupo_permissoes ( permissao )")
    .eq("id", id)
    .maybeSingle();
  if (!origem) return { error: "Grupo não encontrado." };
  if (origem.acesso_total) return { error: "O grupo de acesso total não pode ser duplicado." };

  const permissoes = (origem.grupo_permissoes as { permissao: string }[]).map((p) => p.permissao);
  if (!acesso.acessoTotal && permissoes.some((p) => !temPermissao(acesso, p))) {
    return { error: "Você só pode duplicar grupos cujas permissões você mesmo possui." };
  }

  const { data: existentes } = await admin.from("grupos_acesso").select("nome");
  const nomes = new Set((existentes ?? []).map((g) => (g.nome as string).toLowerCase()));
  let nome = `Cópia de ${origem.nome}`;
  for (let n = 2; nomes.has(nome.toLowerCase()); n++) nome = `Cópia de ${origem.nome} (${n})`;

  return criarGrupo({ nome, descricao: (origem.descricao as string) ?? "", permissoes });
}

export async function excluirGrupo(id: string): Promise<Resultado> {
  const negado = await exigirPermissao("grupos.excluir");
  if (negado) return negado;

  const admin = createAdminClient();
  const { data: grupo } = await admin
    .from("grupos_acesso")
    .select("id, acesso_total, usuarios ( count )")
    .eq("id", id)
    .maybeSingle();
  if (!grupo) return { error: "Grupo não encontrado." };
  if (grupo.acesso_total) return { error: "O grupo de acesso total não pode ser excluído." };

  const usuarios = (grupo.usuarios as { count: number }[])[0]?.count ?? 0;
  if (usuarios > 0) {
    return { error: `Este grupo tem ${usuarios} usuário(s). Mova-os para outro grupo antes de excluir.` };
  }

  const { error } = await admin.from("grupos_acesso").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Usuários da equipe
// ---------------------------------------------------------------------------

export interface UsuarioInput {
  nome: string;
  email: string;
  senha: string;
  grupoId: string;
}

/** O usuário logado pode colocar alguém neste grupo? (sem escalar privilégio) */
async function podeAtribuirGrupo(admin: ReturnType<typeof createAdminClient>, grupoId: string): Promise<{ error: string } | null> {
  const acesso = (await getAcessoAtual())!;
  const { data: grupo } = await admin
    .from("grupos_acesso")
    .select("id, acesso_total, grupo_permissoes ( permissao )")
    .eq("id", grupoId)
    .maybeSingle();
  if (!grupo) return { error: "Grupo não encontrado." };
  if (acesso.acessoTotal) return null;
  if (grupo.acesso_total) return { error: "Apenas administradores podem colocar alguém no grupo de acesso total." };
  const permissoes = (grupo.grupo_permissoes as { permissao: string }[]).map((p) => p.permissao);
  if (permissoes.some((p) => !temPermissao(acesso, p))) {
    return { error: "Você só pode atribuir grupos cujas permissões você mesmo possui." };
  }
  return null;
}

export async function criarUsuario(input: UsuarioInput): Promise<Resultado> {
  const negado = await exigirPermissao("usuarios.criar");
  if (negado) return negado;

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 2) return { error: "Informe o nome do usuário." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (input.senha.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };
  if (!input.grupoId) return { error: "Selecione o grupo de acesso." };

  const admin = createAdminClient();
  const grupoNegado = await podeAtribuirGrupo(admin, input.grupoId);
  if (grupoNegado) return grupoNegado;

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.senha,
    email_confirm: true,
  });
  if (authError || !created.user) {
    const jaExiste = authError?.message?.toLowerCase().includes("already");
    return { error: jaExiste ? "Já existe um acesso com este e-mail." : (authError?.message ?? "Não foi possível criar o usuário.") };
  }

  const { error: insertError } = await admin
    .from("usuarios")
    .insert({ id: created.user.id, nome, email, grupo_id: input.grupoId, ativo: true });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insertError.message };
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function atualizarUsuario(
  id: string,
  input: { nome: string; grupoId: string; ativo: boolean },
): Promise<Resultado> {
  const negado = await exigirPermissao("usuarios.editar");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  const nome = input.nome.trim();
  if (nome.length < 2) return { error: "Informe o nome do usuário." };
  if (!input.grupoId) return { error: "Selecione o grupo de acesso." };
  if (id === acesso.userId && !input.ativo) return { error: "Você não pode inativar o seu próprio usuário." };

  const admin = createAdminClient();
  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, ativo, grupo_id, grupos_acesso ( acesso_total )")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return { error: "Usuário não encontrado." };

  const alvoEhAdmin = (alvo.grupos_acesso as unknown as { acesso_total: boolean } | null)?.acesso_total === true;
  if (alvoEhAdmin && !acesso.acessoTotal) return { error: "Apenas administradores podem alterar outro administrador." };

  if (input.grupoId !== alvo.grupo_id) {
    const grupoNegado = await podeAtribuirGrupo(admin, input.grupoId);
    if (grupoNegado) return grupoNegado;
  }

  const { data: novoGrupo } = await admin.from("grupos_acesso").select("acesso_total").eq("id", input.grupoId).maybeSingle();
  const seguiraAdminAtivo = novoGrupo?.acesso_total === true && input.ativo;
  if (alvoEhAdmin && alvo.ativo && !seguiraAdminAtivo && (await contarAdminsAtivos(admin, id)) === 0) {
    return { error: "O sistema precisa de pelo menos um administrador ativo." };
  }

  const { error } = await admin.from("usuarios").update({ nome, grupo_id: input.grupoId, ativo: input.ativo }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function redefinirSenhaUsuario(id: string, novaSenha: string): Promise<Resultado> {
  const negado = await exigirPermissao("usuarios.redefinir_senha");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  if (novaSenha.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };

  const admin = createAdminClient();
  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, grupos_acesso ( acesso_total )")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return { error: "Usuário não encontrado." };
  const alvoEhAdmin = (alvo.grupos_acesso as unknown as { acesso_total: boolean } | null)?.acesso_total === true;
  if (alvoEhAdmin && !acesso.acessoTotal) return { error: "Apenas administradores podem redefinir a senha de outro administrador." };

  const { error } = await admin.auth.admin.updateUserById(id, { password: novaSenha });
  if (error) return { error: error.message };
  return { success: true };
}

export async function excluirUsuario(id: string): Promise<Resultado> {
  const negado = await exigirPermissao("usuarios.excluir");
  if (negado) return negado;
  const acesso = (await getAcessoAtual())!;

  if (id === acesso.userId) return { error: "Você não pode excluir o seu próprio usuário." };

  const admin = createAdminClient();
  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, ativo, grupos_acesso ( acesso_total )")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return { error: "Usuário não encontrado." };

  const alvoEhAdmin = (alvo.grupos_acesso as unknown as { acesso_total: boolean } | null)?.acesso_total === true;
  if (alvoEhAdmin && !acesso.acessoTotal) return { error: "Apenas administradores podem excluir outro administrador." };
  if (alvoEhAdmin && alvo.ativo && (await contarAdminsAtivos(admin, id)) === 0) {
    return { error: "O sistema precisa de pelo menos um administrador ativo." };
  }

  const { error } = await admin.from("usuarios").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Este usuário tem histórico (vendas, caixas...) e não pode ser excluído. Inative-o para bloquear o acesso." };
    }
    return { error: error.message };
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) return { error: `Usuário removido da equipe, mas o login não pôde ser apagado: ${authError.message}` };

  revalidatePath("/configuracoes");
  return { success: true };
}
