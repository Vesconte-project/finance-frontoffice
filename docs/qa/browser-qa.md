# Browser QA

## Setup

```bash
npm ci
npx playwright install chromium
npm run qa:browser
```

`qa:browser` first checks that the project Chromium executable exists, then delegates the full run to Playwright. `playwright.config.ts` starts the deterministic backend fixture, then the application server on the fixed internal URL `http://localhost:3100`, waits for readiness, pipes server logs, applies a startup timeout, and shuts both down. Locally it runs `npm run dev` with the isolated `.next-playwright` output directory; when `PLAYWRIGHT_SERVER_MODE=production` is set it runs `npm run start` against the build already in `.next`. The isolated output avoids contention with a normal `.next/dev/lock`; Playwright does not silently reuse a process on the QA port. `PLAYWRIGHT_BASE_URL` is the explicit opt-in for an intentionally managed external server.

Do not start or stop a server manually, select another port, invoke Chromium directly, or repair browser locks during a QA run. The committed smoke test is deliberately content-light and checks homepage load, console/page errors, horizontal overflow, and deliberate screenshot capture across representative viewports.

`.github/workflows/frontend-qa.yml` uses the shared `scripts/ci-scope.mjs`
classifier with the non-visual CI workflow. Browser/runtime changes still run
verify, a production build and the full browser candidate set. Metadata-only
`app/robots.ts` / `app/sitemap.ts` changes run verify and a production build,
without UI/browser assertions. Adding any UI path restores full browser QA.
Package dependencies, runtime scripts and QA harness/workflow changes always
select the full candidate. Only a package.json `scripts.test` edit can stay on
the non-visual path. Mixed changes never use the narrowest file's scope.

CI calls the same canonical `npm run verify`, `npm run build` and
`npm run qa:browser` commands as `qa:frontend`, as separate timed steps. It does
not repeat their internals or run verification twice. The complete browser
candidate remains available locally as `npm run qa:frontend`.
GitHub-connected Vercel—not Actions—creates the frontend Preview.

The CI candidate job has a 25-minute upper bound. Verify and build each have
5-minute step limits; browser QA has a 12-minute step limit around Playwright's
10-minute global timeout, leaving time to flush reports. CI stops after three
failed tests and does not automatically retry failures. It still cancels obsolete
runs on new pushes. These are safety ceilings, not promised healthy durations.
The non-visual job is capped at 10 minutes.

The `runtime` Playwright dependency first checks that the real anonymous home
request stays on the app origin, returns successful HTML, renders main content
and loads the real Clerk SDK. A redirect to a Clerk JSON error or unavailable
SDK therefore stops before the viewport/interaction suite. It does not bypass
middleware, replace Clerk or turn failed auth into a passing test. No real
account is created or signed in by this probe. Local-only account-management
specifications remain excluded from both projects.

CI retains the HTML/JSON browser reports and all failure evidence (including
traces, videos and error contexts), not only screenshots. This distinguishes an
auth/service failure from a missing visual component without another full run.

## Harness invariants

These are load-bearing. Each was learned from a failure that looked like an application bug.

- **`localhost` is the canonical frontend loopback origin.** The browser addresses the app server as `localhost`, and the app server does not pin a hostname. Next middleware normalizes loopback request origins to `localhost`, so pinning the server to `127.0.0.1` leaves the router comparing that against its literal init URL, misclassifying an internal rewrite as external and network-proxying the request back into itself. The visible symptom is a long stall ending in `Failed to proxy …`, `socket hang up` and `ECONNRESET` on routes that run middleware and then render. Never mix the two names for the application origin. The backend fixture is unaffected and stays on `127.0.0.1`, because nothing rewrites through it.
- **Candidate QA exercises the production runtime.** `qa:frontend` already builds, so Frontend QA sets `PLAYWRIGHT_SERVER_MODE=production` and the browser suite runs against that build via `next start`, which is what Vercel serves. Local `qa:browser` still defaults to `next dev`. Do not let a green `next dev` run stand alone as release evidence for a runtime concern.
- **CI Clerk uses a dedicated Development instance.** Browser QA needs a publishable key wherever `clerkMiddleware()` runs, so the workflow supplies a disposable Clerk development application through a repository variable and secret, scoped to the single candidate-check step rather than the job or workflow. Never point CI at production credentials, and never commit key values.
- **Local QA must use an explicit existing Development key pair.** The preflight reads the same `.env*` mode as Next and refuses missing, incomplete or Production keys before starting either server. The app server disables Clerk keyless mode explicitly, so a missing configuration cannot create a temporary instance or redirect through keyless synchronization. An intentionally external `PLAYWRIGHT_BASE_URL` does not need local keys. This configuration check does not replace the real Clerk browser preflight.
- **Playwright `page.route()` cannot mock server-side fetching.** It intercepts browser requests only, so anything a server component or route handler fetches during render is out of reach. A page whose data is fetched server-side will render its empty or error state no matter what the browser mock returns.
- **Server-side backend dependencies use the local fixture backend.** `scripts/e2e-backend-stub.mjs` serves repository-owned synthetic data from `e2e/fixtures/`, and `playwright.config.ts` points `BACKEND_BASE_URL` at it. Paths the fixture does not model answer 503, matching what the application already sees when no backend is reachable. Fixture data is deliberately unmistakable and must never reach a production data path.

