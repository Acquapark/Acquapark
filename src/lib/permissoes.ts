/**
 * Catálogo de permissões do sistema — a lista de tudo o que pode ser liberado
 * ou negado a um grupo de acesso. Este arquivo é a ÚNICA fonte da verdade:
 * a tela de grupos, a barra lateral, o proxy e as Server Actions leem daqui.
 *
 * Uma permissão é a chave "recurso.acao" (ex: "associados.criar"). Os grupos
 * em si (quais permissões cada um tem) ficam no banco, editáveis na interface;
 * só o CATÁLOGO do que existe fica no código, porque cada permissão precisa
 * de código que a aplique. Ao criar uma funcionalidade nova, cadastre a
 * permissão aqui e o grupo "Administrador" (acesso total) já passa a tê-la.
 *
 * Módulo puro (sem "server-only"): também roda no navegador e no proxy.
 */

export interface AcaoDef {
  /** Parte da chave depois do ponto: "visualizar", "criar", "editar", "excluir" ou específica. */
  chave: string;
  rotulo: string;
  descricao?: string;
}

export interface RecursoDef {
  chave: string;
  rotulo: string;
  descricao?: string;
  acoes: AcaoDef[];
}

export interface ModuloDef {
  chave: string;
  rotulo: string;
  recursos: RecursoDef[];
}

export const ACOES_PADRAO = ["visualizar", "criar", "editar", "excluir"] as const;

const A = {
  visualizar: { chave: "visualizar", rotulo: "Visualizar" },
  criar: { chave: "criar", rotulo: "Criar" },
  editar: { chave: "editar", rotulo: "Editar" },
  excluir: { chave: "excluir", rotulo: "Excluir" },
} satisfies Record<string, AcaoDef>;

const RELATORIOS_PERMISSAO = [
  { chave: "relatorio_vendas", rotulo: "Vendas" },
  { chave: "relatorio_entradas", rotulo: "Entradas" },
  { chave: "relatorio_saidas", rotulo: "Saídas" },
  { chave: "relatorio_associados", rotulo: "Associados" },
  { chave: "relatorio_inadimplencia", rotulo: "Inadimplência" },
  { chave: "relatorio_faturamento", rotulo: "Faturamento" },
  { chave: "relatorio_utilizacao", rotulo: "Utilização do parque" },
  { chave: "relatorio_pagamentos", rotulo: "Formas de pagamento" },
  { chave: "relatorio_acessos", rotulo: "Histórico de acessos" },
] as const;

/** Relatório (id em src/lib/relatorios/tipos.ts) → recurso de permissão. */
export function permissaoDoRelatorio(id: string): string {
  return `relatorio_${id}.visualizar`;
}

