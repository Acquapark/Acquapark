using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace CatracaPonte;

public sealed record Validacao(bool Autorizado, string Mensagem, bool FalhaConexao = false);

/// <summary>Chama POST /api/catraca/validar do Aqua Park Manager.</summary>
public sealed class SistemaApi : IDisposable
{
    private readonly HttpClient _http;

    public SistemaApi(SistemaConfig config)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(config.Url + "/"),
            Timeout = TimeSpan.FromMilliseconds(config.TimeoutMs),
        };
        _http.DefaultRequestHeaders.Add("x-api-key", config.ChaveApi);
    }

    public async Task<Validacao> ValidarAsync(string codigo)
    {
        try
        {
            using var resposta = await _http.PostAsJsonAsync("api/catraca/validar", new { qrCode = codigo });

            if (resposta.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Erro("O sistema recusou a chave (401): confira Sistema.ChaveApi e a CATRACA_API_KEY do servidor.");
                return new Validacao(false, "INVALIDO", FalhaConexao: true);
            }
            if (!resposta.IsSuccessStatusCode)
            {
                Log.Erro($"O sistema respondeu HTTP {(int)resposta.StatusCode} para o código {codigo}.");
                return new Validacao(false, "INVALIDO", FalhaConexao: true);
            }

            var corpo = await resposta.Content.ReadFromJsonAsync<RespostaApi>();
            return corpo is null
                ? new Validacao(false, "INVALIDO", FalhaConexao: true)
                : new Validacao(corpo.Autorizado, corpo.Mensagem ?? "");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            Log.Erro($"Sem resposta do sistema ({ex.GetType().Name}: {ex.Message}).");
            return new Validacao(false, "INVALIDO", FalhaConexao: true);
        }
    }

    public void Dispose() => _http.Dispose();

    private sealed class RespostaApi
    {
        [JsonPropertyName("autorizado")] public bool Autorizado { get; set; }
        [JsonPropertyName("mensagem")] public string? Mensagem { get; set; }
    }
}
