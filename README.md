# TRIADE — Super Painel de Gerenciamento dos Tradings

Frontend React + TypeScript (Vite) do painel de monitoramento dos agentes **B3**, **NASDAQ** e **Cripto**. Os dados vêm só de `GET /api/v2` no servidor do dashboard. Não há modo de preview com números inventados.

A B3 está em **LIVE** numa conta real. O painel inteiro exige a sessão da aplicação (`GET /api/v2/auth/session`). Sem cookie, a tela é o login. O monitoramento (`GET /api/v2`) continua somente leitura: kill, flatten, start/stop e edição fora de Administração seguem desabilitados, porque essas rotas respondem `405`. A escrita existe só em **Administração** (`/api/v2/admin`), com a mesma sessão, CSRF e um código TOTP novo em cada ação crítica.

## Desenvolvimento contra o túnel SSH

O servidor escuta em `127.0.0.1:8765` no VPS (não em `0.0.0.0`). CORS aceita `http://localhost:<porta>` e `http://127.0.0.1:<porta>`.

1. Encaminhe a porta (e os VNCs, se quiser abrir a tela do terminal):

```bash
ssh -L 8765:127.0.0.1:8765 -L 5971:127.0.0.1:5971 -L 5972:127.0.0.1:5972 user@<vps>
```

2. Crie `.env.local` (não commitado):

```env
VITE_API_BASE=http://127.0.0.1:8765
VITE_BASE=/
```

Os pedidos são sempre URL relativa (`/api/v2/...`) com `credentials: 'same-origin'`. O cookie `triade_session` é `SameSite=Strict` e não segue para outra origem, então `VITE_API_BASE` é ignorado. Para desenvolver contra o túnel, deixe a API na mesma origem pelo proxy do Vite (abaixo). `VITE_TRIADE_API_BASE` ainda é lido só para avisar que foi ignorado.

3. Suba o dev server:

```bash
npm install
npm run dev
```

O Vite escuta em `http://127.0.0.1:3000`. Com o túnel caído, as telas mostram estado offline e não preenchem números.

Atualização ao vivo: `EventSource` em `/api/v2/stream?agent=all` só depois do login (`hello`, `journal`, `status`, `ping`, `auth`). O evento `auth` fecha o stream e volta ao login. Um erro de rede consulta `/api/v2/auth/session`: se a resposta for 401, não há nova tentativa em loop. Depois de duas falhas com sessão ainda válida o cliente faz polling a cada 5s.

Para exercitar a UI sem o VPS, há um stub local montado com os exemplos do contrato (banner amarelo **STUB LOCAL**). O stub também responde `/api/v2/admin`. Para o cookie de sessão funcionar no navegador, deixe a API na mesma origem pelo proxy do Vite:

```bash
npm run stub
VITE_DEV_PROXY=http://127.0.0.1:8766 VITE_API_BASE= VITE_BASE=/ npm run dev
```

No stub a senha é `stub-local-only`. Qualquer código de 6 dígitos ainda não usado entra, e uma senha errada não gasta o código. Uma API key que contém `WITHDRAW` faz o teste de permissão falhar com saque habilitado. Isso não existe na VPS. Sem o cookie, o stub responde `401 unauthenticated` em tudo que não é health, login ou consulta de sessão.

## Login

Ao abrir, o painel chama `GET /api/v2/auth/session`. `200` guarda `{user, csrf_token, expires_at, stepup_required_for}` só na memória e mostra o dashboard. `401` mostra a tela **Entrar** (usuário preenchido `diego`, senha, código 2FA). Não há polling nem SSE antes disso.

- O cookie `triade_session` é HttpOnly (`SameSite=Strict`, `Path=/`, 7 dias, expiração fixa). O JavaScript não lê o cookie e não grava senha, código ou token em `localStorage` / `sessionStorage`.
- `POST /api/v2/auth/login` manda `{username, password, totp}`. Falha de credencial mostra «usuário, senha ou código 2FA inválidos» e limpa o código. Depois de 3 falhas seguidas a tela avisa que 5 falhas em 10 minutos bloqueiam o IP por 1 hora.
- O cabeçalho mostra o usuário, a expiração da sessão e **Sair**. O logout é `POST /api/v2/auth/logout` com `X-CSRF-Token` e corpo `{}`, sem TOTP.
- Qualquer `401` com `code: unauthenticated` volta ao login uma vez só, para o SSE e o polling, e não empilha toast.

## Administração

O botão **Administração** abre o modal já dentro da sessão. Não há segundo login nem `Authorization: Bearer`.

- Cada `POST`/`PUT` autenticado manda `X-CSRF-Token`. Um `403 csrf` busca de novo `GET /api/v2/auth/session` e tenta a mesma ação uma vez.
- A lista `stepup_required_for` decide quando a ação pede um **Código 2FA** novo, enviado em `X-TOTP`. `403 totp` pede outro código. O código do login já foi consumido: espere a próxima janela de 30 segundos.
- Binance: a tela mostra só se há chave e os 4 últimos, já mascarados. Chave e segredo são campos `password`, saem do estado depois do envio e não são gravados no navegador.
- O teste de conexão mostra as permissões. Saque habilitado é erro bloqueante. A orientação é criar a chave só com trade e restrição de IP para `169.58.230.95`.
- Limites: o cliente recusa o que está fora dos `bounds` do `GET`. O servidor continua sendo a fonte da verdade.
- Ligar o live exige a frase `ENABLE CRYPTO LIVE`, um TOTP novo e a lista (credenciais, teste ok, limites gravados). Isso grava o flag e **não** inicia a unit do agente. Desligar exige `DISABLE CRYPTO LIVE`.
- Kill e flatten da cripto, e kill da B3, pedem confirmação e TOTP. Os três gravam arquivo `KILL`. O flatten não envia ordem à corretora.
- A auditoria administrativa é a tabela paginada do modal (`GET /api/v2/admin/audit`), com valores já redigidos.
- `412` mostra `missing` ou o resultado do teste. O texto de `error` do servidor aparece como veio.

## Build e publicação no VPS

O dashboard entrega o SPA em `http://127.0.0.1:8765/app` a partir de `/opt/triade/frontend/app`.

```bash
npm install
npm run lint
npm test
VITE_BASE=/app/ npm run build
```

`npm run build` já usa `VITE_BASE=/app/` quando a variável não é passada. Copie o conteúdo de `dist/` para o VPS:

```bash
rsync -a --delete dist/ user@<vps>:/opt/triade/frontend/app/
```

Recarregue `http://127.0.0.1:8765/app` pelo túnel. Com a base `/app/`, os assets resolvem em `/app/assets/…`. A sessão entra pelo login da aplicação, não por token.

## O que a UI não inventa

Onde o backend não tem dado, a tela fica vazia ou diz que o recurso não existe. Em particular: NASDAQ sem `state` e sem barras; B3 live com zero trades no instante da captura; sem curva intra-diária de equity; sem ACK de alerta persistido ou toggle de Telegram; sem resample de timeframe; pong da porta 18863 pode expirar com a ponte em escuta (isso não é ponte caída). A trilha `GET /api/v2/audit` continua sendo a do monitoramento. A auditoria de sessão, chave, limites, live e KILL fica no modal Administração. Dinheiro ausente aparece como “—”, não como zero.
