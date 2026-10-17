This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Development

This repository uses npm and the committed `package-lock.json`. Use the Node version in `.nvmrc` for the reproducible local setup; `package.json` records the supported minimum.

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Canonical validation

```bash
npm run verify       # lint, typecheck, and unit/contract tests
npm run qa:browser   # Playwright owns the test server and Chromium lifecycle
npm run qa:frontend  # verify, production build, and browser QA
```

Install the browser once with `npx playwright install chromium`. In CI, install its system dependencies with `npx playwright install --with-deps chromium`. Browser QA uses `http://127.0.0.1:3100` internally and does not reuse an unknown process; set `PLAYWRIGHT_BASE_URL` only to test an intentionally managed external server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Ativação Vercel

A produção permanece desligada até concluir o manifesto
`finance-infra/docs/eng196/ATIVACAO.md`. Não usar promoção automática durante o corte.
Só Francisco faz merges e promove os deployments Production verificados.
`.env.example` contém apenas nomes; Clerk produção é `https://clerk.vesconte.com`.
Nenhum cron de alertas fica instalado. Consultar o manifesto para chaves novas,
controlo de aliases, verificação, rollback e remoção final das variáveis antigas.

## Backend Data Contract

The frontoffice boundary is explicit: the frontend presents and organizes data;
`finance-backend` is the only product-data source; Clerk owns authentication and
identity; Stripe owns billing and plans. Supabase may still exist behind the
separately operated backend/data-ops workflows, but this site has no Supabase
client, credentials, direct queries, or source fallback at runtime.

The site fetches screener, ticker summary, watchlist, alerts, AI research, and
analytics data through `finance-backend`.

See `DATA_SOURCE_POLICY.md` before changing ticker autocomplete, stock-page data loading, or backend proxy routes. Ticker autocomplete is index-only: it loads `/api/tickers/index` and filters locally. The old Yahoo-backed `/api/search` autocomplete and its enrichment path were removed and must not be reintroduced.

### Required runtime env vars

- `BACKEND_BASE_URL`
- `CF_ACCESS_CLIENT_ID` (required when `finance-backend` is behind Cloudflare Access)
- `CF_ACCESS_CLIENT_SECRET` (required when `finance-backend` is behind Cloudflare Access)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Supabase credentials belong in server-side repos (`finance-backend`, `finance-data-ops`), not in this site runtime.

### Ticker page summary semantics

Ticker pages render the canonical backend summary payload. Scorecard visibility is
determined by scorecard materialization (`hasScorecard`, materialization
readiness, and a usable overall score), not by page-component diagnostics. A
`buildReadiness: "partial"` scorecard is still a valid materialized scorecard and
must remain visible with its available axes. `componentMissingInputs` may be used
for page caveats only; it must never hide a scorecard.

Overview stat mappings are intentionally canonical: market cap is
`profile.marketCap ?? fundamentalsSummary.marketCap ?? quote.marketCapText`,
volume is `marketStats.volume`, and P/E uses only
`fundamentalsSummary.trailingPe` then `profile.trailingPe`. Do not reintroduce
fuzzy latest-fundamental row matching for P/E. The site renders the supplied
snapshot only and must not fetch or substitute later source data.

## Watchlist Tables (Dashboard)

Watchlist persistence is now served through `finance-backend` `/site/*` endpoints. The underlying tables still live in Supabase, but this site does not access them directly.

## Sinais direcionais, CSV e alertas retirados

O cron, reserva/entrega, CSV e contratos direcionais foram apagados, incluindo o
script antigo de upload de sinais. Não instalar tokens nem preparar o cron.
O regresso depende da ENG-230. Watchlist e páginas de preços/fundamentais mantêm-se;
`/stocks/[ticker]/signals` e `/markets` explicam a indisponibilidade. O painel
cross-sectional só mostra score/rank publicados em produção, sem inventar direção.
As tabelas históricas ficam na base de dados.

## AI Analyst Integration (Perplexity)

The existing AI route remains available for supported product surfaces. The
ticker page does not render a disabled or simulated copilot while the contextual
experience is being revisited.

### Setup

1. Add env vars:
   - `PERPLEXITY_API_KEY` (required)
   - `PERPLEXITY_MODEL` (optional, defaults to `sonar-pro`)
2. Open the supported AI surface and use its analysis action.

The app sends ticker + latest signal + recent headlines to `POST /api/ai-analyst`, which proxies Perplexity streaming output back to the client.

If `PERPLEXITY_API_KEY` is not set, the AI Analyst UI is hidden automatically.

## Usage Telemetry and Analytics Events

Page, feature, and button usage is logged as structured JSON to **Vercel Runtime
Logs**, where each field is filterable and drainable. Full reference, including
how to add an event and how to query the logs, is in
[`docs/observability/usage-telemetry.md`](docs/observability/usage-telemetry.md).

The short version:

- Every button, link, tab, and form submit is captured automatically by a
  delegated listener installed in `instrumentation-client.ts`. New controls need
  no per-component work.
- Page views and web vitals come from `components/analytics/AnalyticsProvider.tsx`,
  mounted once in the root layout.
