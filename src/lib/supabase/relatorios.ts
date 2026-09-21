import { SupabaseClient } from "@supabase/supabase-js";
import { dataBR, diaDaSemana, diasEntre, horaBR, hojeBR, somarDias } from "@/lib/datas-br";
import { formatCurrency } from "@/lib/utils";
import { buscarTodos } from "@/lib/supabase/paginar";
import { mapRecebimento, RECEBIMENTO_SELECT } from "@/lib/supabase/financeiro";
import { RELATORIOS, Relatorio, RelatorioId, Secao } from "@/lib/relatorios/tipos";

type Row = Record<string, unknown>;

const TZ_OFFSET = "-03:00";

const arred = (n: number) => Math.round(n * 100) / 100;
const soma = (itens: number[]) => arred(itens.reduce((s, v) => s + v, 0));
const numero = (n: number) => n.toLocaleString("pt-BR");

function limitesTimestamp(de: string, ate: string) {
  return { inicio: `${de}T00:00:00${TZ_OFFSET}`, fim: `${somarDias(ate, 1)}T00:00:00${TZ_OFFSET}` };
}

function aviso(truncado: boolean, avisos: string[]) {
  if (truncado) {
    avisos.push("O período tem mais registros do que o limite do relatório (20.000). Reduza o período para ver tudo.");
  }
}

// ----------------------------------------------------------------- pagamentos
async function buscarPagamentos(supabase: SupabaseClient, de: string, ate: string) {
  const { inicio, fim } = limitesTimestamp(de, ate);
  const { linhas, truncado } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("pagamentos")
      .select(RECEBIMENTO_SELECT)
      .gte("pago_em", inicio)
      .lt("pago_em", fim)
      .order("pago_em", { ascending: false })
      .order("id")
      .range(from, to),
  );
  return { itens: linhas.map(mapRecebimento), truncado };
}

// --------------------------------------------------------------------- acessos
interface Acesso {
  id: string;
  data: string; // ISO
  dia: string; // YYYY-MM-DD (Brasília)
  tipo: string;
  resultado: string;
  motivo: string | null;
  quem: string;
  origem: "Ingresso" | "Associado";
}

async function buscarAcessos(supabase: SupabaseClient, de: string, ate: string) {
  const { inicio, fim } = limitesTimestamp(de, ate);
  const { linhas, truncado } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("acessos")
      .select(
        "id, tipo, resultado, motivo, registrado_em, ingressos ( numero, comprador_nome ), credenciais ( associados ( nome ) )",
      )
      .gte("registrado_em", inicio)
      .lt("registrado_em", fim)
      .order("registrado_em", { ascending: false })
      .order("id")
      .range(from, to),
  );

  const itens: Acesso[] = linhas.map((row) => {
    const ingresso = row.ingressos as Row | null;
    const associado = (row.credenciais as Row | null)?.associados as Row | null | undefined;
    const registrado = row.registrado_em as string;
    return {
      id: row.id as string,
      data: registrado,
      dia: dataBR(registrado),
      tipo: row.tipo as string,
      resultado: row.resultado as string,
      motivo: (row.motivo as string) ?? null,
      origem: ingresso ? "Ingresso" : "Associado",
      quem: ingresso
        ? `${ingresso.numero as string}${ingresso.comprador_nome ? ` — ${ingresso.comprador_nome as string}` : ""}`
        : ((associado?.nome as string) ?? "—"),
    };
  });
  return { itens, truncado };
}

const entradaAutorizada = (a: Acesso) => a.resultado === "Autorizado" && (a.tipo === "Entrada" || a.tipo === "Reentrada");

// ------------------------------------------------------------------ relatórios
function cabecalho(id: RelatorioId, periodo: Relatorio["periodo"]): Relatorio {
  const meta = RELATORIOS.find((r) => r.id === id)!;
  return { id, titulo: meta.nome, periodo, resumo: [], secoes: [], avisos: [], geradoEm: new Date().toISOString() };
}

