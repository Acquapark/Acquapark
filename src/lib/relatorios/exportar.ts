import { Coluna, Relatorio, Valor, formatarCelula, rotuloPeriodo } from "@/lib/relatorios/tipos";

function nomeArquivo(rel: Relatorio, extensao: string): string {
  const base = rel.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const periodo = rel.periodo ? `${rel.periodo.de}_a_${rel.periodo.ate}` : new Date().toISOString().slice(0, 10);
  return `relatorio-${base}-${periodo}.${extensao}`;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Texto de uma célula para planilha: números continuam números (vírgula decimal no CSV). */
function celulaCsv(valor: Valor | undefined, coluna: Coluna): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number" && (coluna.tipo === "moeda" || coluna.tipo === "percentual")) {
    return valor.toFixed(coluna.tipo === "moeda" ? 2 : 1).replace(".", ",");
  }
  if (typeof valor === "number") return String(valor).replace(".", ",");
  return formatarCelula(valor, coluna.tipo);
}

function escaparCsv(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function baixarCsv(rel: Relatorio) {
  const linhas: string[] = [];
  linhas.push(escaparCsv(`Relatório de ${rel.titulo}`));
  linhas.push(escaparCsv(`Período: ${rotuloPeriodo(rel.periodo)}`));
  for (const item of rel.resumo) linhas.push([escaparCsv(item.label), escaparCsv(item.valor)].join(";"));

  for (const secao of rel.secoes) {
    linhas.push("");
    if (secao.titulo) linhas.push(escaparCsv(secao.titulo));
    linhas.push(secao.colunas.map((c) => escaparCsv(c.label)).join(";"));
    for (const linha of secao.linhas) {
      linhas.push(secao.colunas.map((c) => escaparCsv(celulaCsv(linha[c.key], c))).join(";"));
    }
    if (secao.totais) {
      linhas.push(secao.colunas.map((c) => escaparCsv(celulaCsv(secao.totais![c.key], c))).join(";"));
    }
  }

  // BOM + ponto e vírgula: o Excel em português abre com acentos e colunas certos.
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  baixar(blob, nomeArquivo(rel, "csv"));
}

const FORMATO_EXCEL: Record<string, string> = {
  moeda: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  numero: "#,##0",
  percentual: '0.0"%"',
};

export async function baixarExcel(rel: Relatorio) {
  const { Workbook } = await import("exceljs"); // só carrega ao exportar
  const livro = new Workbook();
  livro.creator = "Aqua Park Manager";
  livro.created = new Date();

  const nomesUsados = new Set<string>();
  rel.secoes.forEach((secao, indice) => {
    let nome = (secao.titulo ?? rel.titulo).replace(/[\\/?*[\]:]/g, "").slice(0, 31) || `Aba ${indice + 1}`;
    while (nomesUsados.has(nome)) nome = `${nome.slice(0, 28)} ${indice + 1}`;
    nomesUsados.add(nome);

    const planilha = livro.addWorksheet(nome);
    let linhaAtual = 1;

    if (indice === 0) {
      planilha.getCell(linhaAtual, 1).value = `Relatório de ${rel.titulo}`;
      planilha.getCell(linhaAtual, 1).font = { bold: true, size: 14 };
      linhaAtual += 1;
      planilha.getCell(linhaAtual, 1).value = `Período: ${rotuloPeriodo(rel.periodo)}`;
      linhaAtual += 1;
      for (const item of rel.resumo) {
        planilha.getCell(linhaAtual, 1).value = item.label;
        planilha.getCell(linhaAtual, 1).font = { bold: true };
        planilha.getCell(linhaAtual, 2).value = item.valor;
        linhaAtual += 1;
      }
      linhaAtual += 1;
    }

    const cabecalho = planilha.getRow(linhaAtual);
    secao.colunas.forEach((c, i) => {
      const cel = cabecalho.getCell(i + 1);
      cel.value = c.label;
      cel.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    });
    linhaAtual += 1;

    const escrever = (dados: Record<string, Valor>, negrito: boolean) => {
      const linha = planilha.getRow(linhaAtual);
      secao.colunas.forEach((c, i) => {
        const valor = dados[c.key];
        const cel = linha.getCell(i + 1);
        const numerico = typeof valor === "number" && (c.tipo === "moeda" || c.tipo === "numero" || c.tipo === "percentual");
        if (numerico) {
          cel.value = valor;
          cel.numFmt = FORMATO_EXCEL[c.tipo as string];
        } else {
          cel.value = valor === null || valor === undefined ? "" : formatarCelula(valor, c.tipo);
        }
        if (negrito) cel.font = { bold: true };
      });
      linhaAtual += 1;
    };

    for (const linha of secao.linhas) escrever(linha, false);
    if (secao.totais) escrever(secao.totais, true);

    secao.colunas.forEach((c, i) => {
      const maior = Math.max(
        c.label.length,
        ...secao.linhas.slice(0, 200).map((l) => formatarCelula(l[c.key], c.tipo).length),
      );
      planilha.getColumn(i + 1).width = Math.min(Math.max(maior + 2, 10), 50);
    });
  });

  const buffer = await livro.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    nomeArquivo(rel, "xlsx"),
  );
}