- Events batch in the browser and post to `/api/analytics/event`, which writes one
  JSON line per event and then forwards to `finance-backend` best-effort.
- Filter the Vercel logs on `vesconte.telemetry` for usage, `vesconte.server` for
  server events, then narrow by `event`, `category`, `route`, or any `p_*` payload
  field.
- Set `NEXT_PUBLIC_ANALYTICS_DEBUG=1`, or append `?analytics_debug=1` to a URL, to
  mirror every event to the browser console.

### Persistência no backend

Só eventos com sessão autenticada são enviados a `/v1/analytics/events`, com owner
da sessão verificada. Visitantes anónimos continuam apenas na telemetria própria
do frontoffice; os seus eventos deixam de existir no backend. Não há owner
inventado nem caminho anónimo de persistência. Não aplicar SQL Supabase antigo.

## Native account API migration (local validation)

The account API uses Clerk only for identity. FastAPI resolves the personal or
active Clerk organization account and authorizes features using its PostgreSQL
projection of Stripe Billing and Entitlements. A Checkout success redirect does
not grant access. Clerk plan metadata is not an authority in this mode.

The migration is opt-in. `NEXT_PUBLIC_PLATFORM_API_ENABLED=true` selects the native
client; unset or `false` keeps the existing path while environments are validated.
`NEXT_PUBLIC_PLATFORM_API_BASE_URL` is the Backend origin, without `/v1`.
Unknown mode values and API errors never fall back to legacy authentication.
The browser sends a fresh default Clerk session JWT, omits cookies, and retries
401 once with a refreshed token. Internal secrets remain server-side.

From this checkout, with sibling repositories and private Development/test inputs
prepared according to [the stack README](../finance-infra/platform-local/README.md):

```sh
npm run dev:platform
npm run dev:platform:status
npm run dev:platform:down
npm run dev:platform:reset -- --confirm-project=finance-platform-local
npm run qa:platform
```

`dev:platform` starts the new isolated PostgreSQL, RabbitMQ, private S3-compatible
storage, Backend and continuous workers, then Next.js at `http://localhost:3000`.
The synthetic comparison page provides account selection, server-created Checkout
and Portal sessions, basic history, cancellation, execution evidence and authorized
downloads. Free users cannot create comparisons or download premium content.
The existing `dev:local` command remains available during this migration.

`.env.local` stays ignored and private. Example names and fake values:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_fake
CLERK_SECRET_KEY=sk_test_fake
NEXT_PUBLIC_PLATFORM_API_ENABLED=true
```

`FINANCE_REPOS_DIR` can select the sibling checkout directory;
`FINANCE_PLATFORM_INPUTS` can select the private stack input file. The launcher
checks that the frontend and Backend use the same Clerk Development instance.
Only the publishable key and public API settings reach browser code.

A validação é local. A ativação de produção segue exclusivamente o manifesto infra;
este código não altera Cloudflare, Vercel nem o servidor. Rankings pagos são
autorizados no backend e nunca entram em cache partilhada. CSV foi retirado.

Local proof on 2026-10-10: the hosted Stripe TEST Checkout, signed webhook and
verified commercial projection authorized a real Clerk Development session.
The synthetic comparison completed both models; the browser verified 20 events,
two private artifacts and their SHA-256 hashes, and denied a second account access
to the job and artifacts. The run's subscription was canceled using the guarded
test cleanup tool. Traces and videos are disabled to avoid storing session state
or signed URLs. This proof does not validate production configuration, all stock
routes, or the backoffice UI.

New native jobs require two complete execution ZIPs in addition to the two model
summaries. Each ZIP contains every authorized row of predictions, strategy state,
daily backtest results, positions and symbol summaries as NDJSON, with a SHA-256
manifest. Configurations, credentials, machine paths and internal metadata are
excluded. All uploaded bytes count against the job and account storage policy;
missing exports prevent completion and a definitive failure returns the quota.
The new Backend export contract and matching worker must be reviewed together.

## Legacy Stripe Pro Plan Activation

The app now supports Stripe-driven Pro gating for screener full results and CSV export.

### Setup

1. Add env vars:
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` (Stripe Payment Link URL for your Pro plan)
   - `STRIPE_WEBHOOK_SECRET` (endpoint secret from Stripe webhook config)
   - `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (optional, defaults to `300`)
2. In Stripe, configure a webhook endpoint:
   - `POST /api/webhooks/stripe`
   - Event: `checkout.session.completed`
3. Ensure checkout includes Clerk user ID:
   - Preferred: append `?client_reference_id=<clerk_user_id>` to the payment link.
   - Fallback: include `clerk_user_id` in checkout metadata.

On successful `checkout.session.completed`, the webhook sets Clerk metadata:

- `publicMetadata.plan = 'pro'`
- `privateMetadata.stripeCustomerId`
- `privateMetadata.stripeSubscriptionId`
- `privateMetadata.stripeLastCheckoutSessionId`
- `privateMetadata.stripeLastCheckoutAt`

### Local test workflow (without deploying)

Use this when you want to test Stripe end-to-end on `localhost` before pushing to Vercel.

1. Install and authenticate Stripe CLI (one-time setup):
   ```bash
   curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
   echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
   sudo apt update
   sudo apt install stripe
   stripe login
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. In a second terminal, start webhook forwarding:
   ```bash
   stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhooks/stripe
   ```
