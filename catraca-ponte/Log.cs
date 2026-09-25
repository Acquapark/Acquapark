namespace CatracaPonte;

/// <summary>Escreve no console e em logs/ponte-AAAA-MM-DD.log, ao lado do .exe.</summary>
public static class Log
{
    private static readonly object Trava = new();
    private static readonly string Pasta = Path.Combine(AppContext.BaseDirectory, "logs");

    public static void Info(string mensagem) => Escrever("INFO", mensagem);
    public static void Erro(string mensagem) => Escrever("ERRO", mensagem);

    private static void Escrever(string nivel, string mensagem)
    {
        var agora = DateTime.Now;
        var linha = $"{agora:yyyy-MM-dd HH:mm:ss} [{nivel}] {mensagem}";
        lock (Trava)
        {
            Console.WriteLine(linha);
            try
            {
                Directory.CreateDirectory(Pasta);
                File.AppendAllText(Path.Combine(Pasta, $"ponte-{agora:yyyy-MM-dd}.log"), linha + Environment.NewLine);
            }
            catch (IOException)
            {
                // Log em arquivo é só conveniência: nunca derruba a catraca por causa dele.
            }
        }
    }
}
