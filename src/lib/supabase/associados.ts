import { SupabaseClient } from "@supabase/supabase-js";
import { AcessoRegistro, Associado, AssociadoStatus, Dependente, Mensalidade, Plano, RegraPrimeiraParcela } from "@/types";

type Row = Record<string, unknown>;

function mapPlano(row: Row | null): Plano | null {
  if (!row) return null;
  return {
    id: row.id as string,
    nome: row.nome as string,
    valor: Number(row.valor),
    dependentesPermitidos: row.dependentes_permitidos as number,
    beneficios: (row.beneficios as string[]) ?? [],
    quantidadeMensalidades: (row.quantidade_mensalidades as number) ?? 12,
    diaVencimento: (row.dia_vencimento as number) ?? 10,
    regraPrimeiraParcela: (row.regra_primeira_parcela as RegraPrimeiraParcela) ?? "padrao",
    vencimentoNaContratacao: (row.vencimento_na_contratacao as boolean) ?? false,
    ativo: (row.ativo as boolean) ?? true,
  };
}

function mapDependente(row: Row): Dependente {
  return {
    id: row.id as string,
    nome: row.nome as string,
    cpf: (row.cpf as string) ?? "",
    parentesco: row.parentesco as string,
    nascimento: (row.nascimento as string) ?? "",
    status: row.ativo ? "Ativo" : "Inativo",
  };
}

function mapMensalidade(row: Row): Mensalidade {
  const pagamento = Array.isArray(row.pagamentos) ? (row.pagamentos[0] as Row | undefined) : undefined;
  return {
    id: row.id as string,
    contratoId: (row.contrato_id as string) ?? undefined,
    numeroParcela: (row.numero_parcela as number) ?? undefined,
    totalParcelas: (row.total_parcelas as number) ?? undefined,
    vencimento: row.vencimento as string,
    valor: Number(row.valor),
    status: row.status as Mensalidade["status"],
    formaPagamento: (row.forma_pagamento as string) ?? (pagamento?.forma_pagamento as string | undefined),
    pagamentoEm: (row.pago_em as string) ?? (pagamento?.pago_em as string | undefined),
    gatewayChargeId: (row.gateway_charge_id as string) ?? undefined,
  };
}

function mapAcesso(row: Row): AcessoRegistro {
  const catraca = row.catracas as Row | null;
  const registradoEm = new Date(row.registrado_em as string);
  return {
    id: row.id as string,
    data: registradoEm.toISOString().slice(0, 10),
    horario: registradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    tipo: row.tipo as AcessoRegistro["tipo"],
    catraca: catraca ? `${catraca.nome} — ${catraca.tipo}` : "—",
    resultado: row.resultado as AcessoRegistro["resultado"],
    motivo: (row.motivo as string) ?? undefined,
  };
}

const LIST_SELECT = `
  id, numero, nome, cpf, email, telefone, status,
  planos ( nome, valor ),
  mensalidades ( vencimento, valor, status ),
  credenciais ( acessos ( registrado_em ) )
`;

export async function getAssociados(supabase: SupabaseClient): Promise<Associado[]> {
  const { data, error } = await supabase.from("associados").select(LIST_SELECT).order("nome");
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const plano = mapPlano(row.planos as Row | null);
    const mensalidades = ((row.mensalidades as Row[]) ?? []).slice();
    const pendente = mensalidades
      .filter((m) => m.status !== "Pago" && m.status !== "Cancelado")
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];

    const acessos = ((row.credenciais as Row[]) ?? []).flatMap((c) => (c.acessos as Row[]) ?? []);
    const ultimoAcesso = acessos
      .slice()
      .sort((a, b) => String(b.registrado_em).localeCompare(String(a.registrado_em)))[0];

    return {
      id: row.id as string,
      numero: row.numero as string,
      nome: row.nome as string,
      cpf: row.cpf as string,
      email: (row.email as string) ?? "",
      telefone: (row.telefone as string) ?? "",
      plano: plano?.nome ?? "—",
      status: row.status as AssociadoStatus,
      mensalidade: pendente ? Number(pendente.valor) : (plano?.valor ?? 0),
      vencimento: pendente ? (pendente.vencimento as string) : "",
      ultimoAcesso: ultimoAcesso
        ? new Date(ultimoAcesso.registrado_em as string).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      dependentes: [],
      mensalidades: [],
      acessos: [],
    };
  });
}

