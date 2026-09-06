# Agent Development Setup

## Prerequisites

- Git and a configured Git identity.
- Node.js matching `.nvmrc` for reproducible local work; `package.json` records the supported minimum.
- npm and project dependencies installed with `npm ci`.

Run:

```bash
npm ci
npx playwright install chromium
./scripts/check-agent-environment.sh
npm run verify
npm run qa:browser
```

Copy variable names from `.env.example` into `.env.local` and obtain values through the team's approved secret channel. Never commit `.env.local`, tokens, cookies, browser storage, or credentials.

## Stored in Git

`AGENTS.md`, documentation, API contracts and request records, briefs and decisions, feature status files, scripts, test configuration, and non-secret fixtures belong in Git.

## Local only

Codex authentication, CLI preferences, bubblewrap/sandbox policy, actual environment values, Node installation, Playwright browser binaries, MCP configuration and indexes, tokens, Clerk/Stripe/backend credentials, GitHub permissions, and optional tool caches remain local.

Browser binaries are intentionally not installed by `npm ci`. Install only the required project with `npx playwright install chromium`; CI may need OS dependencies via `npx playwright install --with-deps chromium`.

Playwright owns the QA server lifecycle. Do not start `npm run dev` separately for browser QA; use `PLAYWRIGHT_BASE_URL` only when an existing external server is an intentional test target.

Use `docs/features/_template/status.md` when work must continue on another computer. Confirm Git state, environment check, and the feature's last validation before editing.
## Agent runtimes

No agent runtime is configured from this repository. Model choice, reasoning effort,
subagent creation, and sandbox policy belong to whichever CLI or client a contributor
runs, and are configured there.

`docs/agents/roles.md` still describes *when* a specialist is worth creating and who may
edit what. That is product and review judgement, and it applies whatever runtime executes
it — it is not a runtime configuration.

The repository previously shipped a Codex CLI project layer (`.codex/` generated from
`docs/agents/codex/`, with `agents:sync`, `agents:check` and `test:agents` guarding the
mirror). It was removed on 2026-09-06: current agent runtimes create and scope their own
subagents, so pinning models and declaring a fixed roster in-repo constrained the runtime
without adding anything.
