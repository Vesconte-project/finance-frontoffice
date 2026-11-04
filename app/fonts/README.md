# IBM Plex font assets

Unmodified complete WOFF2 files from IBM's official npm packages:

- `@ibm/plex-sans@1.1.0`: `fonts/complete/woff2/IBMPlexSans-{Regular,Medium}.woff2`.
- `@ibm/plex-mono@2.5.0`: `fonts/complete/woff2/IBMPlexMono-{Regular,Medium}.woff2`.
- Upstream: https://github.com/IBM/plex
- Preserve the accompanying package licences: `LICENSE-PlexSans.txt` and `LICENSE-PlexMono.txt` (OFL-1.1).

`app/layout.tsx` loads the same two families, normal styles and 400/500 weights
through `next/font/local`, preserving the existing CSS variable interface and
swap behaviour. This removes the build-time Google Fonts URL-processing path
that failed in Turbopack (https://github.com/vercel/next.js/issues/99114).
No font file is generated, subsetted or renamed internally. Complete upstream
files retain the bundled character coverage; they can be larger than Google's
per-script subsets.

The npm archive SHA-512 digests were checked before extracting these files:

```text
@ibm/plex-sans@1.1.0
sha512-WPgvO6Yfj2w5YbhyAr1tv95RUz4LRJlqN+CmYvBglabXteufP1D1E9BABMde+ZIKdRbFJDoKF5eQzfhpnbgZcQ==
@ibm/plex-mono@2.5.0
sha512-STBJIPxPomOYPmBMO7z5TKPJUotAF9u3gAUumTqVgwgrAO+K4FRNh0MlhsoJjKhJKsMbBJR10/bk4inkj/wc1w==
```
