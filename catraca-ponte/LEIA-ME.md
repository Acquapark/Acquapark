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

## Leitor facial Hikvision (DS-K1T673DX)

A mesma ponte também cuida do leitor facial. O leitor reconhece os rostos
**sozinho**, mas só de quem está cadastrado nele — por isso a ponte:

1. **sincroniza**: a cada `IntervaloSincronizacaoMin` minutos busca no sistema
   (`GET /api/catraca/faces`) os associados com foto (menos os inativos) e
   cadastra, atualiza ou remove no leitor. O cadastro no leitor usa o **número
   do associado**;
2. **na entrada**: quando o leitor reconhece alguém, a ponte pergunta ao sistema
   (`POST /api/catraca/validar` com o número do associado) e só libera se o
   sistema autorizar — mesma regra do QR Code, com registro no Controle de Acesso.

### Preparar o leitor

1. Ative o leitor e defina a senha de administrador (no próprio aparelho ou
   pelo programa **SADP** da Hikvision).
2. Dê a ele um **IP fixo** na mesma rede do PC da ponte. Teste abrindo
   `http://IP_DO_LEITOR` no navegador do PC: tem que aparecer a tela de login.
3. Confira se o **ISAPI** está habilitado (Configuração → Rede → Serviço de
   Rede / Integração → ISAPI), se o seu firmware tiver essa opção.
4. Modo de autenticação: **rosto** (ou "cartão ou rosto").
5. Se for usar `"Liberacao": "Catraca"` (leitor só na rede), não precisa ligar o
   relé do leitor em nada.
6. Se o relé do leitor estiver ligado na catraca (`"Liberacao": "ReleLeitor"`),
   o leitor **não pode abrir sozinho** ao reconhecer, senão quem estiver
   inadimplente ou bloqueado entraria. Deixe o relé dele desligado da
   autenticação local (consulte o manual/suporte Hikvision do seu firmware) —
   quem aciona é a ponte, depois que o sistema autoriza.

### Configurar a ponte

No `appsettings.json`, seção `LeitorFacial`: `"Habilitado": true`, `Ip`,
`Usuario`, `Senha` e `Liberacao`. Reinicie a ponte. No log deve aparecer
`Leitor facial: ouvindo os reconhecimentos` e, alguns segundos depois,
`Leitor facial sincronizado: N enviado(s)...`.

A ponte guarda o que já enviou em `leitor-facial-sincronizados.json`. Para
reenviar todo mundo (ex: o leitor foi resetado), apague esse arquivo e
reinicie a ponte.

### Se o leitor facial não funcionar

Assim como a parte da catraca, **não foi testado no aparelho**: foi escrito a
partir da documentação ISAPI da Hikvision. O log mostra a resposta completa
do leitor em cada erro.

| Sintoma | O que conferir |
| --- | --- |
| `Usuário ou senha do leitor facial incorretos` | `Usuario`/`Senha`; alguns firmwares bloqueiam o usuário após tentativas erradas |
| `Leitor facial sem conexão` | IP, porta, cabo/rede, o PC alcança o IP do leitor |
| `não cadastrou` / `recusou a foto` | O motivo vem no log. Foto recusada: rosto de frente, bem iluminado, sem óculos escuros — troque no perfil do associado |
| Reconhece mas nada acontece | O log mostra `evento ignorado ... (major X, sub Y)`: coloque o `Y` em `SubEventosReconhecido` |
| Reconhece, autoriza, mas não gira | `Liberacao`; com `"Catraca"`, o `SentidoLiberacao` da seção `Catraca` |

Teste sem catraca: `CatracaPonte.exe --simular` com o leitor habilitado — a
sincronização e os reconhecimentos acontecem de verdade, e a liberação só
aparece no log.

## Gerar o .exe de novo (desenvolvedor)

Com o .NET 8 SDK instalado, nesta pasta:

```
dotnet publish -c Release -r win-x86 --self-contained -p:PublishSingleFile=true -o publicado
```
