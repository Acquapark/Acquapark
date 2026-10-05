using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace CatracaPonte;

public sealed record Validacao(bool Autorizado, string Mensagem, bool FalhaConexao = false, string? Nome = null, string? Motivo = null);

/// <summary>Um associado com foto, como o sistema devolve em GET /api/catraca/faces.</summary>
public sealed record Rosto(string Numero, string Nome, string FotoUrl, string Versao);

/// <summary>Chama as rotas /api/catraca/* do Aqua Park Manager.</summary>
public sealed class SistemaApi : IDisposable
{
    private readonly HttpClient _http;
    // Sem o header x-api-key: as fotos vêm de links temporários do Supabase
    // Storage, e a chave da catraca não deve ir para outro servidor.
    private readonly HttpClient _download = new() { Timeout = TimeSpan.FromSeconds(30) };

    public SistemaApi(SistemaConfig config)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(config.Url + "/"),
            Timeout = TimeSpan.FromMilliseconds(config.TimeoutMs),
        };
        _http.DefaultRequestHeaders.Add("x-api-key", config.ChaveApi);
    }

    /// <summary>QR Code lido na catraca.</summary>
    public Task<Validacao> ValidarAsync(string codigo) => ValidarCorpoAsync(new { qrCode = codigo }, codigo);

    /// <summary>Rosto reconhecido no leitor facial (o leitor identifica pelo número do associado).</summary>
    public Task<Validacao> ValidarAssociadoAsync(string numero) =>
        ValidarCorpoAsync(new { associadoNumero = numero }, $"associado {numero}");

    private async Task<Validacao> ValidarCorpoAsync(object corpoRequisicao, string codigo)
    {
        try
        {
            using var resposta = await _http.PostAsJsonAsync("api/catraca/validar", corpoRequisicao);

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
                : new Validacao(corpo.Autorizado, corpo.Mensagem ?? "", Nome: corpo.Nome, Motivo: corpo.Motivo);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            Log.Erro($"Sem resposta do sistema ({ex.GetType().Name}: {ex.Message}).");
            return new Validacao(false, "INVALIDO", FalhaConexao: true);
        }
    }

    /// <summary>Associados com foto que devem estar no leitor facial. null = falha ao falar com o sistema.</summary>
    public async Task<List<Rosto>?> ListarRostosAsync(CancellationToken parar)
    {
        try
        {
            using var resposta = await _http.GetAsync("api/catraca/faces", parar);
            if (!resposta.IsSuccessStatusCode)
            {
                Log.Erro($"O sistema respondeu HTTP {(int)resposta.StatusCode} ao listar os rostos.");
                return null;
            }
            var corpo = await resposta.Content.ReadFromJsonAsync<RespostaRostos>(parar);
            return corpo?.Rostos
                .Where(r => !string.IsNullOrEmpty(r.Numero) && !string.IsNullOrEmpty(r.FotoUrl))
                .Select(r => new Rosto(r.Numero!, r.Nome ?? "", r.FotoUrl!, r.Versao ?? ""))
                .ToList();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            Log.Erro($"Sem resposta do sistema ao listar os rostos ({ex.GetType().Name}: {ex.Message}).");
            return null;
        }
    }

    public async Task<byte[]?> BaixarFotoAsync(string url, CancellationToken parar)
    {
        try
        {
            return await _download.GetByteArrayAsync(url, parar);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            Log.Erro($"Não foi possível baixar a foto ({ex.Message}).");
            return null;
        }
    }

    public void Dispose()
    {
        _http.Dispose();
        _download.Dispose();
    }

    private sealed class RespostaApi
    {
        [JsonPropertyName("autorizado")] public bool Autorizado { get; set; }
        [JsonPropertyName("mensagem")] public string? Mensagem { get; set; }
        [JsonPropertyName("nome")] public string? Nome { get; set; }
        [JsonPropertyName("motivo")] public string? Motivo { get; set; }
    }

    private sealed class RespostaRostos
    {
        [JsonPropertyName("rostos")] public List<RostoApi> Rostos { get; set; } = [];
    }

    private sealed class RostoApi
    {
        [JsonPropertyName("numero")] public string? Numero { get; set; }
        [JsonPropertyName("nome")] public string? Nome { get; set; }
        [JsonPropertyName("fotoUrl")] public string? FotoUrl { get; set; }
        [JsonPropertyName("versao")] public string? Versao { get; set; }
    }
}