async function relVendas(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("vendas", { de, ate });
  const { itens, truncado } = await buscarPagamentos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const vendas = itens.filter((p) => p.valor > 0);
  const estornos = itens.filter((p) => p.valor < 0);
  const ingressos = vendas.filter((p) => p.tipo === "Ingresso");
  const mensalidades = vendas.filter((p) => p.tipo === "Mensalidade");
  const outros = vendas.filter((p) => p.tipo !== "Ingresso" && p.tipo !== "Mensalidade");

  rel.resumo = [
    { label: "Total vendido", valor: formatCurrency(soma(vendas.map((p) => p.valor))) },
    { label: "Ingressos", valor: `${numero(ingressos.length)} · ${formatCurrency(soma(ingressos.map((p) => p.valor)))}` },
    { label: "Mensalidades", valor: `${numero(mensalidades.length)} · ${formatCurrency(soma(mensalidades.map((p) => p.valor)))}` },
    ...(outros.length > 0
      ? [{ label: "Outros recebimentos", valor: `${numero(outros.length)} · ${formatCurrency(soma(outros.map((p) => p.valor)))}` }]
      : []),
    { label: "Estornos no período", valor: formatCurrency(Math.abs(soma(estornos.map((p) => p.valor)))) },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "data", label: "Data", tipo: "dataHora" },
        { key: "tipo", label: "Tipo" },
        { key: "origem", label: "Origem" },
        { key: "valor", label: "Valor", tipo: "moeda" },
        { key: "forma", label: "Forma de pagamento" },
        { key: "responsavel", label: "Responsável" },
      ],
      linhas: vendas.map((p) => ({ data: p.data, tipo: p.tipo, origem: p.origem, valor: p.valor, forma: p.forma, responsavel: p.responsavel })),
      totais: { origem: "Total", valor: soma(vendas.map((p) => p.valor)) },
    },
  ];
  return rel;
}

async function relFaturamento(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("faturamento", { de, ate });
  const { itens, truncado } = await buscarPagamentos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const porDia = new Map<string, { ingressos: number; mensalidades: number; outros: number; estornos: number }>();
  for (const p of itens) {
    const dia = dataBR(p.data);
    const linha = porDia.get(dia) ?? { ingressos: 0, mensalidades: 0, outros: 0, estornos: 0 };
    if (p.valor < 0) linha.estornos += p.valor;
    else if (p.tipo === "Mensalidade") linha.mensalidades += p.valor;
    else if (p.tipo === "Ingresso") linha.ingressos += p.valor;
    else linha.outros += p.valor;
    porDia.set(dia, linha);
  }

  const linhas = Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => ({
      dia,
      ingressos: arred(v.ingressos),
      mensalidades: arred(v.mensalidades),
      outros: arred(v.outros),
      estornos: arred(v.estornos),
      total: arred(v.ingressos + v.mensalidades + v.outros + v.estornos),
    }));
  const temOutros = linhas.some((l) => l.outros !== 0);

  const total = soma(linhas.map((l) => l.total));
  const melhor = linhas.reduce<(typeof linhas)[number] | null>((m, l) => (!m || l.total > m.total ? l : m), null);

  rel.resumo = [
    { label: "Receita líquida", valor: formatCurrency(total) },
    { label: "Dias com movimento", valor: numero(linhas.length) },
    { label: "Média por dia com movimento", valor: formatCurrency(linhas.length ? arred(total / linhas.length) : 0) },
    { label: "Melhor dia", valor: melhor ? `${melhor.dia.split("-").reverse().join("/")} · ${formatCurrency(melhor.total)}` : "—" },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "dia", label: "Data", tipo: "data" },
        { key: "ingressos", label: "Ingressos", tipo: "moeda" },
        { key: "mensalidades", label: "Mensalidades", tipo: "moeda" },
        ...(temOutros ? [{ key: "outros", label: "Outros", tipo: "moeda" as const }] : []),
        { key: "estornos", label: "Estornos", tipo: "moeda" },
        { key: "total", label: "Total do dia", tipo: "moeda" },
      ],
      linhas,
      totais: {
        dia: "Total",
        ingressos: soma(linhas.map((l) => l.ingressos)),
        mensalidades: soma(linhas.map((l) => l.mensalidades)),
        outros: soma(linhas.map((l) => l.outros)),
        estornos: soma(linhas.map((l) => l.estornos)),
        total,
      },
    },
  ];
  return rel;
}

