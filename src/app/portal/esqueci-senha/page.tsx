"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/portal/redefinir-senha`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        setError("Não foi possível enviar o e-mail. Tente novamente.");
        return;
      }
      setEnviado(true);
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
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Recuperar senha</h1>
          <p className="text-center text-sm text-gray-500">Enviaremos um link para redefinir sua senha.</p>
        </div>

        {enviado ? (
          <div className="rounded-[6px] border border-success-600/30 bg-success-50 px-4 py-3 text-sm text-success-700">
            Se este e-mail estiver cadastrado, você vai receber um link para redefinir a senha em instantes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                inputMode="email"
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
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link href="/portal/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
            <ArrowLeft size={14} />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