const DETAIL_SELECT = `
  *,
  planos ( id, nome, valor, dependentes_permitidos, beneficios, quantidade_mensalidades, dia_vencimento, regra_primeira_parcela, vencimento_na_contratacao ),
  dependentes ( id, nome, cpf, parentesco, nascimento, ativo ),
  mensalidades ( id, contrato_id, numero_parcela, total_parcelas, vencimento, valor, status, forma_pagamento, pago_em, gateway_charge_id, pagamentos ( forma_pagamento, pago_em ) ),
  credenciais ( id, codigo, ativa, acessos ( id, tipo, resultado, motivo, registrado_em, catracas ( nome, tipo ) ) )
`;

export async function getAssociadoById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ associado: Associado; planoId: string | null; credencialCodigo: string | null } | null> {
  const { data, error } = await supabase.from("associados").select(DETAIL_SELECT).eq("id", id).single();
  if (error || !data) return null;

  const row = data as unknown as Row;
  const plano = mapPlano(row.planos as Row | null);
  const mensalidades = ((row.mensalidades as Row[]) ?? []).map(mapMensalidade);
  const dependentes = ((row.dependentes as Row[]) ?? []).map(mapDependente);
  const acessos = ((row.credenciais as Row[]) ?? [])
    .flatMap((c) => (c.acessos as Row[]) ?? [])
    .map(mapAcesso)
    .sort((a, b) => `${b.data}${b.horario}`.localeCompare(`${a.data}${a.horario}`));

  const pendente = mensalidades
    .filter((m) => m.status !== "Pago" && m.status !== "Cancelado")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

  const credenciais = (row.credenciais as Row[]) ?? [];
  const credencialAtiva = credenciais.find((c) => c.ativa) ?? credenciais[0];

  return {
    associado: {
      id: row.id as string,
      numero: row.numero as string,
      nome: row.nome as string,
      cpf: row.cpf as string,
      rg: (row.rg as string) ?? "",
      nascimento: (row.nascimento as string) ?? "",
      email: (row.email as string) ?? "",
      telefone: (row.telefone as string) ?? "",
      cep: (row.cep as string) ?? "",
      endereco: (row.endereco as string) ?? "",
      numeroEndereco: (row.numero_endereco as string) ?? "",
      bairro: (row.bairro as string) ?? "",
      cidade: (row.cidade as string) ?? "",
      estado: (row.estado as string) ?? "",
      plano: plano?.nome ?? "—",
      status: row.status as AssociadoStatus,
      mensalidade: pendente ? pendente.valor : (plano?.valor ?? 0),
      vencimento: pendente ? pendente.vencimento : "",
      ultimoAcesso: acessos[0] ? `${acessos[0].data} ${acessos[0].horario}` : "—",
      dependentes,
      mensalidades,
      acessos,
    },
    planoId: plano?.id ?? null,
    credencialCodigo: (credencialAtiva?.codigo as string) ?? null,
  };
}

export async function getPlanos(supabase: SupabaseClient): Promise<Plano[]> {
  const { data, error } = await supabase.from("planos").select("*").eq("ativo", true).order("valor");
  if (error) throw error;
  return (data as unknown as Row[]).map((row) => mapPlano(row)!);
}

export async function getPlanosTodos(supabase: SupabaseClient): Promise<Plano[]> {
  const { data, error } = await supabase.from("planos").select("*").order("valor");
  if (error) throw error;
  return (data as unknown as Row[]).map((row) => mapPlano(row)!);
}
