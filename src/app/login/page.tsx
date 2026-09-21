"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }

      // Este login é exclusivo da equipe — associados usam /portal/login.
      // A política de RLS em `usuarios` só deixa a própria equipe se ver,
      // então esta consulta retorna vazio para qualquer sessão que não seja staff.
      const { data: staffRow } = await supabase.from("usuarios").select("id").eq("id", data.user.id).maybeSingle();
      if (!staffRow) {
        await supabase.auth.signOut();
        setError("Este acesso é exclusivo da equipe. Associados devem entrar pelo Portal do Associado.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Não foi possível conectar ao Supabase. Verifique as variáveis de ambiente em .env.local.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-[6px] border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[6px] bg-primary-600 text-white">
            <Waves size={22} strokeWidth={2.25} />
          </div>
          <h1 className="mt-3 text-base font-semibold text-gray-900">Aqua Park Manager</h1>
          <p className="text-xs text-gray-500">Acesse o painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label required>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div>
            <Label required>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          {error && (
            <div className="rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