export const MODULOS: ModuloDef[] = [
  {
    chave: "dashboard",
    rotulo: "Dashboard",
    recursos: [{ chave: "dashboard", rotulo: "Painel geral", acoes: [A.visualizar] }],
  },
  {
    chave: "associados",
    rotulo: "Associados",
    recursos: [
      {
        chave: "associados",
        rotulo: "Associados",
        descricao: "Lista, perfil e cadastro de associados.",
        acoes: [
          A.visualizar,
          A.criar,
          { ...A.editar, descricao: "Alterar os dados cadastrais." },
          A.excluir,
          { chave: "alterar_status", rotulo: "Alterar situação", descricao: "Bloquear, inativar e reativar." },
        ],
      },
      {
        chave: "dependentes",
        rotulo: "Dependentes",
        descricao: "Aba Dependentes do perfil do associado.",
        acoes: [A.visualizar, A.criar, A.excluir],
      },
      {
        chave: "planos_associado",
        rotulo: "Plano e contrato do associado",
        descricao: "Aba Plano do perfil: vincular um plano gera contrato e mensalidades.",
        acoes: [A.visualizar, { chave: "criar", rotulo: "Vincular plano" }],
      },
      {
        chave: "credenciais",
        rotulo: "Credencial (QR Code)",
        acoes: [A.visualizar, { chave: "criar", rotulo: "Gerar" }, { chave: "editar", rotulo: "Regenerar" }],
      },
      {
        chave: "acesso_portal",
        rotulo: "Acesso ao Portal do Associado",
        descricao: "Login do associado no portal: criar, redefinir senha, bloquear.",
        acoes: [A.visualizar, A.criar, A.editar],
      },
    ],
  },
  {
    chave: "bilheteria",
    rotulo: "Bilheteria",
    recursos: [
      {
        chave: "ingressos",
        rotulo: "Ingressos",
        acoes: [
          A.visualizar,
          { chave: "criar", rotulo: "Vender" },
          { chave: "cancelar", rotulo: "Cancelar venda" },
          A.excluir,
          { chave: "imprimir", rotulo: "Reimprimir" },
        ],
      },
      {
        chave: "cupons_desconto",
        rotulo: "Cupons de desconto",
        acoes: [A.visualizar, A.criar, A.editar, A.excluir],
      },
    ],
  },
  {
    chave: "caixa",
    rotulo: "Caixa",
    recursos: [
      {
        chave: "caixa",
        rotulo: "Caixa",
        acoes: [
          A.visualizar,
          { chave: "abrir", rotulo: "Abrir" },
          { chave: "movimentar", rotulo: "Sangria / suprimento" },
          { chave: "fechar", rotulo: "Fechar" },
          { chave: "reabrir", rotulo: "Reabrir" },
          { chave: "ver_todos", rotulo: "Ver caixas de outros operadores" },
        ],
      },
    ],
  },
  {
    chave: "controle_acesso",
    rotulo: "Controle de Acesso",
    recursos: [
      {
        chave: "controle_acesso",
        rotulo: "Portaria",
        acoes: [A.visualizar, { chave: "validar", rotulo: "Validar QR Code / código" }],
      },
    ],
  },
  {
    chave: "financeiro",
    rotulo: "Financeiro",
    recursos: [
      {
        chave: "contas_receber",
        rotulo: "Contas a receber (mensalidades)",
        descricao: "Também vale para a aba Financeiro do perfil do associado.",
        acoes: [
          A.visualizar,
          { chave: "receber", rotulo: "Registrar pagamento" },
          { chave: "criar", rotulo: "Criar / sincronizar cobrança" },
          { chave: "editar", rotulo: "Editar vencimento" },
          { chave: "cancelar", rotulo: "Cancelar mensalidade" },
        ],
      },
      { chave: "recebimentos", rotulo: "Recebimentos", acoes: [A.visualizar] },
      {
        chave: "despesas",
        rotulo: "Despesas",
        acoes: [A.visualizar, A.criar, A.editar, A.excluir, { chave: "pagar", rotulo: "Pagar / desfazer pagamento" }],
      },
      { chave: "fluxo_caixa", rotulo: "Fluxo de caixa", acoes: [A.visualizar] },
    ],
  },
  {
    chave: "contratos",
    rotulo: "Contratos",
    recursos: [
      {
        chave: "modelos_contrato",
        rotulo: "Modelos de contrato",
        acoes: [A.visualizar, { chave: "criar", rotulo: "Criar / duplicar" }, A.editar, A.excluir],
      },
      {
        chave: "contratos_gerados",
        rotulo: "Contratos gerados",
        acoes: [A.visualizar, { chave: "criar", rotulo: "Gerar contrato" }],
      },
    ],
  },
  {
    chave: "relatorios",
    rotulo: "Relatórios",
    recursos: [
      ...RELATORIOS_PERMISSAO.map((r) => ({ chave: r.chave, rotulo: r.rotulo, acoes: [A.visualizar] })),
      {
        chave: "exportacao_relatorios",
        rotulo: "Exportação (CSV, Excel, PDF)",
        acoes: [{ chave: "exportar", rotulo: "Exportar" }],
      },
    ],
  },
  {
    chave: "configuracoes",
    rotulo: "Configurações",
    recursos: [
      { chave: "parque", rotulo: "Dados do Parque", acoes: [A.visualizar, A.editar] },
      { chave: "planos", rotulo: "Planos de associados", acoes: [A.visualizar, A.criar, A.editar] },
      { chave: "tipos_ingresso", rotulo: "Tipos de ingresso", acoes: [A.visualizar, A.criar, A.editar, A.excluir] },
      { chave: "regras_acesso", rotulo: "Regras de acesso", acoes: [A.visualizar, A.editar] },
      { chave: "catracas", rotulo: "Catracas", acoes: [A.visualizar, A.criar, A.editar, A.excluir] },
      {
        chave: "usuarios",
        rotulo: "Usuários",
        acoes: [
          A.visualizar,
          A.criar,
          { ...A.editar, descricao: "Nome, grupo e ativar/inativar." },
          A.excluir,
          { chave: "redefinir_senha", rotulo: "Redefinir senha" },
        ],
      },
      {
        chave: "grupos",
        rotulo: "Grupos e permissões",
        descricao: "Só é possível conceder permissões que você mesmo possui.",
        acoes: [A.visualizar, A.criar, A.editar, A.excluir],
      },
    ],
  },
];

export const TODAS_PERMISSOES: string[] = MODULOS.flatMap((m) =>
  m.recursos.flatMap((r) => r.acoes.map((a) => `${r.chave}.${a.chave}`)),
);

const PERMISSOES_VALIDAS = new Set(TODAS_PERMISSOES);

export function permissaoValida(chave: string) {
  return PERMISSOES_VALIDAS.has(chave);
}

/**
 * Regra de coerência: quem pode criar/editar/excluir/etc. um recurso precisa
 * poder visualizá-lo (não existe "editar sem enxergar"). Remove chaves
 * desconhecidas e acrescenta o "visualizar" que faltar.
 */
