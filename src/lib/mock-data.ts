import {
  Associado,
  Catraca,
  Despesa,
  Ingresso,
  Plano,
  TipoIngresso,
} from "@/types";

export const planos: Plano[] = [
  { id: "p1", nome: "Individual", valor: 149.9, dependentesPermitidos: 0, beneficios: ["Acesso ilimitado", "Estacionamento"], quantidadeMensalidades: 12, diaVencimento: 10, regraPrimeiraParcela: "padrao", vencimentoNaContratacao: false, ativo: true },
  { id: "p2", nome: "Familiar", valor: 349.9, dependentesPermitidos: 4, beneficios: ["Acesso ilimitado", "4 dependentes", "Estacionamento", "Área vip"], quantidadeMensalidades: 12, diaVencimento: 10, regraPrimeiraParcela: "padrao", vencimentoNaContratacao: false, ativo: true },
  { id: "p3", nome: "Casal", valor: 229.9, dependentesPermitidos: 1, beneficios: ["Acesso ilimitado", "1 dependente"], quantidadeMensalidades: 6, diaVencimento: 5, regraPrimeiraParcela: "padrao", vencimentoNaContratacao: false, ativo: true },
  { id: "p4", nome: "Premium", valor: 499.9, dependentesPermitidos: 6, beneficios: ["Acesso ilimitado", "6 dependentes", "Área vip", "Toalhas inclusas"], quantidadeMensalidades: 12, diaVencimento: 15, regraPrimeiraParcela: "padrao", vencimentoNaContratacao: false, ativo: true },
];