## Infrastructure blockers

- A missing package/browser binary, blocked loopback, or occupied QA port fails before server startup with a `[qa:browser:infra]` message and the direct remediation.
- Missing system libraries or a browser sandbox restriction should be reported from Playwright's launch error; do not replace the runner or add process-management workarounds.
- Server startup output is piped into the run. A readiness timeout or early server exit is a startup/infrastructure failure, not a browser assertion.
- Application failures retain traces, screenshots, and video under `test-results/`; report the assertion or runtime error separately from infrastructure failures.

## Visual and interaction pass

- Page and primary content load without uncaught errors, hydration warnings, failed essential resources, or unexpected console errors.
- No horizontal overflow, clipped text, overlapping UI, broken max-width, unstable hover sizing, or unintended layout shift.
- Inspect saved screenshots of each changed route and important state at representative viewport sizes; a passing overflow or geometry assertion does not establish a good composition. Check first-viewport hierarchy, element collisions, and usable space around the primary action.
- For a component that must adapt to its width, follow `adaptive-layout-qa.md`: measure the before state, sweep every width against explicit rules, feed worst-case fixtures, then inspect screenshots and the states behind sign-in.
- Alignment, hierarchy, line length, data formatting, image/canvas framing, and contrast remain coherent from small mobile to wide desktop.
- Navigation and mobile menu open, close, trap/release focus appropriately, restore focus, and respond to Escape and outside interaction when intended.
- All controls work with keyboard and have visible focus. Tab order follows the visual/task order; sticky content does not cover focus.
- Touch targets, scrolling, drag/pan alternatives, and input behavior work without hover dependence.
- Loading, empty, error, timeout, unauthorized, retry, partial, and stale states are exercised for changed integrations. Do not simulate only happy-path data.
- Reduced motion preserves content and state while removing smooth scroll, parallax, pinning, loops, and large travel as appropriate.

## Evidence and triage

Record route, commit/diff state, browser, viewport, steps, expected/actual, severity, console excerpt, and screenshot/trace path. Use traces or video for timing/scroll defects; avoid large baseline suites until a stable visual-review policy exists.

Minimum candidate evidence is limited to each affected route, its changed or important states, and representative required viewports from `viewport-matrix.md`; include applicable keyboard, touch, zoom, and reduced-motion behavior. Broaden evidence only when the changed surface or risk requires it.

Frontend QA keeps viewport screenshots as a CI artifact for review. The reviewer opens the artifact and checks the affected states before visual handoff; the green CI badge alone does not record that review. Local runs can set `PLAYWRIGHT_CAPTURE=1` to capture the homepage matrix. The sign-up layout and open mobile search capture their states in their focused tests. Record any real-device screenshot separately with its effective CSS viewport and keyboard/browser state.

Automated checks, screenshots, traces, and Preview evidence establish technical and review evidence only. They do not constitute visual, product, or release acceptance; the human approver records those decisions separately. Non-visual changes may mark Preview and visual acceptance not applicable with a reason.

Severity: `blocker` prevents the core task or exposes data/security; `high` breaks a major viewport/input/state; `medium` degrades comprehension or consistency; `low` is a bounded polish issue. Browser QA reports first and does not edit until Main assigns ownership.
