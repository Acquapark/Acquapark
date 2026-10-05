using System.Text;
using System.Threading.Channels;

namespace CatracaPonte;

/// <summary>
/// Conversa com o Inner da catraca Topdata em modo online: cada QR Code lido
/// chega aqui, é validado no sistema, e a ponte manda liberar o giro ou
/// mostrar "acesso negado". Em modo online o Inner não decide nada sozinho.
/// Também recebe pedidos de fora (o leitor facial) por uma fila, atendidos no
/// mesmo laço — a EasyInner não pode ser chamada de duas threads ao mesmo tempo.
/// </summary>
public sealed class CatracaInner : ILiberador
{
    private readonly Configuracao _config;
    private readonly SistemaApi _api;
    private readonly int _inner;
    private readonly Channel<(string Quem, Validacao Resultado, long Quando)> _pedidos =
        Channel.CreateUnbounded<(string, Validacao, long)>(new UnboundedChannelOptions { SingleReader = true });

    /// <summary>Pedido mais velho que isso é descartado (ex: o Inner estava desconectado) — a pessoa já saiu da frente da catraca.</summary>
    private const int ValidadePedidoMs = 8000;

    public void Pedir(string quem, Validacao resultado) => _pedidos.Writer.TryWrite((quem, resultado, Environment.TickCount64));

    public CatracaInner(Configuracao config, SistemaApi api)
    {
        _config = config;
        _api = api;
        _inner = config.Catraca.NumeroInner;
    }

    public async Task ExecutarAsync(CancellationToken parar)
    {
        var c = _config.Catraca;
        Verificar(EasyInner.DefinirTipoConexao(c.TipoConexao), "DefinirTipoConexao");
        var retPorta = EasyInner.AbrirPortaComunicacao(c.Porta);
        if (retPorta != EasyInner.RetComandoOk)
            throw new InvalidOperationException(
                $"Não foi possível abrir a porta {c.Porta} (retorno {retPorta}). Ela pode estar em uso pelo programa da Topdata — feche-o antes.");
        Log.Info($"Porta {c.Porta} aberta. Sentido de liberação: {c.SentidoLiberacao}. Aguardando o Inner {_inner}...");

        try
        {
            while (!parar.IsCancellationRequested)
            {
                await AguardarConexaoAsync(parar);
                if (!await ConfigurarAsync(parar))
                {
                    Log.Erro($"O Inner {_inner} não aceitou a configuração. Tentando de novo em 5 s...");
                    await Task.Delay(5000, parar);
                    continue;
                }
                await AtenderAsync(parar);
                Log.Erro($"Conexão com o Inner {_inner} perdida. Tentando reconectar...");
            }
        }
        catch (OperationCanceledException) when (parar.IsCancellationRequested)
        {
        }
        finally
        {
            EasyInner.FecharPortaComunicacao();
            Log.Info("Porta de comunicação fechada.");
        }
    }

    private async Task AguardarConexaoAsync(CancellationToken parar)
    {
        while (EasyInner.Ping(_inner) != EasyInner.RetComandoOk)
            await Task.Delay(1000, parar);
        Log.Info($"Inner {_inner} conectado.");
    }

    private async Task<bool> ConfigurarAsync(CancellationToken parar)
    {
        var a = _config.Avancado;
        if (a.EnviarConfiguracao)
        {
            EasyInner.DefinirPadraoCartao(a.PadraoCartao);
            EasyInner.ConfigurarInnerOnLine();
            EasyInner.ConfigurarAcionamento1(a.FuncaoAcionamento1, a.TempoAcionamento1);
            EasyInner.ConfigurarAcionamento2(a.FuncaoAcionamento2, a.TempoAcionamento2);
            EasyInner.ConfigurarTipoLeitor(a.TipoLeitor);
            EasyInner.ConfigurarLeitor1(a.OperacaoLeitor1);
            EasyInner.ConfigurarLeitor2(a.OperacaoLeitor2);
            EasyInner.DefinirQuantidadeDigitosCartao((byte)_config.Catraca.DigitosCodigo);
            EasyInner.HabilitarTeclado(0, 0);
            if (!await RepetirAsync(() => EasyInner.EnviarConfiguracoes(_inner), "EnviarConfiguracoes", parar))
                return false;
            Log.Info("Configuração de modo online enviada ao Inner.");
        }
        await RearmarAsync(parar);
        return true;
    }

    /// <summary>
    /// Os comandos da EasyInner podem falhar na primeira tentativa (o Inner
    /// ainda ocupado com o comando anterior, pacote TCP perdido) — os exemplos
    /// da Topdata repetem por alguns segundos antes de desistir; aqui também.
    /// </summary>
    private static async Task<bool> RepetirAsync(Func<byte> comando, string nome, CancellationToken parar, int timeoutMs = 3000)
    {
        var inicio = Environment.TickCount64;
        byte ret;
        while ((ret = comando()) != EasyInner.RetComandoOk)
        {
            if (Environment.TickCount64 - inicio >= timeoutMs)
            {
                Log.Erro($"{nome} falhou (retorno {ret}).");
                return false;
            }
            await Task.Delay(100, parar);
        }
        return true;
    }