export const associados: Associado[] = [
  {
    id: "1",
    numero: "000184",
    nome: "João da Silva",
    cpf: "123.456.789-00",
    email: "joao.silva@email.com",
    telefone: "(11) 98877-6655",
    plano: "Familiar",
    status: "Ativo",
    mensalidade: 349.9,
    vencimento: "2026-09-05",
    ultimoAcesso: "2026-09-14 10:32",
    dependentes: [
      { id: "d1", nome: "Maria da Silva", cpf: "111.222.333-44", parentesco: "Cônjuge", nascimento: "1988-04-12", status: "Ativo" },
      { id: "d2", nome: "Pedro da Silva", cpf: "222.333.444-55", parentesco: "Filho", nascimento: "2014-06-30", status: "Ativo" },
    ],
    mensalidades: [
      { id: "m1", vencimento: "2026-09-05", valor: 349.9, status: "Pago", formaPagamento: "Cartão de crédito", pagamentoEm: "2026-09-04" },
      { id: "m2", vencimento: "2026-08-05", valor: 349.9, status: "Pago", formaPagamento: "Pix", pagamentoEm: "2026-08-05" },
      { id: "m3", vencimento: "2026-10-05", valor: 349.9, status: "Pendente" },
    ],
    acessos: [
      { id: "a1", data: "2026-09-14", horario: "10:32", tipo: "Entrada", catraca: "Catraca 01 — Entrada", resultado: "Autorizado" },
      { id: "a2", data: "2026-09-14", horario: "16:10", tipo: "Saída", catraca: "Catraca 03 — Saída", resultado: "Autorizado" },
      { id: "a3", data: "2026-09-10", horario: "09:15", tipo: "Entrada", catraca: "Catraca 01 — Entrada", resultado: "Autorizado" },
    ],
  },
  {
    id: "2",
    numero: "000185",
    nome: "Ana Beatriz Costa",
    cpf: "234.567.891-02",
    email: "ana.costa@email.com",
    telefone: "(11) 97766-5544",
    plano: "Individual",
    status: "Pendente",
    mensalidade: 149.9,
    vencimento: "2026-09-20",
    ultimoAcesso: "2026-09-12 14:05",
    dependentes: [],
    mensalidades: [
      { id: "m4", vencimento: "2026-09-20", valor: 149.9, status: "Pendente" },
      { id: "m5", vencimento: "2026-08-20", valor: 149.9, status: "Pago", formaPagamento: "Boleto", pagamentoEm: "2026-08-21" },
    ],
    acessos: [{ id: "a4", data: "2026-09-12", horario: "14:05", tipo: "Entrada", catraca: "Catraca 02 — Entrada", resultado: "Autorizado" }],
  },
  {
    id: "3",
    numero: "000186",
    nome: "Carlos Eduardo Souza",
    cpf: "345.678.912-03",
    email: "carlos.souza@email.com",
    telefone: "(11) 96655-4433",
    plano: "Casal",
    status: "Inadimplente",
    mensalidade: 229.9,
    vencimento: "2026-08-15",
    ultimoAcesso: "2026-08-02 11:20",
    dependentes: [{ id: "d3", nome: "Fernanda Souza", cpf: "333.444.555-66", parentesco: "Cônjuge", nascimento: "1990-01-22", status: "Ativo" }],
    mensalidades: [
      { id: "m6", vencimento: "2026-08-15", valor: 229.9, status: "Vencido" },
      { id: "m7", vencimento: "2026-07-15", valor: 229.9, status: "Vencido" },
    ],
    acessos: [{ id: "a5", data: "2026-08-02", horario: "11:20", tipo: "Entrada", catraca: "Catraca 01 — Entrada", resultado: "Negado", motivo: "Associação inadimplente" }],
  },
  {
    id: "4",
    numero: "000187",
    nome: "Patrícia Lima",
    cpf: "456.789.123-04",
    email: "patricia.lima@email.com",
    telefone: "(11) 95544-3322",
    plano: "Premium",
    status: "Ativo",
    mensalidade: 499.9,
    vencimento: "2026-09-08",
    ultimoAcesso: "2026-09-15 08:45",
    dependentes: [
      { id: "d4", nome: "Lucas Lima", cpf: "444.555.666-77", parentesco: "Filho", nascimento: "2010-11-02", status: "Ativo" },
      { id: "d5", nome: "Beatriz Lima", cpf: "555.666.777-88", parentesco: "Filha", nascimento: "2012-03-18", status: "Ativo" },
    ],
    mensalidades: [{ id: "m8", vencimento: "2026-09-08", valor: 499.9, status: "Pago", formaPagamento: "Cartão de crédito", pagamentoEm: "2026-09-07" }],
    acessos: [{ id: "a6", data: "2026-09-15", horario: "08:45", tipo: "Entrada", catraca: "Catraca 02 — Entrada", resultado: "Autorizado" }],
  },
  {
    id: "5",
    numero: "000188",
    nome: "Roberto Almeida",
    cpf: "567.891.234-05",
    email: "roberto.almeida@email.com",
    telefone: "(11) 94433-2211",
    plano: "Individual",
    status: "Suspenso",
    mensalidade: 149.9,
    vencimento: "2026-07-10",
    ultimoAcesso: "2026-07-01 17:30",
    dependentes: [],
    mensalidades: [{ id: "m9", vencimento: "2026-07-10", valor: 149.9, status: "Cancelado" }],
    acessos: [{ id: "a7", data: "2026-07-01", horario: "17:30", tipo: "Saída", catraca: "Catraca 03 — Saída", resultado: "Autorizado" }],
  },
  {
    id: "6",
    numero: "000189",
    nome: "Juliana Ferreira",
    cpf: "678.912.345-06",
    email: "juliana.ferreira@email.com",
    telefone: "(11) 93322-1100",
    plano: "Familiar",
    status: "Inativo",
    mensalidade: 349.9,
    vencimento: "2026-05-05",
    ultimoAcesso: "2026-04-20 12:00",
    dependentes: [],
    mensalidades: [],
    acessos: [],
  },
];

