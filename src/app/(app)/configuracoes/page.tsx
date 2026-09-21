import { createClient } from "@/lib/supabase/server";
import { getAcessoAtual } from "@/lib/auth/acesso-atual";
import { getEmpresa } from "@/lib/supabase/contratos";
import { getPlanosTodos } from "@/lib/supabase/associados";
import { getTiposIngresso } from "@/lib/supabase/bilheteria";
import { getGrupos, getUsuariosEquipe } from "@/lib/supabase/usuarios-grupos";
import { temAlgumaPermissao, temPermissao } from "@/lib/permissoes";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const acesso = await getAcessoAtual();

  // Só busca o que a pessoa pode ver (o formulário de usuário também precisa da lista de grupos).
  const verUsuarios = temPermissao(acesso, "usuarios.visualizar");
  const [empresa, planos, tiposIngresso, usuarios, grupos] = await Promise.all([
    getEmpresa(supabase),
    getPlanosTodos(supabase),
    getTiposIngresso(supabase),
    verUsuarios ? getUsuariosEquipe(supabase) : Promise.resolve([]),
    temAlgumaPermissao(acesso, ["usuarios.visualizar", "grupos.visualizar"]) ? getGrupos(supabase) : Promise.resolve([]),
  ]);

  return (
    <ConfiguracoesClient
      empresa={empresa}
      planos={planos}
      tiposIngresso={tiposIngresso}
      usuarios={usuarios}
      grupos={grupos}
    />
  );
}
