using System.Text.Json;

namespace CatracaPonte;

public sealed class Configuracao
{
    public string Modo { get; set; } = "Catraca";
    public SistemaConfig Sistema { get; set; } = new();
    public CatracaConfig Catraca { get; set; } = new();
    public MensagensConfig Mensagens { get; set; } = new();
    public AvancadoConfig Avancado { get; set; } = new();
    public LeitorFacialConfig LeitorFacial { get; set; } = new();

    public static readonly string[] LiberacoesFaciaisValidas = ["Catraca", "ReleLeitor"];

    public static readonly string[] SentidosValidos =
        ["Entrada", "EntradaInvertida", "Saida", "SaidaInvertida", "DoisSentidos"];

    public static Configuracao Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            throw new FileNotFoundException($"Arquivo de configuração não encontrado: {caminho}");

        var opcoes = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
        };
        var config = JsonSerializer.Deserialize<Configuracao>(File.ReadAllText(caminho), opcoes)
            ?? throw new InvalidDataException("appsettings.json vazio.");

        config.Sistema.Url = config.Sistema.Url.TrimEnd('/');
        config.Catraca.SentidoLiberacao = config.Catraca.SentidoLiberacao.Trim();
        if (!SentidosValidos.Contains(config.Catraca.SentidoLiberacao))
            throw new InvalidDataException(
                $"Catraca.SentidoLiberacao inválido: \"{config.Catraca.SentidoLiberacao}\". Use um destes: {string.Join(", ", SentidosValidos)}.");
        if (config.Sistema.Url.Contains("SEU_DOMINIO") || config.Sistema.ChaveApi.StartsWith("COLE_AQUI"))
            throw new InvalidDataException("Preencha Sistema.Url e Sistema.ChaveApi no appsettings.json.");

        var facial = config.LeitorFacial;
        if (facial.Habilitado)
        {
            facial.Liberacao = facial.Liberacao.Trim();
            if (!LiberacoesFaciaisValidas.Contains(facial.Liberacao))
                throw new InvalidDataException(
                    $"LeitorFacial.Liberacao inválido: \"{facial.Liberacao}\". Use um destes: {string.Join(", ", LiberacoesFaciaisValidas)}.");
            if (string.IsNullOrWhiteSpace(facial.Ip) || string.IsNullOrWhiteSpace(facial.Senha) || facial.Senha.Contains("_AQUI_"))
                throw new InvalidDataException("Preencha LeitorFacial.Ip e LeitorFacial.Senha no appsettings.json (ou desligue com \"Habilitado\": false).");
        }

        return config;
    }
}

public sealed class SistemaConfig
{
    public string Url { get; set; } = "";
    public string ChaveApi { get; set; } = "";
    public int TimeoutMs { get; set; } = 8000;
}

public sealed class CatracaConfig
{
    public int NumeroInner { get; set; } = 1;
    public byte TipoConexao { get; set; } = 2;
    public int Porta { get; set; } = 3570;
    public string SentidoLiberacao { get; set; } = "Entrada";
    public int DigitosCodigo { get; set; } = 14;
    public int TempoMensagemNegadoMs { get; set; } = 2500;
    public int IntervaloPingMs { get; set; } = 5000;
}

public sealed class MensagensConfig
{
    public string Padrao { get; set; } = "  AQUA PARK     APROXIME O QR  ";
    public string Liberado { get; set; } = "   BEM VINDO!";
    public string Negado { get; set; } = " ACESSO NEGADO";
    public string SemConexao { get; set; } = "  SEM CONEXAO   CHAME ATENDENTE";
}

/// <summary>Leitor facial Hikvision (ex: DS-K1T673DX), falando ISAPI pela rede local.</summary>
public sealed class LeitorFacialConfig
{
    public bool Habilitado { get; set; }
    public string Ip { get; set; } = "";
    public int Porta { get; set; } = 80;
    public bool UsarHttps { get; set; }
    public string Usuario { get; set; } = "admin";
    public string Senha { get; set; } = "";
    /// <summary>"Catraca": a ponte libera o giro pela EasyInner. "ReleLeitor": a ponte manda o leitor acionar o próprio relé.</summary>
    public string Liberacao { get; set; } = "Catraca";
    /// <summary>Número da porta (relé) do leitor, usado com Liberacao = "ReleLeitor".</summary>
    public int NumeroPorta { get; set; } = 1;
    public int IntervaloSincronizacaoMin { get; set; } = 10;
    /// <summary>O leitor manda vários eventos seguidos para o mesmo rosto: ignora repetições dentro deste tempo.</summary>
    public int IgnorarRepeticaoMs { get; set; } = 6000;
    /// <summary>Subtipos de evento (majorEventType 5) que contam como "rosto reconhecido". 75 = autenticação facial aprovada.</summary>
    public int[] SubEventosReconhecido { get; set; } = [75];
    public int TimeoutMs { get; set; } = 10000;
}

public sealed class AvancadoConfig
{
    public bool EnviarConfiguracao { get; set; } = true;
    public byte PadraoCartao { get; set; } = 1;
    public byte TipoLeitor { get; set; } = 0;
    public byte FuncaoAcionamento1 { get; set; } = 1;
    public byte TempoAcionamento1 { get; set; } = 5;
    public byte FuncaoAcionamento2 { get; set; } = 0;
    public byte TempoAcionamento2 { get; set; } = 0;
    public byte OperacaoLeitor1 { get; set; } = 1;
    public byte OperacaoLeitor2 { get; set; } = 0;
    public byte FormaEntrada { get; set; } = 11;
    public byte TempoTeclado { get; set; } = 10;
    public byte PosicaoCursorTeclado { get; set; } = 17;
}
