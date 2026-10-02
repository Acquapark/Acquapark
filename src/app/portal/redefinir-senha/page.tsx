"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SENHA_TAMANHO_MINIMO } from "@/lib/associados/autocadastro-tipos";

type Estado = "verificando" | "pronto" | "invalido";

/**
 * Valida o link do e-mail de recuperação e abre a sessão que permite trocar a
 * senha. Aceita os dois formatos de link do Supabase:
 * - `?token_hash=...&type=recovery` (modelo de e-mail com {{ .TokenHash }}):
 *   funciona em qualquer aparelho/navegador — o recomendado;
 * - `?code=...` (modelo padrão, PKCE): só funciona no mesmo navegador em que
 *   a recuperação foi pedida, porque depende de um dado guardado nele.
 */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function validarLink() {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const code = params.get("code");

      let ok: boolean;
      if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        ok = !otpError;
      } else {
        // `?code=` o próprio cliente troca pela sessão ao iniciar (detectSessionInUrl);
        // getUser espera essa troca. Sem token na URL (página recarregada depois de
        // validar), vale a sessão de recuperação já aberta.
        const { data } = await supabase.auth.getUser();
        ok = !!data.user;
      }

      if (cancelado) return;
      // Tira o token da barra de endereço: ele é de uso único e não deve ficar no histórico.
      if (tokenHash || code) window.history.replaceState(null, "", window.location.pathname);
      setEstado(ok ? "pronto" : "invalido");
    }

    validarLink();
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (senha.length < SENHA_TAMANHO_MINIMO) {
      setError(`A senha deve ter pelo menos ${SENHA_TAMANHO_MINIMO} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: senha });
      if (updateError) {
        setError(
          /different from the old/i.test(updateError.message)
            ? "A nova senha precisa ser diferente da anterior."
            : "Não foi possível redefinir a senha. Peça um novo link de recuperação.",
        );
        return;
      }
      router.push("/portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
            <Waves size={26} strokeWidth={2.25} />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Nova senha</h1>
          <p className="text-sm text-gray-500">Escolha uma nova senha de acesso.</p>
        </div>

        {estado === "verificando" && <p className="text-center text-sm text-gray-500">Verificando o link...</p>}

        {estado === "invalido" && (
          <div className="space-y-4 text-center">
            <div className="rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
              Este link de recuperação é inválido ou já expirou. Os links valem por pouco tempo e só podem ser usados uma vez.
            </div>
            <Link
              href="/portal/esqueci-senha"
              className="flex h-12 w-full items-center justify-center rounded-[6px] bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
            >
              Pedir um novo link
            </Link>
          </div>
        )}

        {estado === "pronto" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Nova senha</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={`Mínimo ${SENHA_TAMANHO_MINIMO} caracteres`}
                autoComplete="new-password"
                className="h-12 w-full rounded-[6px] border border-gray-300 bg-white px-4 text-base text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Confirmar nova senha</label>
              <input
                type="password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
                className="h-12 w-full rounded-[6px] border border-gray-300 bg-white px-4 text-base text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {error && (
              <div className="rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-[6px] bg-primary-600 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
