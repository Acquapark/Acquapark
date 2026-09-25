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
Log.Info($"Ponte iniciada ({(simulador ? "simulador" : "catraca")}) -> {config.Sistema.Url}");

if (simulador)
{
    await Simulador.ExecutarAsync(config, api, parar.Token);
    return 0;
}

try
{
    await new CatracaInner(config, api).ExecutarAsync(parar.Token);
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
    Log.Erro(ex.Message + " A porta pode estar em uso pelo programa da Topdata — feche-o antes.");
}
Console.WriteLine("Pressione Enter para sair.");
Console.ReadLine();
return 1;
