# riplay.cz

A workshop you can replay. One person, precision parts, and a public record of how
each object was made. Read `docs/00-concept.md` first — it is the constitution; this
file is only the operating manual.

## Status (2026-11-13)

Live on **https://riplay.cz** — `www` redirects to it, and the certificate covers both names.
Routes: `/`, `/dil`, `/dil/<slug>`, `/zakazka`, `/nastroje`, `/nastroje/prevod`, `/archiv`.

**Deploys are paused, and nothing is broken:** the account is on Netlify's credit plans and
the 300 monthly credits are spent, so production deploys are refused while the site keeps
serving the last good one. `DEPLOY.md` has the credit maths, the free alternatives and the
Cloudflare Pages kit already in the repo. Until then a push is *code on GitHub only*.

Everything current, including the resume checklist, is in
[`docs/02-handoff.md`](docs/02-handoff.md).

## Run

```bash
npm install
npm run dev -- --port 4321 --host 127.0.0.1   # http://127.0.0.1:4321
npm run build                                 # static output in dist/
```

Always pin the port: this shell exports `PORT=0`.

Node 22+ (this machine: 26). No other services required.

The font picker calls `/api/font`, which only exists where the function runs.
`npm run preview:full` (after a build) serves `dist/` **and** that function on
`127.0.0.1:4331`, so the whole toolbox works locally without the Netlify CLI. Plain
`npm run preview` serves static files only, and there the picker reports that it could not
load a font; uploads, the built-in face and the 3D converter still work.

To refresh the Google Fonts catalogue (1 request, no key): `npm run fonts:catalog`.

## Layout

```
docs/00-concept.md   what the site is, the rules, what it is not
PLAN.md              30 sessions, each with a done test
src/styles/          the design language (graphite, hairline grid, one accent)
src/data/            shop facts and the sample Replay part
src/components/      Replay — the signature stage scrubber
src/pages/           home, /archiv (the old site), /nastroje + /nastroje/prevod (tools)
src/content.config.ts  typed `parts` and `episodes` collections (zod; unknown → null)
src/content/          parts/*.md, episodes/*.md — a file is a page
src/lib/             font-geometry.mjs (text → SVG/DXF), mesh.mjs (STL/OBJ/PLY/GLB),
                     paths2d.mjs (SVG ↔ DXF, mm, open/closed contours), font-proxy.mjs
netlify/functions/   font.mjs — /api/font adapter (Google Fonts → TTF)
functions/api/       font.js — the same endpoint as a Cloudflare Pages Function
scripts/             verify-font2dxf.mjs, verify-mesh.mjs, verify-paths2d.mjs,
                     verify-proxy.mjs, build-font-catalog.mjs, serve-local.mjs
DEPLOY.md            hosting costs, and how to leave Netlify for free
LICENSE              MIT (code) · LICENSE-CONTENT.md CC BY 4.0 · CODE_OF_CONDUCT.md
```

## Adding a part (from D2)

A part is a file with typed frontmatter plus a `Replay` block. Until the content
collections exist, the sample lives in `src/data/replay.ts`; do not invent numbers
for a real part — if a value is unknown it stays `null` and renders as a visible gap.

## Rules that are easy to break by accident

- No stock photos, no invented testimonials, no "we".
- Every number on a real page must come from a job record.
- If a value is unknown, show that it is unknown. `null` is a feature.
- Czech copy is written, never machine-translated.

## Licence

Code (`src/lib/`, `scripts/`, `netlify/`, `functions/`, the Astro setup) is **MIT** —
see `LICENSE`. Everything else — docs, page copy, build log, photographs — is **CC BY 4.0**
— see `LICENSE-CONTENT.md`. Third-party material keeps its own licence and is credited where
it is used; customer material stays the customer's.

Contributions are covered by `CODE_OF_CONDUCT.md`.
