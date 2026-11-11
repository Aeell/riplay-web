# riplay.cz

A workshop you can replay. One person, precision parts, and a public record of how
each object was made. Read `docs/00-concept.md` first — it is the constitution; this
file is only the operating manual.

## Status (2026-11-10)

Live on **https://riplay.cz** — `www` redirects to it, and the certificate covers both
names. Deploys are git-linked: push to `Aeell/riplay-web` and Netlify builds it.
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

## Layout

```
docs/00-concept.md   what the site is, the rules, what it is not
PLAN.md              30 sessions, each with a done test
src/styles/          the design language (graphite, hairline grid, one accent)
src/data/            shop facts and the sample Replay part
src/components/      Replay — the signature stage scrubber
src/pages/           home, /archiv (the old site), /nastroje (the toolbox)
src/lib/             font-geometry.mjs — outlines to SVG/DXF in mm, testable from Node
scripts/             verify-font2dxf.mjs — proves the exported DXF scale
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
