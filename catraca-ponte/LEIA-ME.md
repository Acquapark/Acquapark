# Ponte da Catraca (Topdata Fit ↔ Aqua Park Manager)

Programa que roda no PC da catraca e liga a Topdata Fit ao sistema:

1. a catraca lê o QR Code do ingresso ou da credencial;
2. a ponte pergunta ao sistema (`POST /api/catraca/validar`) se pode entrar;
3. se o sistema autorizar, a ponte libera o giro; se não, mostra "ACESSO NEGADO" no visor.

A catraca passa a funcionar em **modo online** (quem decide é o sistema, não o
cadastro do programa da Topdata). Os dois programas usam a mesma porta, então
**feche o programa da Topdata** antes de abrir a ponte.

## O que precisa

- **O sistema publicado na internet** (ex: Vercel), com a variável
  `CATRACA_API_KEY` configurada no servidor.
- O script `supabase/codigo_numerico_catraca.sql` já rodado no Supabase
  (códigos de QR só com números, que é o que a catraca lê).
- A **`EasyInner.dll` (32 bits)**, que vem no SDK EasyInner da Topdata
  (site/suporte da Topdata). A DLL não fica neste repositório.

## Instalação no PC da catraca

1. Descompacte `CatracaPonte-win-x86.zip` numa pasta, ex: `C:\CatracaPonte`.
2. Copie a `EasyInner.dll` para essa mesma pasta.
3. Abra o `appsettings.json` no Bloco de Notas e preencha:
   - `Sistema.Url`: endereço do sistema, ex: `https://aquapark.vercel.app`;
   - `Sistema.ChaveApi`: o mesmo valor da `CATRACA_API_KEY` do servidor;
   - `Catraca.NumeroInner` e `Catraca.Porta`: os mesmos que o programa da Topdata usa hoje.
4. **Teste sem a catraca primeiro:** abra um Prompt de Comando na pasta e rode
   `CatracaPonte.exe --simular`. Digite o código de um ingresso válido (o número
   embaixo do QR Code). Tem que aparecer `LIBERADO`. Se aparecer
   `falha ao falar com o sistema`, o problema é o endereço, a chave ou a internet.
5. Feche o programa da Topdata e dê dois cliques em `CatracaPonte.exe`.
   Deve aparecer `Inner 1 conectado` e o visor mostra "APROXIME O QR".
6. Para abrir sozinho ao ligar o PC: `Win+R` → `shell:startup` → crie ali um
   atalho para o `CatracaPonte.exe`.

Tudo o que acontece fica registrado em `logs\ponte-AAAA-MM-DD.log`, ao lado do `.exe`.

## Se a catraca não reagir à leitura

A ponte foi escrita a partir das funções documentadas do SDK EasyInner, mas
**não foi testada no equipamento**. Os ajustes, se precisar, são no
`appsettings.json`, seção `Avancado` (sem recompilar), conferindo no manual do
SDK que vem com a DLL:

| Sintoma | O que conferir |
| --- | --- |
| Fica em "Aguardando o Inner" | Porta/`TipoConexao`, número do Inner, IP do servidor configurado no Inner, programa da Topdata ainda aberto |
| Conecta mas não lê o QR | `TipoLeitor`, `OperacaoLeitor1`, `PadraoCartao` |
| Lê, mas o código chega diferente do sistema | `DigitosCodigo` e o log (mostra o código recebido) |
| Libera mas não gira / gira para o lado errado | `SentidoLiberacao`, `FuncaoAcionamento1` |
| Só lê o primeiro QR | `FormaEntrada` |

Se uma função não existir na sua versão da DLL, a ponte avisa o nome dela
ao abrir — as declarações ficam todas em `EasyInner.cs`.

## Gerar o .exe de novo (desenvolvedor)

Com o .NET 8 SDK instalado, nesta pasta:

```
dotnet publish -c Release -r win-x86 --self-contained -p:PublishSingleFile=true -o publicado
```
