# Viewport Matrix

These are representative QA sizes, not new CSS breakpoints. Test the exact target plus intermediate widths where layout modes change.

Screenshots at these sizes judge composition. Layout correctness across every width is checked with a width sweep against explicit rules; see `adaptive-layout-qa.md`.

| Class | Viewport | Primary checks |
| --- | --- | --- |
| Small mobile | 320 x 568 | Long words, controls, fixed chrome, horizontal overflow |
| Modern mobile | 390 x 844 | Touch, mobile menu, sticky elements, virtual-keyboard-sensitive inputs |
| Tablet portrait | 768 x 1024 | Grid collapse, navigation, chart/canvas framing |
| Laptop | 1366 x 768 | Short-height behavior, sticky/scroll narratives, content density |
| Scaled desktop example | 1536 x 800 | Common effective CSS viewport on a high-resolution display with OS scaling and browser chrome; auth/hero balance |
| Desktop | 1440 x 900 | Main composition, alignment, readable line lengths |
| Wide desktop | 1920 x 1080 | Max-width behavior, excessive empty space, full-bleed framing |

Also spot-check 480, 820, and 1024 px widths because current CSS and homepage behavior change around them. For a visual change, capture at least one mobile, laptop, and wide result; add all six when navigation, sticky behavior, canvas, charts, or page-level layout changes.

Use device scale factor 1 for layout measurements unless testing high-density canvas explicitly. Repeat critical touch flows with a real mobile emulation profile and repeat desktop flows at 200% zoom where practical.

The browser lays out CSS pixels, not the monitor's physical pixels. Record `window.innerWidth`, `window.innerHeight`, `visualViewport.height`, browser zoom, and device scale when reproducing a screenshot. A 1920 x 1200 monitor may expose a much smaller CSS viewport after OS scaling and browser chrome.

For changed full-page compositions, inspect screenshots at each affected layout mode, including a short laptop and an intermediate width near each relevant breakpoint. For input-heavy mobile states, inspect both the closed and open state with the real on-screen keyboard on at least one target device. An emulated `visualViewport` resize is a regression check, not a substitute for that device pass.
