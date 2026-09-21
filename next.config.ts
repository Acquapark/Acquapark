import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Voltar a um módulo visitado há menos de 30s reaproveita a página em cache
    // (o padrão é 0). Server Actions e router.refresh() invalidam esse cache,
    // então operações feitas nesta aba nunca mostram dado velho.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
