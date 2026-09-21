"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarUltimoAcessoPortal } from "@/app/portal/actions";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (authError || !data.user) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      const { data: acesso } = await supabase
        .from("associado_acessos")
        .select("status")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!acesso) {
        await supabase.auth.signOut();
        setError("Este acesso é exclusivo da equipe. Use o login do Portal do Associado com o e-mail cadastrado pelo Aqua Park.");
        return;
      }
      if (acesso.status === "Bloqueado") {
        await supabase.auth.signOut();
        setError("Seu acesso está bloqueado. Fale com a administração do parque.");
        return;
      }

      await registrarUltimoAcessoPortal();
      router.push("/portal");
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
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
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Portal do Associado</h1>
          <p className="text-sm text-gray-500">Aqua Park</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              className="h-12 w-full rounded-[6px] border border-gray-300 bg-white px-4 text-base text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/portal/esqueci-senha" className="text-sm font-medium text-primary-600">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
