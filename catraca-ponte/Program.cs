using CatracaPonte;

Console.Title = "Aqua Park - Ponte da Catraca";

Configuracao config;
try
{
    config = Configuracao.Carregar(Path.Combine(AppContext.BaseDirectory, "appsettings.json"));
}
catch (Exception ex) when (ex is IOException or InvalidDataException or System.Text.Json.JsonException)
{
    Log.Erro(ex.Message);
    Console.WriteLine("Pressione Enter para sair.");
    Console.ReadLine();
    return 1;
}

var simulador = args.Contains("--simular") || config.Modo.Equals("Simulador", StringComparison.OrdinalIgnoreCase);

using var parar = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    parar.Cancel();
};

using var api = new SistemaApi(config.Sistema);
using var isapi = config.LeitorFacial.Habilitado ? new HikvisionIsapi(config.LeitorFacial) : null;
Log.Info($"Ponte iniciada ({(simulador ? "simulador" : "catraca")}{(isapi is null ? "" : " + leitor facial")}) -> {config.Sistema.Url}");

// O leitor facial roda ao lado da catraca: reconhece, valida no sistema e
// pede a liberação para quem controla o giro (ou aciona o relé do leitor).
Task IniciarLeitorFacial(ILiberador liberador) =>
    isapi is null
        ? Task.CompletedTask
        : Task.Run(() => new LeitorFacial(config.LeitorFacial, api, isapi, liberador).ExecutarAsync(parar.Token));

if (simulador)
{
    var facialSimulado = IniciarLeitorFacial(new LiberadorSimulado());
    await Simulador.ExecutarAsync(config, api, parar.Token);
    parar.Cancel();
    await facialSimulado;
    return 0;
}

var catraca = new CatracaInner(config, api);
var facial = IniciarLeitorFacial(catraca);
try
{
    await catraca.ExecutarAsync(parar.Token);
    await facial;
    return 0;
}
catch (DllNotFoundException)
{
    Log.Erro("EasyInner.dll não encontrada. Copie a DLL do SDK da Topdata para a mesma pasta do CatracaPonte.exe.");
}
catch (BadImageFormatException)
{
    Log.Erro("EasyInner.dll incompatível: use a versão 32 bits da DLL.");
}
catch (EntryPointNotFoundException ex)
{
    Log.Erro($"A EasyInner.dll desta versão não tem uma função esperada: {ex.Message}");
}
catch (InvalidOperationException ex)
{
    Log.Erro(ex.Message);
}
parar.Cancel();
Console.WriteLine("Pressione Enter para sair.");
Console.ReadLine();
return 1;
