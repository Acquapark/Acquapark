using System.Text.Json;

namespace CatracaPonte;

/// <summary>
/// Liga o leitor facial Hikvision ao sistema:
/// 1. Sincroniza: de tempos em tempos busca no sistema os associados com foto
///    e mantém o aparelho igual (cadastra, troca a foto, remove quem saiu). O
///    leitor reconhece rostos sozinho, mas só os que estão cadastrados nele.
/// 2. Na entrada: ouve os eventos de reconhecimento, pergunta ao sistema se o
///    associado pode entrar (mesma regra do QR Code) e libera a catraca — ou
///    o relé do leitor — só se o sistema autorizar.
/// </summary>
public sealed class LeitorFacial
{
    private readonly LeitorFacialConfig _config;
    private readonly SistemaApi _api;
    private readonly HikvisionIsapi _isapi;
    private readonly ILiberador _liberador;
    private readonly string _arquivoEstado = Path.Combine(AppContext.BaseDirectory, "leitor-facial-sincronizados.json");
    private readonly Dictionary<string, long> _ultimoEvento = new();

    public LeitorFacial(LeitorFacialConfig config, SistemaApi api, HikvisionIsapi isapi, ILiberador liberador)
    {
        _config = config;
        _api = api;
        _isapi = isapi;
        _liberador = liberador;
    }

    public async Task ExecutarAsync(CancellationToken parar)
    {
        Log.Info($"Leitor facial: {_config.Ip}:{_config.Porta} (liberação pela {(_config.Liberacao == "ReleLeitor" ? "relé do leitor" : "catraca")}).");
        try
        {
            await AguardarLoginAsync(parar);
            await Task.WhenAll(SincronizarSempreAsync(parar), OuvirSempreAsync(parar));
        }
        catch (OperationCanceledException) when (parar.IsCancellationRequested)
        {
        }
    }

    /// <summary>Senha recusada: espera bem mais antes de tentar de novo — várias tentativas erradas bloqueiam o leitor por ~30 min.</summary>
    private static readonly TimeSpan EsperaSenhaRecusada = TimeSpan.FromMinutes(2);

    private const string AvisoSenha =
        "Confira LeitorFacial.Usuario (normalmente \"admin\") e LeitorFacial.Senha no appsettings.json - a mesma senha que entra na página do leitor no navegador. " +
        "Muitas tentativas erradas bloqueiam o leitor por cerca de 30 minutos.";

