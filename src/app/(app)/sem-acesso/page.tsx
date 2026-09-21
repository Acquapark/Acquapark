import { ShieldOff } from "lucide-react";

export default function SemAcessoPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ShieldOff size={22} />
      </div>
      <h1 className="mt-4 text-base font-semibold text-gray-900">Sem acesso a nenhuma área</h1>
      <p className="mt-1 text-sm text-gray-500">
        Seu usuário ainda não tem permissões liberadas. Peça a um administrador para incluí-lo em um grupo de acesso.
      </p>
    </div>
  );
}
