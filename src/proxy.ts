import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PORTAL_PUBLIC_PATHS = ["/portal/login", "/portal/esqueci-senha", "/portal/redefinir-senha"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims valida a assinatura do JWT localmente (sem ir ao Supabase Auth
  // a cada navegação) quando o projeto usa chaves assimétricas; com segredo
  // simétrico ele consulta o Auth, igual ao getUser. Também renova a sessão
  // perto de expirar. O papel (equipe/associado) continua sendo checado no
  // banco abaixo, então bloquear um usuário vale na hora.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const pathname = request.nextUrl.pathname;
  const isPortalPath = pathname.startsWith("/portal");
  const isPortalPublic = PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAdminLoginPage = pathname === "/login";

  // Server Actions chegam como POST para a própria página que os chamou. Uma
  // ação legítima (ex: terminar o login) pode disparar bem depois de o
  // usuário já estar autenticado — redirecionar essa chamada quebra o
  // protocolo de Server Actions no cliente ("An unexpected response was
  // received from the server"). Os redirecionamentos de navegação abaixo só
  // fazem sentido para GET; para os demais métodos, deixamos a própria
  // action decidir (ela já valida a sessão internamente) — e nem gastamos
  // consultas ao banco para decidir um redirecionamento que não vai acontecer.
  const isNavigation = request.method === "GET";
  if (!isNavigation) return response;

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  }

  if (!userId) {
    if (isPortalPath && !isPortalPublic) return redirectTo("/portal/login");
    if (!isPortalPath && !isAdminLoginPage) return redirectTo("/login");
    return response;
  }

  // Duas áreas, duas tabelas de vínculo — nunca confiar em "está autenticado"
  // sozinho: um associado logado nunca deve entrar no painel administrativo
  // (e vice-versa). Cada rota só precisa de UMA das checagens.
  if (isPortalPath) {
    const { data: acesso } = await supabase.from("associado_acessos").select("status").eq("id", userId).maybeSingle();
    const isAssociadoAtivo = acesso?.status === "Ativo";

    if (isPortalPublic) {
      if (isAssociadoAtivo) return redirectTo("/portal");
      return response;
    }
    if (!isAssociadoAtivo) return redirectTo("/portal/login");
    return response;
  }

  const { data: staffRow } = await supabase.from("usuarios").select("id").eq("id", userId).maybeSingle();
  const isStaff = !!staffRow;

  if (isAdminLoginPage) {
    if (isStaff) return redirectTo("/dashboard");
    return response;
  }

  if (!isStaff) return redirectTo("/login");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
