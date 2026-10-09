# ENG-185 / ENG-184 — local validation, 2026-10-09

Scope: updated main frontoffice `2b82624`, infra `60adf61`, Backend `a626fb8`.
Implementation branches: `codex/research-jwt-local` and `codex/dev-local`.
No Backend/worker source changes, API contract changes, production configuration,
server execution, timer changes, merge or deployment commands are involved.
Frozen infra `rehearsal/` files have no diff.

## Inventory

Research previously calls Next `/api/research/synthetic/*`; its route verifies Clerk,
then `lib/synthetic-research-proxy.ts` forwards BFF secret + viewer to Backend.
`lib/backend.ts` adds `BACKEND_SHARED_SECRET` and optional `CF_ACCESS_CLIENT_ID` /
`CF_ACCESS_CLIENT_SECRET`. URL uses `BACKEND_BASE_URL`, falling back to
`FINANCE_BACKEND_URL`. `RESEARCH_SYNTHETIC_ENABLED` and the Vercel production guard
control UI availability. Only the six synthetic research API operations migrate.

Other ticker/financial/readings, screener/signals/picks, network/relationships,
watchlist/calendar/alerts and AI-research history calls continue through server
helpers and the shared secret (plus optional CF Access). See the README inventory.
No service secret or forwarded viewer enters direct browser requests.

## Local commands and results

| Validation | Result |
| --- | --- |
| Node 22.23.1, `npm ci` | PASS, same lock installation method as CI |
| `npm run verify` | PASS, 38 test files; one pre-existing unused `takeLast` warning |
| `npm run build` | PASS, including final CI-equivalent run |
| `PLAYWRIGHT_SERVER_MODE=production PLAYWRIGHT_CAPTURE=1 npm run qa:frontend` | PASS; verify/build + 165 browser tests passed, 29 existing skips; 5.0 minutes browser suite |
| `npm run qa:browser -- e2e/synthetic-comparison.spec.ts` | 11/11 PASS with repository-owned fixtures |
| Infra Python 3.12.3 venv; `python -m pip install pydantic==2.13.4`; unittest discovery | 1036/1036 PASS |
| Infra same unittest suite with `PYTHONPATH=tests/hostile_site` | 1036/1036 PASS |
| Component catalogue / lot register / `bash -n` | PASS; 16 shell scripts parsed |
| Existing `tests/test-compose-missing-state-path.sh` | FAIL on this Docker: Compose accepted the missing bind directory; unrelated existing profile |
| New infra `test_dev_local.py` | 4/4 PASS after final profile changes |
| Docker 29.1.3, Compose 2.40.3; `local.py up` | PASS; bootstrap + both API healthchecks |
| Second start with existing database | PASS; SQL readiness skips bootstrap, completed jobs preserved |
| Disposable RSA API smoke | Both models completed; 12 events + 6 artifacts each; all second-owner details/events/artifacts return 404 |

Commands reproduced (frontend uses Node 22; Python venv lives in ignored
`finance-infra/.venv-ci`):

```bash
npm ci
npm run verify
npm run qa:browser -- e2e/synthetic-comparison.spec.ts
npm run qa:local
PLAYWRIGHT_SERVER_MODE=production PLAYWRIGHT_CAPTURE=1 npm run qa:frontend
npm run dev:local
# In finance-infra, using its CI Python 3.12 environment:
python -m pip install pydantic==2.13.4
python -m unittest discover -s tests
PYTHONPATH=tests/hostile_site python -m unittest discover -s tests
python -m unittest discover -s tests -p test_dev_local.py
python deploy/validate-component-catalog.py
python scripts/validate-lot-register.py
bash tests/test-compose-missing-state-path.sh
```

Final `dev:local` restart with isolated `.next-local` output passed bootstrap and
API healthchecks; home returned 200 and unauthenticated HTML research navigation
redirected to Clerk (307). Local frontend remains available on port 3000.

Infra CI selects Python `3.12` (not a patch pin), uses pip with pydantic 2.13.4;
that configuration was reproduced. Model/runtime images separately use Python
3.12.8 and uv 0.11.13 with each checkout's frozen lock. No Python repository code
was changed, so no Backend contract regeneration is required.

The first Docker build exposed concurrent exports of the shared image; the launcher
now builds it once, then starts services without rebuilding. The first host probe
showed no effective published port on an internal-only network; Backend now has
an additional ingress bridge, still bound to 127.0.0.1. Worker/DB stay internal by
default. A concurrent Next build/browser run exposed generated route file contention;
validation now runs them sequentially. Local Next output is isolated in `.next-local`,
excluded from lint and standalone typechecks alongside transient dev validators. Generated test builds and bundles live in
ignored repository directories, excluded from lint, rather than depending on /tmp.

## Clerk browser acceptance

The workspace Development-only CLI wrapper successfully identified the existing
Development instance. Local `.env.local` was created privately using its existing
`sk_test_` credential, verified Frontend API, SDK publishable-key encoder and its
RSA signing public key converted to PEM. The Backend pins that PEM; it does not
fetch JWKS at runtime. Production keys were never read or used.

Authenticated `npm run qa:local` is the completion proof: it owns localhost:3000,
uses the actual `dev:local` entry point, official Clerk testing helpers and two
synthetic Development accounts, then checks comparison, events, artifacts and
owner isolation. **PASS: one browser test in 4.4 minutes.** Both baseline and forest
reached `completed`; each exposed 12 events and 6 artifact records in the UI/API.
The second real Clerk session saw neither run and received 404 for every detail,
event, artifact list and artifact record URL. There were 397 direct research
requests and zero BFF requests. Test-created Development users were removed by
teardown. Its compact report is gitignored. The disposable RSA smoke above is separate API
proof and does not claim Clerk browser authentication.

## Operator work and limits

Frontend defaults remain BFF. Preserve all old BFF/CF secrets. Operator rollout:
review/integrate paired PRs, validate local JWT, change Cloudflare policy for direct
browser requests while protecting origin, configure Backend dev JWT issuer/PEM/
exact Preview origins, set Preview public mode/base URL, verify a new Preview,
then remove both BFF implementations/proxy/temporary switches and obsolete secrets.
ENG-185 must not close before this cleanup. Production synthetic research remains
blocked. Server dev's manual execution and paused production schedules are untouched.

This profile seeds synthetic research data, not a complete fixture for every other
product endpoint. Homepage screener and analytics calls can honestly fail locally;
they are not replaced by fake data. Reload/stopping may interrupt active models;
there is no general crash recovery guarantee. Artifact API operations expose
metadata, matching the existing product contract, not file downloads.
