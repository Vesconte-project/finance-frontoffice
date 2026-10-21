# Contratos consumidos pelo frontoffice

Fonte executável: `finance-backend/docs/api-contract.json` e `docs/openapi.json`.
Inventário método/caminho, ficheiro, autenticação e origem:
`finance-infra/docs/eng196/consumidores.csv`.

| Família | Backend | Origem / autenticação |
|---|---|---|
| Preços e empresa | `/v1/tickers/{ticker}/*`, `/v1/tickers/index` | SSR/BFF, sessão opcional + Access no servidor |
| Calendário | `/v1/calendar` | SSR, público, mesmos tetos nos três níveis |
| Rankings reduzidos | `/v1/screener/rankings` | SSR, top 10: posição/ticker/score |
| Ranking completo | `/v1/rankings` | BFF, sessão + `rankings.read` |
| Atlas semanal | `/v1/atlas`, `/v1/atlas/zones/{id}`, `/v1/atlas/companies/{ticker}` (`/weeks` e `/movement` só Pro) | SSR e BFF `/api/atlas*`, sessão opcional: sem sessão a projeção da regra 7 do backend; com sessão o mapa real da semana mais recente |
| Conta/research/artefactos/billing | `/v1/me`, `/v1/accounts/*`, `/v1/research/*`, `/v1/artifacts/*`, `/v1/billing/*` | `/api/platform/*` ou SSR, sessão obrigatória |
| Watchlist | `/v1/watchlist` | BFF, GET/POST/DELETE, owner da sessão |
| AI e feedback | `/v1/ai-research/*` | BFF, sessão; geração também `research.ai` |
| Analytics | `/v1/analytics/events` | BFF, só sessão; telemetria anónima fica no frontoffice |

As rotas antigas dão 404, incluindo cron/CSV/direcionais/synthetic legado.
As páginas de sinais apresentam indisponibilidade sem fallback; watchlist continua.
Nenhuma chamada de browser recebe Access, chave IP ou credencial de serviço.
