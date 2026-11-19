# TRIADE — Super Painel de Gerenciamento dos Tradings

Frontend React + TypeScript (Vite) para comando, risco ao vivo e linha do tempo de decisões dos três agentes independentes do TRIADE (**B3**, **NASDAQ** e **Cripto**).

## Como rodar atrás de um túnel SSH

O servidor do painel no VPS escuta exclusivamente em `127.0.0.1:8765` (nunca em `0.0.0.0`).

1. Abra o túnel SSH na máquina do operador (painel + VNCs opcionais):

```bash
ssh -L 8765:127.0.0.1:8765 -L 5971:127.0.0.1:5971 -L 5972:127.0.0.1:5972 user@<vps>
```

2. Configure as variáveis locais (nunca commitadas) em `.env.local`:

```env
VITE_TRIADE_API_BASE=http://127.0.0.1:8765
VITE_TRIADE_TOKEN=<seu_token_bearer_emitido_no_vps>
```

3. Instale dependências e inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Sem `VITE_TRIADE_API_BASE`, o painel inicia no modo de preview local com os cenários ilustrativos da especificação v1.0 (`B3` em modo REAL, `NASDAQ` com empty state honesto, `Cripto` travado em `sticky_halt` por drawdown máximo).

## Regras de segurança aplicadas

- **Live é vermelho (`#f85149`), Papel é azul (`#58a6ff`)**. Verde (`#3fb950`) é usado apenas para PnL positivo, ponte ok, unidade ativa e eventos `fill`/`trade`/`reconcile`.
- **Fail-closed**: sem conexão com a API ou sem papel `owner`, os controles de escrita ficam desabilitados.
- **Zero segredos na UI**: nenhum valor de `.env`, login, senha, token de API ou saldo bruto de corretora é exibido.
- **Confirmação reforçada**: `flatten`, `kill`, `kill-all`, `kill-clear`, `reset-halt` e `unit stop/start` exigem digitação do agente + palavra-chave + motivo de auditoria (e código OTP 2FA de 6 dígitos quando em modo REAL).
