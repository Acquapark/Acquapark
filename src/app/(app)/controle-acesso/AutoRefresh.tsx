"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da página a cada N segundos, só com a aba visível (outros terminais de leitura aparecem sozinhos). */
export function AutoRefresh({ intervaloSegundos }: { intervaloSegundos: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervaloSegundos * 1000);
    return () => clearInterval(id);
  }, [router, intervaloSegundos]);

  return null;
}
