using System.Text;

namespace CatracaPonte;

/// <summary>
/// Conversa com o Inner da catraca Topdata em modo online: cada QR Code lido
/// chega aqui, é validado no sistema, e a ponte manda liberar o giro ou
/// mostrar "acesso negado". Em modo online o Inner não decide nada sozinho.
/// </summary>
public sealed class CatracaInner
{
    private readonly Configuracao _config;
    private readonly SistemaApi _api;
    private readonly int _inner;

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
        Verificar(EasyInner.AbrirPortaComunicacao(c.Porta), $"AbrirPortaComunicacao({c.Porta})");
        Log.Info($"Porta {c.Porta} aberta. Aguardando o Inner {_inner}...");

        try
        {
            while (!parar.IsCancellationRequested)
            {
                await AguardarConexaoAsync(parar);
                Configurar();
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

    private void Configurar()
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
            Verificar(EasyInner.EnviarConfiguracoes(_inner), "EnviarConfiguracoes");
            Log.Info("Configuração de modo online enviada ao Inner.");
        }
        Rearmar();
    }

    /// <summary>
    /// Volta o visor à mensagem padrão e reabilita a leitura — em modo online o
    /// Inner para de aceitar leituras depois de cada evento até ser rearmado.
    /// </summary>
    private void Rearmar()
    {
        var a = _config.Avancado;
        EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, _config.Mensagens.Padrao);
        EasyInner.EnviarFormasEntradasOnLine(_inner, 0, 0, a.FormaEntrada, a.TempoTeclado, a.PosicaoCursorTeclado);
    }

    private async Task AtenderAsync(CancellationToken parar)
    {
        var ultimoPing = Environment.TickCount64;
        byte origem = 0, complemento = 0, dia = 0, mes = 0, ano = 0, hora = 0, minuto = 0, segundo = 0;
        var cartao = new StringBuilder(64);

        while (!parar.IsCancellationRequested)
        {
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
                Rearmar();
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

        if (resultado.Autorizado)
        {
            Log.Info($"LIBERADO  {codigo}");
            EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, _config.Mensagens.Liberado);
            Liberar();
            return;
        }

        Log.Info($"NEGADO    {codigo}{(resultado.FalhaConexao ? " (falha ao falar com o sistema)" : "")}");
        var mensagem = resultado.FalhaConexao ? _config.Mensagens.SemConexao : _config.Mensagens.Negado;
        EasyInner.EnviarMensagemPadraoOnLine(_inner, 0, mensagem);
        EasyInner.AcionarBipLongo(_inner);
        await Task.Delay(_config.Catraca.TempoMensagemNegadoMs, parar);
    }

    private void Liberar()
    {
        var ret = _config.Catraca.SentidoLiberacao switch
        {
            "EntradaInvertida" => EasyInner.LiberarCatracaEntradaInvertida(_inner),
            "Saida" => EasyInner.LiberarCatracaSaida(_inner),
            "SaidaInvertida" => EasyInner.LiberarCatracaSaidaInvertida(_inner),
            "DoisSentidos" => EasyInner.LiberarCatracaDoisSentidos(_inner),
            _ => EasyInner.LiberarCatracaEntrada(_inner),
        };
        if (ret != EasyInner.RetComandoOk)
            Log.Erro($"O Inner não aceitou o comando de liberar (retorno {ret}).");
    }

    private static void Verificar(int retorno, string funcao)
    {
        if (retorno != EasyInner.RetComandoOk)
            throw new InvalidOperationException($"{funcao} falhou (retorno {retorno}).");
    }
}