    /// <summary>
    /// Volta o visor à mensagem padrão e reabilita a leitura — em modo online o
    /// Inner para de aceitar leituras depois de cada evento até ser rearmado.
    /// </summary>
    private async Task RearmarAsync(CancellationToken parar)
    {
        var a = _config.Avancado;
        await RepetirAsync(() => EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, _config.Mensagens.Padrao), "EnviarMensagemPadraoOnLine", parar);
        await RepetirAsync(
            () => EasyInner.EnviarFormasEntradasOnLine(_inner, 0, 0, a.FormaEntrada, a.TempoTeclado, a.PosicaoCursorTeclado),
            "EnviarFormasEntradasOnLine", parar);
    }

    private async Task AtenderAsync(CancellationToken parar)
    {
        var ultimoPing = Environment.TickCount64;
        byte origem = 0, complemento = 0, dia = 0, mes = 0, ano = 0, hora = 0, minuto = 0, segundo = 0;
        var cartao = new StringBuilder(64);

        while (!parar.IsCancellationRequested)
        {
            // Pedidos do leitor facial (já validados no sistema pela ponte).
            if (_pedidos.Reader.TryRead(out var pedido))
            {
                if (Environment.TickCount64 - pedido.Quando > ValidadePedidoMs)
                {
                    Log.Info($"Ignorado   {pedido.Quem}: pedido antigo (a catraca estava ocupada ou desconectada).");
                    continue;
                }
                await TratarResultadoAsync(pedido.Quem, pedido.Resultado, parar);
                await RearmarAsync(parar);
                ultimoPing = Environment.TickCount64;
                continue;
            }

            cartao.Clear();
            var ret = EasyInner.ReceberDadosOnLine(
                _inner, ref origem, ref complemento, cartao, ref dia, ref mes, ref ano, ref hora, ref minuto, ref segundo);

            if (ret == EasyInner.RetComandoOk)
            {
                var lido = cartao.ToString().Trim();
                if (lido.Length > 0)
                    await TratarLeituraAsync(lido, parar);
                else
                    // Evento sem código: giro concluído ou tempo de liberação esgotado.
                    Log.Info($"Evento do Inner (origem {origem}, complemento {complemento}).");
                await RearmarAsync(parar);
                ultimoPing = Environment.TickCount64;
                continue;
            }

            if (Environment.TickCount64 - ultimoPing >= _config.Catraca.IntervaloPingMs)
            {
                if (EasyInner.PingOnLine(_inner) != EasyInner.RetComandoOk)
                    return;
                ultimoPing = Environment.TickCount64;
            }
            await Task.Delay(50, parar);
        }
    }

    private async Task TratarLeituraAsync(string lido, CancellationToken parar)
    {
        var codigo = Codigo.Normalizar(lido, _config.Catraca.DigitosCodigo);
        var resultado = await _api.ValidarAsync(codigo);
        await TratarResultadoAsync(codigo, resultado, parar);
    }

    private async Task TratarResultadoAsync(string codigo, Validacao resultado, CancellationToken parar)
    {
        if (resultado.Autorizado)
        {
            Log.Info($"LIBERADO  {codigo}{(resultado.Nome is null ? "" : $" ({resultado.Nome})")}");
            EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, _config.Mensagens.Liberado);
            await LiberarAsync(parar);
            return;
        }

        Log.Info($"NEGADO    {codigo}{(resultado.FalhaConexao ? " (falha ao falar com o sistema)" : resultado.Motivo is null ? "" : $" ({resultado.Motivo})")}");
        var mensagem = resultado.FalhaConexao ? _config.Mensagens.SemConexao : _config.Mensagens.Negado;
        EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, mensagem);
        EasyInner.AcionarBipLongo(_inner);
        await Task.Delay(_config.Catraca.TempoMensagemNegadoMs, parar);
    }

    private async Task LiberarAsync(CancellationToken parar)
    {
        Func<byte> liberar = _config.Catraca.SentidoLiberacao switch
        {
            "EntradaInvertida" => () => EasyInner.LiberarCatracaEntradaInvertida(_inner),
            "Saida" => () => EasyInner.LiberarCatracaSaida(_inner),
            "SaidaInvertida" => () => EasyInner.LiberarCatracaSaidaInvertida(_inner),
            "DoisSentidos" => () => EasyInner.LiberarCatracaDoisSentidos(_inner),
            _ => () => EasyInner.LiberarCatracaEntrada(_inner),
        };
        if (!await RepetirAsync(liberar, "LiberarCatraca", parar))
        {
            Log.Erro("O Inner não aceitou o comando de liberar o giro.");
            return;
        }
        Bipar();
    }

    /// <summary>
    /// O Inner só apita sozinho com alguns comandos de liberar (com
    /// "DoisSentidos", por exemplo, fica mudo) — o bipe explícito deixa o
    /// retorno igual em qualquer sentido.
    /// </summary>
    private void Bipar()
    {
        try
        {
            EasyInner.AcionarBipCurto(_inner);
        }
        catch (EntryPointNotFoundException)
        {
            // DLL sem essa função: libera do mesmo jeito, só sem o bipe.
        }
    }

    private static void Verificar(int retorno, string funcao)
    {
        if (retorno != EasyInner.RetComandoOk)
            throw new InvalidOperationException($"{funcao} falhou (retorno {retorno}).");
    }
}
