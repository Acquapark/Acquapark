using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace CatracaPonte;

/// <summary>Resultado de um comando ISAPI: OK, ou o motivo do erro devolvido pelo aparelho.</summary>
public sealed record RespostaIsapi(bool Ok, int Http, string SubStatus, string Corpo)
{
    public bool NaoSuportado => Http == 404 || SubStatus.Contains("notSupport", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// Conversa com o leitor facial Hikvision (linha MinMoe, ex: DS-K1T673DX) pelo
/// protocolo ISAPI — HTTP com autenticação Digest, na rede local. Só o que a
/// ponte usa: cadastrar/remover pessoa, enviar a foto, acionar o relé e ouvir
/// os eventos de reconhecimento. As rotas seguem a documentação ISAPI de
/// controle de acesso; se o firmware do seu aparelho responder diferente, o
/// log mostra a resposta completa.
/// </summary>
public sealed class HikvisionIsapi : IDisposable
{
    private readonly LeitorFacialConfig _config;
    private readonly HttpClient _http;
    private readonly HttpClient _stream;

    public HikvisionIsapi(LeitorFacialConfig config)
    {
        _config = config;
        var baseUri = new Uri($"{(config.UsarHttps ? "https" : "http")}://{config.Ip}:{config.Porta}/");
        _http = Criar(baseUri, TimeSpan.FromMilliseconds(config.TimeoutMs));
        // O alertStream é uma conexão que fica aberta indefinidamente.
        _stream = Criar(baseUri, Timeout.InfiniteTimeSpan);
    }

    private HttpClient Criar(Uri baseUri, TimeSpan timeout)
    {
        var handler = new HttpClientHandler
        {
            // NetworkCredential responde ao desafio Digest do aparelho automaticamente.
            Credentials = new NetworkCredential(_config.Usuario, _config.Senha),
            PreAuthenticate = true,
        };
        if (_config.UsarHttps)
            // Os leitores vêm com certificado autoassinado.
            handler.ServerCertificateCustomValidationCallback = (_, _, _, _) => true;
        return new HttpClient(handler) { BaseAddress = baseUri, Timeout = timeout };
    }

    public async Task<RespostaIsapi> InformacoesAsync(CancellationToken parar)
    {
        using var resposta = await _http.GetAsync("ISAPI/System/deviceInfo", parar);
        return await LerAsync(resposta, parar);
    }

    /// <summary>Cadastra a pessoa (ou atualiza o nome, se já existir). employeeNo = número do associado.</summary>
    public async Task<RespostaIsapi> SalvarPessoaAsync(string numero, string nome, CancellationToken parar)
    {
        var corpo = new
        {
            UserInfo = new
            {
                employeeNo = numero,
                // O aparelho limita o nome (32 bytes em boa parte dos firmwares).
                name = Limitar(nome, 32),
                userType = "normal",
                Valid = new { enable = true, beginTime = "2020-01-01T00:00:00", endTime = "2037-12-31T23:59:59", timeType = "local" },
                doorRight = "1",
                RightPlan = new[] { new { doorNo = 1, planTemplateNo = "1" } },
            },
        };

        var criar = await EnviarJsonAsync(HttpMethod.Post, "ISAPI/AccessControl/UserInfo/Record?format=json", corpo, parar);
        if (criar.Ok || !criar.SubStatus.Contains("AlreadyExist", StringComparison.OrdinalIgnoreCase))
            return criar;
        return await EnviarJsonAsync(HttpMethod.Put, "ISAPI/AccessControl/UserInfo/Modify?format=json", corpo, parar);
    }

    /// <summary>Envia (ou troca) a foto do rosto da pessoa já cadastrada.</summary>
    public async Task<RespostaIsapi> SalvarRostoAsync(string numero, byte[] jpeg, CancellationToken parar)
    {
        var dados = JsonSerializer.Serialize(new { faceLibType = "blackFD", FDID = "1", FPID = numero });

        // FDSetUp cria ou substitui; firmwares mais antigos só têm FaceDataRecord (cria).
        var setup = await EnviarRostoAsync(HttpMethod.Put, "ISAPI/Intelligent/FDLib/FDSetUp?format=json", dados, jpeg, parar);
        if (setup.Ok || !setup.NaoSuportado)
            return setup;
        return await EnviarRostoAsync(HttpMethod.Post, "ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", dados, jpeg, parar);
    }

    /// <summary>Remove a pessoa e o rosto dela do aparelho.</summary>
    public Task<RespostaIsapi> RemoverPessoaAsync(string numero, CancellationToken parar)
    {
        var corpo = new { UserInfoDelCond = new { EmployeeNoList = new[] { new { employeeNo = numero } } } };
        return EnviarJsonAsync(HttpMethod.Put, "ISAPI/AccessControl/UserInfo/Delete?format=json", corpo, parar);
    }

    /// <summary>Aciona o relé da porta do leitor (para quando ele está ligado na catraca).</summary>
    public async Task<RespostaIsapi> AbrirPortaAsync(int porta, CancellationToken parar)
    {
        const string xml =
            "<RemoteControlDoor version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\"><cmd>open</cmd></RemoteControlDoor>";
        using var conteudo = new StringContent(xml, Encoding.UTF8, "application/xml");
        using var resposta = await _http.PutAsync($"ISAPI/AccessControl/RemoteControl/door/{porta}", conteudo, parar);
        return await LerAsync(resposta, parar);
    }

    /// <summary>
    /// Abre o alertStream (eventos em tempo real, multipart) e entrega cada
    /// evento JSON recebido. Retorna quando a conexão cai — quem chama reconecta.
    /// </summary>
    public async Task OuvirEventosAsync(Func<JsonElement, Task> aoReceber, CancellationToken parar)
    {
        using var resposta = await _stream.GetAsync("ISAPI/Event/notification/alertStream", HttpCompletionOption.ResponseHeadersRead, parar);
        if (!resposta.IsSuccessStatusCode)
            throw new HttpRequestException($"alertStream respondeu HTTP {(int)resposta.StatusCode}.");

        await using var corpo = await resposta.Content.ReadAsStreamAsync(parar);
        var leitor = new LeitorMultipart(corpo);
        while (!parar.IsCancellationRequested)
        {
            var parte = await leitor.ProximaParteAsync(parar);
            if (parte is null)
                return;
            if (!parte.Value.ContentType.Contains("json", StringComparison.OrdinalIgnoreCase))
                continue; // imagens do evento, XML de heartbeat etc.
            try
            {
                using var json = JsonDocument.Parse(parte.Value.Corpo);
                await aoReceber(json.RootElement.Clone());
            }
            catch (JsonException)
            {
                Log.Erro($"Evento do leitor facial com JSON inválido: {Limitar(Encoding.UTF8.GetString(parte.Value.Corpo), 300)}");
            }
        }
    }

    private async Task<RespostaIsapi> EnviarJsonAsync(HttpMethod metodo, string rota, object corpo, CancellationToken parar)
    {
        using var requisicao = new HttpRequestMessage(metodo, rota)
        {
            Content = new StringContent(JsonSerializer.Serialize(corpo), Encoding.UTF8, "application/json"),
        };
        using var resposta = await _http.SendAsync(requisicao, parar);
        return await LerAsync(resposta, parar);
    }

    private async Task<RespostaIsapi> EnviarRostoAsync(HttpMethod metodo, string rota, string dados, byte[] jpeg, CancellationToken parar)
    {
        using var multipart = new MultipartFormDataContent();
        var parteDados = new StringContent(dados, Encoding.UTF8, "application/json");
        multipart.Add(parteDados, "FaceDataRecord");
        var parteImagem = new ByteArrayContent(jpeg);
        parteImagem.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(parteImagem, "img", "rosto.jpg");

        using var requisicao = new HttpRequestMessage(metodo, rota) { Content = multipart };
        using var resposta = await _http.SendAsync(requisicao, parar);
        return await LerAsync(resposta, parar);
    }

    private static async Task<RespostaIsapi> LerAsync(HttpResponseMessage resposta, CancellationToken parar)
    {
        var corpo = await resposta.Content.ReadAsStringAsync(parar);
        var http = (int)resposta.StatusCode;
        if (resposta.StatusCode == HttpStatusCode.Unauthorized)
            return new RespostaIsapi(false, http, "unauthorized", "Usuário ou senha do leitor facial incorretos.");

        // Respostas JSON: { "statusCode": 1, "statusString": "OK", "subStatusCode": "ok" }.
        // Respostas XML (rotas sem ?format=json): <statusCode>1</statusCode> ... <subStatusCode>ok</subStatusCode>.
        var subStatus = "";
        var statusOk = resposta.IsSuccessStatusCode;
        try
        {
            using var json = JsonDocument.Parse(corpo);
            if (json.RootElement.TryGetProperty("subStatusCode", out var sub))
                subStatus = sub.GetString() ?? "";
            if (json.RootElement.TryGetProperty("statusCode", out var st) && st.ValueKind == JsonValueKind.Number)
                statusOk = statusOk && st.GetInt32() == 1;
        }
        catch (JsonException)
        {
            var sub = System.Text.RegularExpressions.Regex.Match(corpo, "<subStatusCode>([^<]*)</subStatusCode>");
            if (sub.Success)
                subStatus = sub.Groups[1].Value;
            var st = System.Text.RegularExpressions.Regex.Match(corpo, "<statusCode>([^<]*)</statusCode>");
            if (st.Success)
                statusOk = statusOk && st.Groups[1].Value.Trim() == "1";
        }
        return new RespostaIsapi(statusOk, http, subStatus, corpo);
    }

    private static string Limitar(string texto, int max) => texto.Length <= max ? texto : texto[..max];

    public void Dispose()
    {
        _http.Dispose();
        _stream.Dispose();
    }
}

/// <summary>
/// Lê um corpo multipart/mixed contínuo (o alertStream da Hikvision): cada
/// parte tem cabeçalhos (Content-Type, Content-Length) e o conteúdo.
/// </summary>
internal sealed class LeitorMultipart
{
    private readonly Stream _stream;
    private readonly byte[] _buffer = new byte[8192];
    private int _inicio;
    private int _fim;
    private string? _linhaPendente;

    public LeitorMultipart(Stream stream) => _stream = stream;

    public async Task<(string ContentType, byte[] Corpo)?> ProximaParteAsync(CancellationToken parar)
    {
        // Avança até a linha de fronteira ("--boundary").
        string? linha;
        while (true)
        {
            linha = _linhaPendente ?? await LerLinhaAsync(parar);
            _linhaPendente = null;
            if (linha is null)
                return null;
            if (linha.StartsWith("--"))
                break;
        }

        var contentType = "";
        int? tamanho = null;
        while ((linha = await LerLinhaAsync(parar)) is not null && linha.Length > 0)
        {
            var separador = linha.IndexOf(':');
            if (separador <= 0)
                continue;
            var nome = linha[..separador].Trim();
            var valor = linha[(separador + 1)..].Trim();
            if (nome.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                contentType = valor;
            else if (nome.Equals("Content-Length", StringComparison.OrdinalIgnoreCase) && int.TryParse(valor, out var n))
                tamanho = n;
        }
        if (linha is null)
            return null;

        if (tamanho is int total)
        {
            var corpo = new byte[total];
            var lidos = 0;
            while (lidos < total)
            {
                if (_inicio == _fim && !await EncherAsync(parar))
                    return null;
                var n = Math.Min(total - lidos, _fim - _inicio);
                Array.Copy(_buffer, _inicio, corpo, lidos, n);
                _inicio += n;
                lidos += n;
            }
            return (contentType, corpo);
        }

        // Sem Content-Length: o conteúdo vai até a próxima fronteira.
        var texto = new StringBuilder();
        while ((linha = await LerLinhaAsync(parar)) is not null)
        {
            if (linha.StartsWith("--"))
            {
                _linhaPendente = linha;
                break;
            }
            texto.AppendLine(linha);
        }
        return (contentType, Encoding.UTF8.GetBytes(texto.ToString()));
    }

    private async Task<string?> LerLinhaAsync(CancellationToken parar)
    {
        var bytes = new List<byte>();
        while (true)
        {
            if (_inicio == _fim && !await EncherAsync(parar))
                return bytes.Count > 0 ? Encoding.UTF8.GetString(bytes.ToArray()) : null;
            var b = _buffer[_inicio++];
            if (b == (byte)'\n')
                return Encoding.UTF8.GetString(bytes.ToArray()).TrimEnd('\r');
            bytes.Add(b);
        }
    }

    private async Task<bool> EncherAsync(CancellationToken parar)
    {
        _inicio = 0;
        _fim = await _stream.ReadAsync(_buffer, parar);
        return _fim > 0;
    }
}