export const tiposIngresso: TipoIngresso[] = [
  { id: "t1", nome: "Diária Adulto", descricao: "Acesso de um dia para visitantes adultos", valor: 89.9, validade: "1 dia", regraReentrada: "unica", ativo: true },
  { id: "t2", nome: "Diária Infantil", descricao: "Acesso de um dia para crianças de 3 a 11 anos", valor: 59.9, validade: "1 dia", regraReentrada: "unica", ativo: true },
  { id: "t3", nome: "Diária Família (4 pessoas)", descricao: "Combo família com desconto", valor: 279.9, validade: "1 dia", regraReentrada: "unica", ativo: true },
  { id: "t4", nome: "Meia-entrada", descricao: "Estudantes e idosos, mediante documento", valor: 44.9, validade: "1 dia", regraReentrada: "unica", ativo: true },
];

export const ingressos: Ingresso[] = [
  { id: "i1", numero: "ING-10234", tipo: "Diária Adulto", dataUtilizacao: "2026-09-16", valor: 89.9, status: "Utilizado", comprador: "Marcos Vinícius" },
  { id: "i2", numero: "ING-10235", tipo: "Diária Infantil", dataUtilizacao: "2026-09-16", valor: 59.9, status: "Utilizado", comprador: "Marcos Vinícius" },
  { id: "i3", numero: "ING-10236", tipo: "Diária Família (4 pessoas)", dataUtilizacao: "2026-09-17", valor: 279.9, status: "Disponível", comprador: "Renata Alves" },
  { id: "i4", numero: "ING-10237", tipo: "Meia-entrada", dataUtilizacao: "2026-09-15", valor: 44.9, status: "Expirado", comprador: "Diego Martins" },
  { id: "i5", numero: "ING-10238", tipo: "Diária Adulto", dataUtilizacao: "2026-09-14", valor: 89.9, status: "Cancelado", comprador: "Camila Rocha" },
];

export const catracas: Catraca[] = [
  { id: "c1", nome: "Catraca 01", local: "Portaria Principal", tipo: "Entrada", status: "Online" },
  { id: "c2", nome: "Catraca 02", local: "Acesso Lateral", tipo: "Entrada", status: "Online" },
  { id: "c3", nome: "Catraca 03", local: "Portaria Principal", tipo: "Saída", status: "Online" },
  { id: "c4", nome: "Catraca 04", local: "Acesso VIP", tipo: "Bidirecional", status: "Manutenção" },
  { id: "c5", nome: "Catraca 05", local: "Acesso Lateral", tipo: "Saída", status: "Offline" },
];

export const despesas: Despesa[] = [
  { id: "e1", descricao: "Manutenção de bombas hidráulicas", categoria: "Manutenção", valor: 3200, vencimento: "2026-09-20", status: "Pendente" },
  { id: "e2", descricao: "Produtos químicos para tratamento", categoria: "Insumos", valor: 1850, vencimento: "2026-09-10", status: "Pago" },
  { id: "e3", descricao: "Folha de pagamento — Setembro", categoria: "Pessoal", valor: 42500, vencimento: "2026-09-05", status: "Pago" },
  { id: "e4", descricao: "Energia elétrica", categoria: "Utilidades", valor: 6720, vencimento: "2026-08-28", status: "Vencido" },
];

export const faturamentoMensal = [
  { mes: "Abr", valor: 68000 },
  { mes: "Mai", valor: 74500 },
  { mes: "Jun", valor: 91200 },
  { mes: "Jul", valor: 118400 },
  { mes: "Ago", valor: 132900 },
  { mes: "Set", valor: 97600 },
];

export const entradasSemana = [
  { dia: "Seg", entradas: 210 },
  { dia: "Ter", entradas: 185 },
  { dia: "Qua", entradas: 198 },
  { dia: "Qui", entradas: 220 },
  { dia: "Sex", entradas: 312 },
  { dia: "Sáb", entradas: 540 },
  { dia: "Dom", entradas: 601 },
];