async function relFormasPagamento(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("pagamentos", { de, ate });
  const { itens, truncado } = await buscarPagamentos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const porForma = new Map<string, { qtd: number; total: number }>();
  for (const p of itens) {
    const linha = porForma.get(p.forma) ?? { qtd: 0, total: 0 };
    linha.qtd += 1;
    linha.total += p.valor;
    porForma.set(p.forma, linha);
  }

  const total = soma(Array.from(porForma.values()).map((v) => v.total));
  const linhas = Array.from(porForma.entries())
    .map(([forma, v]) => ({
      forma,
      qtd: v.qtd,
      total: arred(v.total),
      participacao: total > 0 ? (v.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  rel.resumo = [
    { label: "Total líquido recebido", valor: formatCurrency(total) },
    { label: "Lançamentos", valor: numero(itens.length) },
    { label: "Forma mais usada", valor: linhas[0] ? `${linhas[0].forma} · ${formatCurrency(linhas[0].total)}` : "—" },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "forma", label: "Forma de pagamento" },
        { key: "qtd", label: "Lançamentos", tipo: "numero" },
        { key: "total", label: "Total (líquido)", tipo: "moeda" },
        { key: "participacao", label: "Participação", tipo: "percentual" },
      ],
      linhas,
      totais: { forma: "Total", qtd: itens.length, total, participacao: total > 0 ? 100 : 0 },
    },
  ];
  rel.avisos.push("Os valores são líquidos: estornos (cancelamentos de ingresso) abatem a forma de pagamento original.");
  return rel;
}

async function relEntradas(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("entradas", { de, ate });
  const { itens, truncado } = await buscarAcessos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const porDia = new Map<string, { ingressos: number; associados: number; reentradas: number; negados: number }>();
  for (const a of itens) {
    const linha = porDia.get(a.dia) ?? { ingressos: 0, associados: 0, reentradas: 0, negados: 0 };
    if (a.resultado !== "Autorizado") linha.negados += 1;
    else if (a.tipo === "Reentrada") linha.reentradas += 1;
    else if (a.tipo === "Entrada") {
      if (a.origem === "Ingresso") linha.ingressos += 1;
      else linha.associados += 1;
    }
    porDia.set(a.dia, linha);
  }

  const linhas = Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => ({ dia, ...v, total: v.ingressos + v.associados + v.reentradas }));

  const totalEntradas = linhas.reduce((s, l) => s + l.total, 0);
  rel.resumo = [
    { label: "Total de entradas", valor: numero(totalEntradas) },
    { label: "Acessos negados", valor: numero(linhas.reduce((s, l) => s + l.negados, 0)) },
    { label: "Dias com movimento", valor: numero(linhas.length) },
    { label: "Média por dia", valor: numero(linhas.length ? Math.round(totalEntradas / linhas.length) : 0) },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "dia", label: "Data", tipo: "data" },
        { key: "ingressos", label: "Ingressos", tipo: "numero" },
        { key: "associados", label: "Associados", tipo: "numero" },
        { key: "reentradas", label: "Reentradas", tipo: "numero" },
        { key: "total", label: "Total de entradas", tipo: "numero" },
        { key: "negados", label: "Negados", tipo: "numero" },
      ],
      linhas,
      totais: {
        dia: "Total",
        ingressos: linhas.reduce((s, l) => s + l.ingressos, 0),
        associados: linhas.reduce((s, l) => s + l.associados, 0),
        reentradas: linhas.reduce((s, l) => s + l.reentradas, 0),
        total: totalEntradas,
        negados: linhas.reduce((s, l) => s + l.negados, 0),
      },
    },
  ];
  rel.avisos.push("Os acessos ainda não registram qual catraca fez a leitura; por isso o relatório é agrupado por dia.");
  return rel;
}

async function relSaidas(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("saidas", { de, ate });
  const { itens, truncado } = await buscarAcessos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const saidas = itens.filter((a) => a.tipo === "Saída" && a.resultado === "Autorizado");
  const porDia = new Map<string, number>();
  for (const a of saidas) porDia.set(a.dia, (porDia.get(a.dia) ?? 0) + 1);
  const linhas = Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, total]) => ({ dia, total }));

  rel.resumo = [
    { label: "Total de saídas", valor: numero(saidas.length) },
    { label: "Dias com movimento", valor: numero(linhas.length) },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "dia", label: "Data", tipo: "data" },
        { key: "total", label: "Saídas", tipo: "numero" },
      ],
      linhas,
      totais: { dia: "Total", total: saidas.length },
    },
  ];
  if (saidas.length === 0) {
    rel.avisos.push(
      "Ainda não há saídas registradas: o sistema só registra entradas e reentradas (a leitura de saída na catraca não está implementada).",
    );
  }
  return rel;
}