4. Copy the `whsec_...` shown by `stripe listen` and set it in local env:
   - `STRIPE_WEBHOOK_SECRET=<whsec_from_stripe_listen>`
5. Ensure your local payment link env exists:
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...` (test-mode link)
6. Restart `npm run dev` after env changes.
7. While signed in, click Upgrade from the app and complete checkout using a Stripe test card:
   - `4242 4242 4242 4242` + any future date/CVC.
8. Verify webhook success in the `stripe listen` terminal:
   - `checkout.session.completed` forwarded with HTTP `200`.
9. Refresh the app (or sign out/sign in once) and confirm:
   - Screener lock removed for Pro user.
   - CSV export unlocked.

Important notes:

- The webhook secret from `stripe listen` is local-only and different from your Dashboard endpoint secret.
- Keep modes aligned: test payment link + test events + test account data.
- If checkout doesn’t return to your app automatically, configure Payment Link "After payment -> Redirect to URL" to your local route (for example `http://localhost:3000/screener`).

## Product Backlog

- Wire daily model batch jobs to continuously populate `market_signals` for your target universe (for example S&P 100).
- Extend the AI analyst panel with follow-up Q&A and memory per ticker.
- Add social/news momentum inputs (for example X/Reddit trend context) into AI analysis.
- Add ads/sponsored placements in the ticker News section (clear labeling, frequency caps, non-intrusive placement).


## Autenticação nativa e transporte

Browser → BFF Next.js → backend `/v1`. A sessão Clerk segue em JWT; as credenciais
Cloudflare Access e a prova IP ficam só no servidor. A organização ativa, owner,
suspensão e direitos são verificados pelo backend. Não existem shared secret,
modo BFF alternativo, PEM fixada ou base de API pública no browser.

Ver [docs/api/authentication.md](docs/api/authentication.md). Os contratos do mapa
exigem sessão até à ENG-228; o frontoffice apresenta login a visitantes anónimos.

## Complete local development (ENG-184)

Follow [the infra local profile README](../finance-infra/dev-local/README.md).
With Docker, Python 3.12, Node 22, sibling checkouts and `.env.local` configured:

```bash
npm ci
npm run dev:local
npm run dev:local:status
npm run dev:local:down
npm run dev:local:reset -- --confirm-project=finance-local
```

The startup command waits for PostgreSQL, synthetic bootstrap, Backend and worker
before serving http://localhost:3000. Use `/dashboard/research/synthetic`. `FINANCE_REPOS_DIR`
selects the sibling root; `FINANCE_BACKEND_PORT` defaults to 18095;
`FINANCE_POSTGRES_PORT` optionally publishes the DB on loopback. The launcher overrides
Backend and research endpoints for local work and removes Cloudflare headers from
its child environment. `.env.local` needs only these Clerk settings (fake examples):

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_FAKE_EXAMPLE
CLERK_SECRET_KEY=sk_test_FAKE_EXAMPLE
CLERK_JWT_ISSUER=https://example-development.clerk.accounts.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Internal passwords and service tokens are generated locally. Do not copy production
settings. Other product routes may have no data in this synthetic research profile;
errors/empty states must remain honest. Local execution runs two models per comparison.

### Inventário e prova local

O inventário completo, por método/caminho, ficheiro, autenticação e origem está em
`finance-infra/docs/eng196/consumidores.csv`; o contrato executável do backend está
em `finance-backend/docs/api-contract.json`. `npm run qa:local` usa o perfil local,
Clerk Development e dados sintéticos. Não se usa produção nem se guardam sessões
em traces/videos. Consultar o manifesto infra para resultados e SHAs exatos.

## Recursos pessoais autenticados

Watchlist, runs/feedback AI e analytics autenticados usam exclusivamente `/v1`,
com session JWT e a conta ativa resolvida por `/v1/me`. O owner nunca é enviado.
As rotas antigas não são fallback. Com a plataforma desligada, a watchlist e o
histórico mostram indisponibilidade; a estrela não assume uma watchlist vazia se
a leitura falhar. Não há geração AI antes de uma admissão aceite pelo backend.
O direito `research.ai` e a política de consumo existente não são alterados:
sem política configurada, o backend recusa gerar mesmo com subscrição.

A telemetria anónima continua nos logs próprios do frontoffice e não é enviada
ao backend. Com sessão, o encaminhamento autenticado é best effort; uma falha não
apaga o registo local nem atribui um owner anónimo. O middleware estabelece contexto
opcional quando há uma credencial para verificar; o ingresso anónimo mantém-se
independente do Clerk, mesmo com a integração configurada. Runs AI novos usam UUID; feedback exige um run concreto.

Este corte não ativa /v1, aplica migrações ou configura tokens. Em produção com
/v1 desligado deixam de funcionar guardar/remover watchlist, histórico/feedback e
geração AI. O cron dedicado permanece inalterado e parado até à ativação aprovada.
