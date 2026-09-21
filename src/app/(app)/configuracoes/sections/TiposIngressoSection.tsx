"use client";

import { TiposIngressoManager } from "@/components/bilheteria/TiposIngressoManager";
import { TipoIngresso } from "@/types";

export function TiposIngressoSection({ tipos }: { tipos: TipoIngresso[] }) {
  return <TiposIngressoManager tipos={tipos} />;
}