async function relUtilizacao(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("utilizacao", { de, ate });
  const { itens, truncado } = await buscarAcessos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const entradas = itens.filter(entradaAutorizada);
  const porHora = new Array<number>(24).fill(0);
  const porSemana = new Array<number>(7).fill(0);
  const nomesSemana: string[] = new Array(7).fill("");
  const dias = new Set<string>();
  for (const a of entradas) {
    porHora[horaBR(a.data)] += 1;
    const d = diaDaSemana(a.dia);
    porSemana[d.indice] += 1;
    nomesSemana[d.indice] = d.nome;
    dias.add(a.dia);
  }

  const total = entradas.length;
  const horaPico = total > 0 ? porHora.indexOf(Math.max(...porHora)) : -1;
  const semanaPico = total > 0 ? porSemana.indexOf(Math.max(...porSemana)) : -1;
  const faixa = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String(h).padStart(2, "0")}:59`;

  rel.resumo = [
    { label: "Entradas no período", valor: numero(total) },
    { label: "Horário de pico", valor: horaPico >= 0 ? `${faixa(horaPico)} (${numero(porHora[horaPico])})` : "—" },
    { label: "Dia da semana mais movimentado", valor: semanaPico >= 0 ? `${nomesSemana[semanaPico]} (${numero(porSemana[semanaPico])})` : "—" },
    { label: "Média por dia com movimento", valor: numero(dias.size ? Math.round(total / dias.size) : 0) },
  ];

  const secaoHora: Secao = {
    titulo: "Por horário",
    colunas: [
      { key: "faixa", label: "Faixa horária" },
      { key: "entradas", label: "Entradas", tipo: "numero" },
      { key: "participacao", label: "Participação", tipo: "percentual" },
    ],
    linhas: porHora
      .map((qtd, h) => ({ faixa: faixa(h), entradas: qtd, participacao: total ? (qtd / total) * 100 : 0 }))
      .filter((l) => l.entradas > 0),
    totais: { faixa: "Total", entradas: total, participacao: total ? 100 : 0 },
  };
  const ordemSemana = [1, 2, 3, 4, 5, 6, 0];
  const nomePadrao = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const secaoSemana: Secao = {
    titulo: "Por dia da semana",
    colunas: [
      { key: "dia", label: "Dia da semana" },
      { key: "entradas", label: "Entradas", tipo: "numero" },
      { key: "participacao", label: "Participação", tipo: "percentual" },
    ],
    linhas: ordemSemana.map((i) => ({ dia: nomePadrao[i], entradas: porSemana[i], participacao: total ? (porSemana[i] / total) * 100 : 0 })),
    totais: { dia: "Total", entradas: total, participacao: total ? 100 : 0 },
  };
  rel.secoes = [secaoHora, secaoSemana];
  return rel;
}

async function relAcessos(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("acessos", { de, ate });
  const { itens, truncado } = await buscarAcessos(supabase, de, ate);
  aviso(truncado, rel.avisos);

  const autorizados = itens.filter((a) => a.resultado === "Autorizado").length;
  rel.resumo = [
    { label: "Registros", valor: numero(itens.length) },
    { label: "Autorizados", valor: numero(autorizados) },
    { label: "Negados / bloqueados", valor: numero(itens.length - autorizados) },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "data", label: "Data e hora", tipo: "dataHora" },
        { key: "quem", label: "Quem" },
        { key: "origem", label: "Origem" },
        { key: "tipo", label: "Tipo" },
        { key: "resultado", label: "Resultado" },
        { key: "motivo", label: "Motivo" },
      ],
      linhas: itens.map((a) => ({ data: a.data, quem: a.quem, origem: a.origem, tipo: a.tipo, resultado: a.resultado, motivo: a.motivo })),
    },
  ];
  return rel;
}

async function relAssociados(supabase: SupabaseClient): Promise<Relatorio> {
  const rel = cabecalho("associados", null);
  const { linhas, truncado } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("associados")
      .select("id, numero, nome, cpf, telefone, email, status, created_at, planos ( nome )")
      .order("nome")
      .order("id")
      .range(from, to),
  );
  aviso(truncado, rel.avisos);

  const porStatus = new Map<string, number>();
  for (const a of linhas) porStatus.set(a.status as string, (porStatus.get(a.status as string) ?? 0) + 1);

  rel.resumo = [
    { label: "Total de associados", valor: numero(linhas.length) },
    ...["Ativo", "Pendente", "Inadimplente", "Suspenso", "Inativo"]
      .filter((s) => porStatus.has(s))
      .map((s) => ({ label: s === "Ativo" ? "Ativos" : `${s}s`, valor: numero(porStatus.get(s)!) })),
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "numero", label: "Nº" },
        { key: "nome", label: "Nome" },
        { key: "cpf", label: "CPF" },
        { key: "plano", label: "Plano" },
        { key: "status", label: "Status" },
        { key: "telefone", label: "Telefone" },
        { key: "email", label: "E-mail" },
        { key: "cadastro", label: "Cadastro", tipo: "data" },
      ],
      linhas: linhas.map((a) => ({
        numero: a.numero as string,
        nome: a.nome as string,
        cpf: a.cpf as string,
        plano: ((a.planos as Row | null)?.nome as string) ?? "—",
        status: a.status as string,
        telefone: (a.telefone as string) ?? null,
        email: (a.email as string) ?? null,
        cadastro: dataBR(a.created_at as string),
      })),
    },
  ];
  rel.avisos.push("Este relatório mostra a base de associados na data de hoje; o filtro de período não se aplica.");
  return rel;
}

async function relInadimplencia(supabase: SupabaseClient, de: string, ate: string): Promise<Relatorio> {
  const rel = cabecalho("inadimplencia", { de, ate });
  const hoje = hojeBR();
  const limite = ate < hoje ? ate : somarDias(hoje, -1); // só o que já venceu

  const { linhas, truncado } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("mensalidades")
      .select("id, associado_id, vencimento, valor, associados ( nome, numero )")
      .in("status", ["Pendente", "Vencido"])
      .gte("vencimento", de)
      .lte("vencimento", limite)
      .order("vencimento")
      .order("id")
      .range(from, to),
  );
  aviso(truncado, rel.avisos);

  const porAssociado = new Map<string, { nome: string; numero: string; parcelas: number; valor: number; maisAntigo: string }>();
  for (const m of linhas) {
    const id = m.associado_id as string;
    const assoc = m.associados as Row | null;
    const vencimento = m.vencimento as string;
    const atual = porAssociado.get(id) ?? {
      nome: (assoc?.nome as string) ?? "—",
      numero: (assoc?.numero as string) ?? "",
      parcelas: 0,
      valor: 0,
      maisAntigo: vencimento,
    };
    atual.parcelas += 1;
    atual.valor += Number(m.valor);
    if (vencimento < atual.maisAntigo) atual.maisAntigo = vencimento;
    porAssociado.set(id, atual);
  }

  const itens = Array.from(porAssociado.values())
    .map((v) => ({
      nome: v.nome,
      numero: v.numero,
      parcelas: v.parcelas,
      valor: arred(v.valor),
      maisAntigo: v.maisAntigo,
      dias: diasEntre(v.maisAntigo, hoje),
    }))
    .sort((a, b) => b.valor - a.valor);

  const totalValor = soma(itens.map((i) => i.valor));
  const totalParcelas = itens.reduce((s, i) => s + i.parcelas, 0);
  rel.resumo = [
    { label: "Valor em atraso", valor: formatCurrency(totalValor) },
    { label: "Associados inadimplentes", valor: numero(itens.length) },
    { label: "Parcelas vencidas", valor: numero(totalParcelas) },
    { label: "Maior atraso", valor: itens.length ? `${numero(Math.max(...itens.map((i) => i.dias)))} dias` : "—" },
  ];
  rel.secoes = [
    {
      colunas: [
        { key: "nome", label: "Associado" },
        { key: "numero", label: "Nº" },
        { key: "parcelas", label: "Parcelas vencidas", tipo: "numero" },
        { key: "valor", label: "Valor em atraso", tipo: "moeda" },
        { key: "maisAntigo", label: "Vencimento mais antigo", tipo: "data" },
        { key: "dias", label: "Dias de atraso", tipo: "numero" },
      ],
      linhas: itens,
      totais: { nome: "Total", parcelas: totalParcelas, valor: totalValor },
    },
  ];
  rel.avisos.push("Considera mensalidades pendentes com vencimento dentro do período e anterior a hoje.");
  return rel;
}

export async function gerarRelatorio(
  supabase: SupabaseClient,
  id: RelatorioId,
  de: string,
  ate: string,
): Promise<Relatorio> {
  switch (id) {
    case "vendas":
      return relVendas(supabase, de, ate);
    case "entradas":
      return relEntradas(supabase, de, ate);
    case "saidas":
      return relSaidas(supabase, de, ate);
    case "associados":
      return relAssociados(supabase);
    case "inadimplencia":
      return relInadimplencia(supabase, de, ate);
    case "faturamento":
      return relFaturamento(supabase, de, ate);
    case "utilizacao":
      return relUtilizacao(supabase, de, ate);
    case "pagamentos":
      return relFormasPagamento(supabase, de, ate);
    case "acessos":
      return relAcessos(supabase, de, ate);
  }
}
