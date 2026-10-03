# Adaptive Layout QA

How to change and verify a layout that must work at every width, not just on a list of devices. The principle lives in `docs/design/design-system.md` ("Adaptive layout"); this is the working method. The ticker hero is the worked example: `components/stocks/StockTickerIdentity.*`, `e2e/ticker-hero-layout.spec.ts`, `e2e/fixtures/ticker-page.mjs`.

## 1. Measure before changing anything

Write the sweep below first and run it against the current code. Record the widths where each rule fails (for example, "price separated from ticker: 280–940px"). That is the before state for the handoff, and it often shows the problem is wider than reported — a "mobile" bug that also exists on tablets and in narrow desktop windows.

## 2. Sweep widths against rules, not devices

`viewport-matrix.md` lists representative sizes for screenshots. Layout correctness is checked differently: one page, every width from 280px to 1920px in 10px steps, and the same rules at each step.

Pattern (see `e2e/ticker-hero-layout.spec.ts`):

- Load the page once, then `page.setViewportSize()` per width and wait two animation frames before measuring. Do not reload per width.
- Measure inside one `page.evaluate()` per width and return plain booleans. Collect every failure as `"<width>px: <rule>"` and assert the list is empty at the end, so one run reports all failing widths at once.
- Address elements with `data-*` hooks added for the purpose (`data-ticker-name`, `data-chart-range`, …), never with CSS-module class names, which are hashed.
- Compare positions with a small `sameLine(a, b)` helper (vertical overlap of more than half the shorter box) rather than exact pixel values.
- An element with `display: contents` has an empty box. Measure its grid or flex parent instead.

Rules worth expressing (pick those that carry the change's meaning):

- no horizontal page scroll;
- no two pieces of the component overlap;
- units that must stay together stay on one line (ticker and price);
- text is shortened only when nothing else shares its line and it already reaches the end of its space;
- controls are fully visible and never need sideways scrolling, including every option inside them;
- ordering rules hold when things wrap (the timeframe control sits directly under the chart, never below the facts);
- a component does not exceed the number of lines it is allowed from a given width (for example, actions never take a line of their own from 360px);
- chart axis labels neither collide nor leave the plot.

A sweep takes about 40 seconds per fixture. Keep it to the components the change touches.

## 3. Feed it the worst cases

Real data rarely contains the cases that break layouts, and the fixture backend serves nothing for real symbols. Add synthetic records to `e2e/fixtures/` and serve them from `scripts/e2e-backend-stub.mjs`:

- clearly fake identifiers (`QAS`, `QAM`, `QAL`) whose names say they are fixtures;
- one record per extreme: shortest and longest names, the longest exchange label the site renders, prices with more digits, an optional value present (daily change) and absent;
- deterministic values only.

Fixture data must never reach a production data path (see `browser-qa.md`).

## 4. Look at it, too

A passing sweep proves geometry, not composition. Capture screenshots and read them:

- the representative widths from `viewport-matrix.md`, plus one width just either side of each point where the layout changes;
- both themes (`page.emulateMedia({ colorScheme })`);
- touch and pointer contexts (`browser.newContext({ hasTouch: true, isMobile: true })`) when target sizes or gestures differ — prefer `pointer`/`hover` media features to widths for this;
- for motion, a few frames during the animation as well as the settled state, and `reducedMotion: 'reduce'`.

Use a throwaway spec (name it `e2e/zz-*.spec.ts`) that writes screenshots to a scratch directory outside the repository, and delete it before committing.

## 5. States behind sign-in

Browser QA runs without Clerk sessions, so signed-in-only UI cannot be reached directly.

- Browser-side requests can be mocked with `page.route()` (for example `/api/export-signals` returning 502, or 404 with JSON). Server-side fetching cannot; see `browser-qa.md`.
- To see a signed-in-only state, force the flag locally (for example pass `signedIn={true}` in the chrome), capture, then restore the file and confirm with `git diff` that nothing of it remains before committing. Never commit the forced state, and say in the handoff that these states were checked this way rather than by an automated test.
- Production and the local harness differ here. Without `CLERK_SECRET_KEY` the middleware skips protection, so a protected API route answers with its own 401. In production, `auth.protect()` answers a signed-out API request with a bare 404. Client code must not rely on seeing 401 there (ENG-18).

## 6. Hygiene before committing

- The full browser suite rewrites `artifacts/visual-feedback/*.png`. If the change is not about those captures, restore them with `git restore artifacts/visual-feedback`.
- A typecheck that runs while the dev server is writing `.next-playwright/` can fail on half-written generated route types. Re-run it after the server has stopped before treating it as real.
- Run `git status` and read the final diff: no `zz-*` specs, local configs, scratch screenshots or forced flags.

## 7. Claude Code cloud containers

These sessions ship a preinstalled Chromium at `/opt/pw-browsers/chromium`, which may not match the revision the project's Playwright expects; `qa:browser` then stops with a missing-binary error. For local investigation only, an untracked config can reuse it:

```ts
// playwright.local.config.ts — never commit; add it to .git/info/exclude
import base from './playwright.config'
export default {
  ...base,
  projects: base.projects?.map((project) => ({
    ...project,
    use: { ...project.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
  })),
}
```

Run with `npx playwright test -c playwright.local.config.ts <spec>`. It keeps the Playwright-owned servers and ports. Report it as a deviation from `qa:browser`. Production-mode runs (`PLAYWRIGHT_SERVER_MODE=production`) also need the Clerk development key that only CI holds, so that evidence comes from Frontend QA on the PR.
