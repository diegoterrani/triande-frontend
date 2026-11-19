# TRIADE — Super Painel de Gerenciamento dos Tradings

Frontend React + TypeScript (Vite) do painel de monitoramento dos agentes **B3**, **NASDAQ** e **Cripto**. Os dados vêm só de `GET /api/v2` no servidor do dashboard. Não há modo de preview com números inventados.

A B3 está em **LIVE** numa conta real. O monitoramento (`GET /api/v2`) continua somente leitura: kill, flatten, start/stop e edição fora de Administração seguem desabilitados, porque essas rotas respondem `405`. A escrita existe só em **Administração** (`/api/v2/admin`), com sessão, CSRF e um código TOTP novo em cada ação.

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

`VITE_API_BASE` vazio significa mesma origem (`/api/v2`), que é o caso do build servido em `/app`. `VITE_TRIADE_API_BASE` ainda é lido se `VITE_API_BASE` não estiver definido. `VITE_TRIADE_TOKEN` é opcional e não é exigido (`auth_required: false`).

3. Suba o dev server:

```bash
npm install
npm run dev
```

O Vite escuta em `http://127.0.0.1:3000`. Com o túnel caído, as telas mostram estado offline e não preenchem números.

Atualização ao vivo: `EventSource` em `/api/v2/stream` (`hello`, `journal`, `status`, `ping`), com reconexão. Depois de duas falhas o cliente faz polling a cada 5s.

Para exercitar a UI sem o VPS, há um stub local montado com os exemplos do contrato (banner amarelo **STUB LOCAL**). O stub também responde `/api/v2/admin`. Para o cookie de sessão funcionar no navegador, deixe a API na mesma origem pelo proxy do Vite:

```bash
npm run stub
VITE_DEV_PROXY=http://127.0.0.1:8766 VITE_API_BASE= VITE_BASE=/ npm run dev
```

`VITE_API_BASE=http://127.0.0.1:8766` ainda serve para olhar o monitoramento, mas o cookie `SameSite=Strict` da administração fica mais confiável na mesma origem. No stub, qualquer código de 6 dígitos ainda não usado entra. Uma API key que contém `WITHDRAW` faz o teste de permissão falhar com saque habilitado. Isso não existe na VPS.

## Administração

O botão **Administração** abre o modal. O basic auth do nginx (usuário `diego`) continua sendo o que o navegador pede ao abrir o painel; a interface não lê essa senha. No modal, o operador entra com usuário, senha e TOTP de 6 dígitos da aplicação.

- O cookie `triade_admin_session` é HttpOnly. O JavaScript não lê. O `csrf_token` fica só na memória do separador, nunca em `localStorage`.
- Cada `POST`/`PUT` manda `X-CSRF-Token` e `X-TOTP`, com `credentials: 'include'`. O código do login já foi consumido: espere a próxima janela de 30 segundos.
- Binance: a tela mostra só se há chave e os 4 últimos, já mascarados. Chave e segredo são campos `password`, saem do estado depois do envio e não são gravados no navegador.
- O teste de conexão mostra as permissões. Saque habilitado é erro bloqueante. A orientação é criar a chave só com trade e restrição de IP para `169.58.230.95`.
- Limites: o cliente recusa o que está fora dos `bounds` do `GET`. O servidor continua sendo a fonte da verdade.
- Ligar o live exige a frase `ENABLE CRYPTO LIVE`, um TOTP novo e a lista (credenciais, teste ok, limites gravados). Isso grava o flag e **não** inicia a unit do agente. Desligar exige `DISABLE CRYPTO LIVE`.
- Kill e flatten da cripto, e kill da B3, pedem confirmação e TOTP. Os três gravam arquivo `KILL`. O flatten não envia ordem à corretora.
- A auditoria administrativa é a tabela paginada do modal (`GET /api/v2/admin/audit`), com valores já redigidos.
- `401 unauthenticated` volta ao login. `403 totp` pede outro código. `412` mostra `missing` ou o resultado do teste. O texto de `error` do servidor aparece como veio.

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

Recarregue `http://127.0.0.1:8765/app` pelo túnel. Com a base `/app/`, os assets resolvem em `/app/assets/…`. Não é preciso token.

## O que a UI não inventa

Onde o backend não tem dado, a tela fica vazia ou diz que o recurso não existe. Em particular: NASDAQ sem `state` e sem barras; B3 live com zero trades no instante da captura; sem curva intra-diária de equity; sem ACK de alerta persistido ou toggle de Telegram; sem resample de timeframe; pong da porta 18863 pode expirar com a ponte em escuta (isso não é ponte caída). A trilha `GET /api/v2/audit` continua sendo a do monitoramento. A auditoria de sessão, chave, limites, live e KILL fica no modal Administração. Dinheiro ausente aparece como “—”, não como zero.
