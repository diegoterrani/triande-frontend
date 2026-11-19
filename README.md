# TRIADE — Super Painel de Gerenciamento dos Tradings

Frontend React + TypeScript (Vite) do painel de monitoramento dos agentes **B3**, **NASDAQ** e **Cripto**. Os dados vêm só de `GET /api/v2` no servidor do dashboard. Não há modo de preview com números inventados.

A B3 está em **LIVE** numa conta real. O painel é somente leitura: kill, flatten, start/stop e edição de config ficam desabilitados porque o backend responde `405` e ainda não há autenticação.

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

Para exercitar a UI sem o VPS, há um stub local montado com os exemplos do contrato (banner amarelo **STUB LOCAL**):

```bash
npm run stub
VITE_API_BASE=http://127.0.0.1:8766 VITE_BASE=/ npm run dev
```

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

Onde o backend não tem dado, a tela fica vazia ou diz que o recurso não existe. Em particular: NASDAQ sem `state` e sem barras; B3 live com zero trades no instante da captura; sem curva intra-diária de equity; sem usuários, tokens, auditoria, ACK de alerta ou toggle de Telegram; sem resample de timeframe; pong da porta 18863 pode expirar com a ponte em escuta (isso não é ponte caída). Dinheiro ausente aparece como “—”, não como zero.