    /// <summary>Confere usuário/senha uma vez antes de começar, com mensagem clara no log.</summary>
    private async Task AguardarLoginAsync(CancellationToken parar)
    {
        while (true)
        {
            try
            {
                var info = await _isapi.InformacoesAsync(parar);
                if (info.Http == 401)
                {
                    Log.Erro($"Leitor facial: usuário ou senha recusados (HTTP 401). {AvisoSenha} Nova tentativa em 2 minutos.");
                    await Task.Delay(EsperaSenhaRecusada, parar);
                    continue;
                }
                var modelo = System.Text.RegularExpressions.Regex.Match(info.Corpo, "<model>([^<]*)</model>").Groups[1].Value;
                var firmware = System.Text.RegularExpressions.Regex.Match(info.Corpo, "<firmwareVersion>([^<]*)</firmwareVersion>").Groups[1].Value;
                Log.Info(info.Ok
                    ? $"Leitor facial: login OK ({(modelo.Length > 0 ? modelo : "modelo não informado")}{(firmware.Length > 0 ? $", firmware {firmware}" : "")})."
                    : $"Leitor facial: respondeu HTTP {info.Http} às informações do aparelho; seguindo mesmo assim.");
                return;
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException) && !parar.IsCancellationRequested)
            {
                Log.Erro($"Leitor facial: não respondeu em {_config.Ip}:{_config.Porta} ({ex.Message}). Confira o IP, o cabo e se o PC alcança o leitor. Nova tentativa em 15 s.");
                await Task.Delay(15000, parar);
            }
        }
    }

    // ---------------------------------------------------------------------
    // Sincronização (sistema -> leitor)
    // ---------------------------------------------------------------------

    private async Task SincronizarSempreAsync(CancellationToken parar)
    {
        while (!parar.IsCancellationRequested)
        {
            try
            {
                await SincronizarAsync(parar);
            }
            catch (Exception ex) when (!parar.IsCancellationRequested)
            {
                // Rede, leitor desligado ou resposta inesperada: nunca derruba a ponte.
                Log.Erro($"Leitor facial: falha na sincronização ({ex.GetType().Name}: {ex.Message}). Tento de novo no próximo ciclo.");
            }
            await Task.Delay(TimeSpan.FromMinutes(Math.Max(1, _config.IntervaloSincronizacaoMin)), parar);
        }
    }

    private async Task SincronizarAsync(CancellationToken parar)
    {
        var rostos = await _api.ListarRostosAsync(parar);
        if (rostos is null)
            return; // sistema fora do ar: mantém o aparelho como está

        var estado = CarregarEstado();
        var noSistema = rostos.Select(r => r.Numero).ToHashSet();
        int enviados = 0, removidos = 0, falhas = 0;

        foreach (var rosto in rostos)
        {
            if (estado.TryGetValue(rosto.Numero, out var versao) && versao == rosto.Versao)
                continue;

            var pessoa = await _isapi.SalvarPessoaAsync(rosto.Numero, rosto.Nome, parar);
            if (pessoa.Http == 401)
            {
                Log.Erro($"Leitor facial: usuário ou senha recusados (HTTP 401) na sincronização. {AvisoSenha}");
                return; // não insiste pessoa por pessoa: cada tentativa errada conta para o bloqueio
            }
            if (!pessoa.Ok)
            {
                falhas++;
                Log.Erro($"Leitor facial: não cadastrou {rosto.Numero} ({Resumo(pessoa)}).");
                continue;
            }

            var foto = await _api.BaixarFotoAsync(rosto.FotoUrl, parar);
            if (foto is null)
            {
                falhas++;
                continue;
            }

            var face = await _isapi.SalvarRostoAsync(rosto.Numero, foto, parar);
            if (!face.Ok)
            {
                falhas++;
                // Ex: foto sem rosto detectável, rosto pequeno/de lado, arquivo grande demais.
                Log.Erro($"Leitor facial: recusou a foto de {rosto.Numero} - {rosto.Nome} ({Resumo(face)}). Troque a foto no perfil do associado.");
                continue;
            }

            estado[rosto.Numero] = rosto.Versao;
            enviados++;
            SalvarEstado(estado);
        }

        foreach (var numero in estado.Keys.Where(n => !noSistema.Contains(n)).ToList())
        {
            var remover = await _isapi.RemoverPessoaAsync(numero, parar);
            if (remover.Ok || remover.SubStatus.Contains("NotExist", StringComparison.OrdinalIgnoreCase))
            {
                estado.Remove(numero);
                removidos++;
                SalvarEstado(estado);
            }
            else
            {
                falhas++;
                Log.Erro($"Leitor facial: não removeu {numero} ({Resumo(remover)}).");
            }
        }

        Log.Info($"Leitor facial sincronizado: {enviados} enviado(s), {removidos} removido(s), {falhas} falha(s). Total no aparelho: {estado.Count}.");
    }

    private Dictionary<string, string> CarregarEstado()
    {
        try
        {
            return File.Exists(_arquivoEstado)
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(_arquivoEstado)) ?? new()
                : new();
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            // Arquivo corrompido: começa do zero (reenvia todo mundo).
            return new();
        }
    }

    private void SalvarEstado(Dictionary<string, string> estado)
    {
        try
        {
            File.WriteAllText(_arquivoEstado, JsonSerializer.Serialize(estado));
        }
        catch (IOException ex)
        {
            Log.Erro($"Não foi possível gravar {_arquivoEstado} ({ex.Message}).");
        }
    }

    // ---------------------------------------------------------------------
    // Eventos (leitor -> sistema -> catraca)
    // ---------------------------------------------------------------------

    private async Task OuvirSempreAsync(CancellationToken parar)
    {
        while (!parar.IsCancellationRequested)
        {
            try
            {
                Log.Info("Leitor facial: ouvindo os reconhecimentos.");
                await _isapi.OuvirEventosAsync(TratarEventoAsync, parar);
                Log.Erro("Leitor facial: conexão de eventos encerrada. Reconectando...");
            }
            catch (UnauthorizedAccessException) when (!parar.IsCancellationRequested)
            {
                Log.Erro($"Leitor facial: usuário ou senha recusados (HTTP 401) ao ouvir os reconhecimentos. {AvisoSenha} Nova tentativa em 2 minutos.");
                await Task.Delay(EsperaSenhaRecusada, parar);
                continue;
            }
            catch (Exception ex) when (!parar.IsCancellationRequested)
            {
                Log.Erro($"Leitor facial sem conexão ({ex.GetType().Name}: {ex.Message}). Tentando de novo em 5 s...");
            }
            await Task.Delay(5000, parar);
        }
    }

    private async Task TratarEventoAsync(JsonElement evento)
    {
        if (!evento.TryGetProperty("AccessControllerEvent", out var ac))
            return;

        var major = Numero(ac, "majorEventType");
        var sub = Numero(ac, "subEventType");
        var numero = Texto(ac, "employeeNoString") ?? Texto(ac, "employeeNo");
        if (string.IsNullOrWhiteSpace(numero))
            return; // rosto desconhecido, porta, alarme etc.

        if (major != 5 || !_config.SubEventosReconhecido.Contains(sub))
        {
            Log.Info($"Leitor facial: evento ignorado de {numero} (major {major}, sub {sub}).");
            return;
        }

        // O leitor manda o mesmo reconhecimento várias vezes enquanto a pessoa está na frente.
        var agora = Environment.TickCount64;
        if (_ultimoEvento.TryGetValue(numero, out var anterior) && agora - anterior < _config.IgnorarRepeticaoMs)
            return;
        _ultimoEvento[numero] = agora;

        var resultado = await _api.ValidarAssociadoAsync(numero);

        if (_config.Liberacao == "ReleLeitor")
        {
            if (!resultado.Autorizado)
            {
                Log.Info($"NEGADO    rosto {numero} ({(resultado.FalhaConexao ? "falha ao falar com o sistema" : resultado.Motivo ?? resultado.Mensagem)})");
                return;
            }
            var abrir = await _isapi.AbrirPortaAsync(_config.NumeroPorta, CancellationToken.None);
            Log.Info(abrir.Ok
                ? $"LIBERADO  rosto {numero} ({resultado.Nome}) pelo relé do leitor"
                : $"LIBERADO  rosto {numero}, mas o leitor não acionou o relé ({Resumo(abrir)})");
            return;
        }

        _liberador.Pedir($"rosto {numero}", resultado);
    }

    private static int Numero(JsonElement objeto, string nome) =>
        objeto.TryGetProperty(nome, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : -1;

    private static string? Texto(JsonElement objeto, string nome)
    {
        if (!objeto.TryGetProperty(nome, out var v))
            return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static string Resumo(RespostaIsapi r)
    {
        var corpo = r.Corpo.Replace('\n', ' ').Replace('\r', ' ');
        return $"HTTP {r.Http}, {(r.SubStatus.Length > 0 ? r.SubStatus : "sem detalhe")}: {(corpo.Length > 200 ? corpo[..200] : corpo)}";
    }
}
