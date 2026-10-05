namespace CatracaPonte;

/// <summary>
/// Quem recebe o resultado de uma validação que não veio do leitor de QR da
/// catraca (hoje: o leitor facial) e mostra/libera o giro.
/// </summary>
public interface ILiberador
{
    /// <param name="quem">Descrição para o log (ex: "rosto 000042").</param>
    void Pedir(string quem, Validacao resultado);
}

/// <summary>Modo simulador: não há catraca, só registra o que seria feito.</summary>
public sealed class LiberadorSimulado : ILiberador
{
    public void Pedir(string quem, Validacao resultado) =>
        Log.Info(resultado.Autorizado
            ? $"LIBERADO  {quem} ({resultado.Nome}) [simulado]"
            : $"NEGADO    {quem} ({resultado.Motivo ?? resultado.Mensagem}) [simulado]");
}