export function normalizarPermissoes(chaves: Iterable<string>): string[] {
  const resultado = new Set<string>();
  for (const chave of chaves) if (PERMISSOES_VALIDAS.has(chave)) resultado.add(chave);

  for (const modulo of MODULOS) {
    for (const recurso of modulo.recursos) {
      const temVisualizar = recurso.acoes.some((a) => a.chave === "visualizar");
      if (!temVisualizar) continue;
      const algumaAcao = recurso.acoes.some((a) => a.chave !== "visualizar" && resultado.has(`${recurso.chave}.${a.chave}`));
      if (algumaAcao) resultado.add(`${recurso.chave}.visualizar`);
    }
  }
  return TODAS_PERMISSOES.filter((p) => resultado.has(p));
}

// ---------------------------------------------------------------------------
// Acesso do usuário logado
// ---------------------------------------------------------------------------

export interface AcessoUsuario {
  userId: string;
  nome: string;
  email: string;
  grupoId: string | null;
  grupoNome: string | null;
  /** Grupo com acesso total (Administrador): tem todas as permissões, inclusive as futuras. */
  acessoTotal: boolean;
  permissoes: string[];
}

export function temPermissao(acesso: Pick<AcessoUsuario, "acessoTotal" | "permissoes"> | null | undefined, chave: string) {
  if (!acesso) return false;
  return acesso.acessoTotal || acesso.permissoes.includes(chave);
}

export function temAlgumaPermissao(
  acesso: Pick<AcessoUsuario, "acessoTotal" | "permissoes"> | null | undefined,
  chaves: readonly string[],
) {
  return chaves.some((c) => temPermissao(acesso, c));
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

const RELATORIOS_VISUALIZAR = RELATORIOS_PERMISSAO.map((r) => `${r.chave}.visualizar`);

/** Seções de Configurações → permissão que abre a seção. */
export const SECOES_CONFIGURACOES = [
  { key: "parque", label: "Dados do Parque", permissao: "parque.visualizar" },
  { key: "usuarios", label: "Usuários", permissao: "usuarios.visualizar" },
  { key: "permissoes", label: "Grupos e Permissões", permissao: "grupos.visualizar" },
  { key: "planos", label: "Planos", permissao: "planos.visualizar" },
  { key: "ingressos", label: "Tipos de Ingresso", permissao: "tipos_ingresso.visualizar" },
  { key: "regras", label: "Regras de Acesso", permissao: "regras_acesso.visualizar" },
  { key: "catracas", label: "Catracas", permissao: "catracas.visualizar" },
] as const;

export type SecaoConfiguracao = (typeof SECOES_CONFIGURACOES)[number]["key"];

const CONFIG_VISUALIZAR = SECOES_CONFIGURACOES.map((s) => s.permissao);
export const FINANCEIRO_VISUALIZAR = [
  "contas_receber.visualizar",
  "recebimentos.visualizar",
  "despesas.visualizar",
  "fluxo_caixa.visualizar",
] as const;

/** Cada área do painel e a(s) permissão(ões) que dão acesso a ela (qualquer uma basta). */
export const ROTAS: { prefixo: string; qualquer: readonly string[] }[] = [
  { prefixo: "/dashboard", qualquer: ["dashboard.visualizar"] },
  { prefixo: "/associados", qualquer: ["associados.visualizar"] },
  { prefixo: "/bilheteria", qualquer: ["ingressos.visualizar"] },
  { prefixo: "/caixa", qualquer: ["caixa.visualizar"] },
  { prefixo: "/controle-acesso", qualquer: ["controle_acesso.visualizar"] },
  { prefixo: "/financeiro", qualquer: FINANCEIRO_VISUALIZAR },
  { prefixo: "/contratos", qualquer: ["modelos_contrato.visualizar"] },
  { prefixo: "/relatorios", qualquer: RELATORIOS_VISUALIZAR },
  { prefixo: "/configuracoes", qualquer: CONFIG_VISUALIZAR },
  { prefixo: "/imprimir/ingresso", qualquer: ["ingressos.visualizar"] },
  { prefixo: "/imprimir/relatorio", qualquer: RELATORIOS_VISUALIZAR },
];

export function regraDaRota(pathname: string) {
  return ROTAS.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`)) ?? null;
}

/** Primeira área do menu que o usuário pode abrir (destino após login / acesso negado). */
export function rotaInicial(acesso: Pick<AcessoUsuario, "acessoTotal" | "permissoes"> | null): string | null {
  const menu = ["/dashboard", "/associados", "/bilheteria", "/caixa", "/controle-acesso", "/financeiro", "/contratos", "/relatorios", "/configuracoes"];
  for (const prefixo of menu) {
    const regra = ROTAS.find((r) => r.prefixo === prefixo);
    if (regra && temAlgumaPermissao(acesso, regra.qualquer)) return prefixo;
  }
  return null;
}
