type Resposta = { data: unknown[] | null; error: { message: string } | null };

const TAMANHO_PAGINA = 1000; // teto de linhas por requisição no Supabase (max-rows)

/**
 * Busca todas as linhas de uma consulta em páginas de 1000. O Supabase corta
 * silenciosamente qualquer `.limit()` acima de 1000, o que faria totais e
 * relatórios saírem errados em períodos grandes.
 *
 * `consulta` recebe o intervalo (from, to) e deve devolver a consulta já com
 * ORDER BY estável (senão as páginas podem repetir ou pular linhas).
 */
export async function buscarTodos<T>(
  consulta: (from: number, to: number) => PromiseLike<Resposta>,
  maxLinhas = 20_000,
): Promise<{ linhas: T[]; truncado: boolean }> {
  const linhas: T[] = [];
  for (let inicio = 0; inicio < maxLinhas; inicio += TAMANHO_PAGINA) {
    const { data, error } = await consulta(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return { linhas, truncado: false };
  }
  return { linhas, truncado: true };
}
