using System.Runtime.InteropServices;
using System.Text;

namespace CatracaPonte;

/// <summary>
/// Declarações das funções da EasyInner.dll (SDK da Topdata) usadas pela
/// ponte — só as necessárias para o modo online. Os nomes e parâmetros
/// seguem o EasyInner.cs dos exemplos em C# da Topdata; se a sua versão da
/// DLL tiver alguma assinatura diferente, ajuste aqui (é o único lugar que
/// fala com a DLL).
/// </summary>
internal static class EasyInner
{
    private const string Dll = "EasyInner.dll";

    public const int RetComandoOk = 0;

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int DefinirTipoConexao(byte tipo);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int AbrirPortaComunicacao(int porta);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void FecharPortaComunicacao();

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int Ping(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int PingOnLine(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int DefinirPadraoCartao(byte padrao);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarInnerOnLine();

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarAcionamento1(byte funcao, byte tempo);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarAcionamento2(byte funcao, byte tempo);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarTipoLeitor(byte tipo);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarLeitor1(byte operacao);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void ConfigurarLeitor2(byte operacao);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void DefinirQuantidadeDigitosCartao(byte quantidade);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern void HabilitarTeclado(byte habilitar, byte ecoar);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int EnviarConfiguracoes(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int EnviarMensagemPadraoOnLine(int inner, int exibirData, string mensagem);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int EnviarFormasEntradasOnLine(
        int inner, byte qtdeDigitosTeclado, byte ecoDisplay, byte formaEntrada, byte tempoTeclado, byte posicaoCursorTeclado);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int ReceberDadosOnLine(
        int inner, ref byte origem, ref byte complemento, StringBuilder cartao,
        ref byte dia, ref byte mes, ref byte ano, ref byte hora, ref byte minuto, ref byte segundo);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int LiberarCatracaEntrada(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int LiberarCatracaEntradaInvertida(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int LiberarCatracaSaida(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int LiberarCatracaSaidaInvertida(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int LiberarCatracaDoisSentidos(int inner);

    [DllImport(Dll, CallingConvention = CallingConvention.StdCall)]
    public static extern int AcionarBipLongo(int inner);
}
