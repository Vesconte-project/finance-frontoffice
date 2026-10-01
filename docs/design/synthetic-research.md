# Synthetic research surface — ENG-147

Mode: **Operate**. This is a narrow extension of Vesconte's existing visual world for a default-off, two-variant synthetic self-service proof. It does not define a new design system or authorize merge or deployment.

Audience and task: a signed-in research user configures two permitted variants, follows their execution, compares recorded metrics and inspects public evidence before explicitly repeating a comparison.

## Inherited material

[`design-system.md`](design-system.md) describes the incumbent identity; `app/globals.css` remains the runtime token source. The surface inherits paper/ink light and dark themes, semantic surface, border and content roles, and ochre keyboard focus. Source Serif headings, Plex Sans controls and Plex Mono identifiers preserve the established reading hierarchy.

The implementation reuses `Button`, `Input`, `Badge` and `Card`, flat bordered `surface-secondary` fieldsets, restrained corners and existing title utilities. It introduces no surface-specific palette or global token changes.

## Built composition

- Introductory copy states the synthetic scope before configuration.
- A comparison name precedes paired Variant A/B fieldsets: name, model and positive probability threshold. The trusted `synthetic-market-v1` fixture fixes target, features and horizon; the editable parameters are model and threshold. The fieldsets stack below the medium breakpoint.
- One primary submit action creates two distinct configurations. Submission is blocked during loading, submission, active execution, read errors, unknown outcome or session expiry; repeat loading fills the form and requires explicit submission.
- Recent comparisons group up to 50 runs, show variant status badges and expose an inspect action. Visible pages poll every five seconds while runs are active; manual refresh remains available. Partial or older single-run groups remain inspectable.
- Selected metrics appear in a horizontally scrollable table with one column per recorded variant and explicit unavailable values. Evidence columns sit below, stacking until the large breakpoint.
- Each evidence column presents public configuration and recorded identifiers/hashes, an expandable declarative request when available, execution events and artefact metadata. Empty, loading, failure, stale-read, partial-submission, unknown-outcome and expired-session copy make the recorded state explicit.

## Claims and review limits

Metrics use synthetic test data. Completed execution does not establish investment performance, causal validity or financial validation; the proof offers no investment advice and does not change official models. Artefacts expose metadata only, without contents or downloads. Recorded hashes identify configuration and fixture; the public API supplies neither executed code revision nor audit findings.

This note records built behavior, not product or visual acceptance. Preview review still needs the real Clerk-authenticated route and the complete global/sticky headers, including their interaction with controls and focused fields. Follow [`../qa/eng147-preview.md`](../qa/eng147-preview.md) for the technical preview runbook.
