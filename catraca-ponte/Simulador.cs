namespace CatracaPonte;

/// <summary>
/// Modo de teste sem catraca: cada linha digitada é tratada como um QR Code
/// lido. Confirma que o PC alcança o sistema e que a chave está certa.
/// </summary>
public static class Simulador
{
    public static async Task ExecutarAsync(Configuracao config, SistemaApi api, CancellationToken parar)
    {
        Console.WriteLine("Digite (ou leia com um leitor USB) o código do QR e tecle Enter. Linha vazia sai.");
        while (!parar.IsCancellationRequested)
        {
            Console.Write("> ");
            var lido = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(lido))
                return;

            var codigo = Codigo.Normalizar(lido, config.Catraca.DigitosCodigo);
            var resultado = await api.ValidarAsync(codigo);
            Log.Info(resultado.Autorizado
                ? $"LIBERADO  {codigo} ({resultado.Mensagem})"
                : $"NEGADO    {codigo} ({(resultado.FalhaConexao ? "falha ao falar com o sistema" : resultado.Mensagem)})");
        }
    }
}
