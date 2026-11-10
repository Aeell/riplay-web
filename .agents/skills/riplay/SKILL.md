---
name: riplay
description: Working context for riplay.cz — a Czech one-person precision workshop site (CNC, CAD, 3D printing, custom car-interior parts) that documents each job as a replayable "part passport". Use this skill whenever the task mentions riplay, riplay.cz, the dílna/Dílna pages, part passports, the Replay scrubber, the parts/episodes content model, riplay-web, or any deploy/DNS work for that domain — and also when the work is in ~/Projects/riplay even if the name is never said. It carries the non-negotiable "nothing unreal" rule, the environment traps, and the deploy facts, so it is worth reading before the first edit rather than after the first mistake.
---

# riplay.cz — project context

One person (Stanimir Stankov) in Liberec, Czech Republic: CAD, CNC milling, precision
parts, 3D printing, custom car-interior assemblies. The site's thesis is **riplay = replay**:
a workshop you can replay. The unit of content is a **part passport** — how one object went
from brief to finished part — and the signature interaction is a six-stage scrubber
(Zadání → CAD → CAM → Fréza → Tisk → Hotovo).

The site is deliberately not a portfolio, not an e-shop, not an SEO blog. If a request would
turn it into one of those, say so instead of building it.

## Non-negotiables (the constitution)

- **Nothing unreal.** No stock photos, no invented projects, no invented numbers, no
  testimonials, no "we". Every number on a real page traces to a job record.
- **Unknown is shown as unknown.** A `null` fact renders as a visible gap, e.g.
  `doplní se`. Never fill a gap to make a page look complete. This is the product, not a
  placeholder habit.
- **No webfonts, no framework CSS.** Hand-written CSS in `src/styles/global.css`,
  system font stack. Graphite `#0b0b0c`, hairline grid, mono for data, exactly one accent
  `#ff5c1a`, technical-drawing visual language.
- **Czech copy is written, never machine-translated.** Casual, first person, short.
  It is a one-man workshop, so "já", not "tým" or "společnost".
- The home address is published **on purpose** (already public on Maps and Mapy.cz);
  contact is `info@riplay.cz`. Do not reintroduce the old Gmail or a phone number.
- **`IČO` is not known yet** — blocked on the Czech trade licence (EU citizen awaiting a
  home-country criminal-record extract, which must be ≤3 months old). The footer renders
  `IČO doplní se` intentionally. Do not guess or omit the line.

## Where the truth lives

Read in this order, and prefer these files over memory:

| File | Holds |
|---|---|
| `docs/00-concept.md` | the rules and what the site is not |
| `docs/02-handoff.md` | **current state**, exact pending DNS steps, decisions with reasons, resume checklist |
| `PLAN.md` | 30 sessions with a done test each; D3 is hosting, next real work is **D2** |
| `src/data/shop.ts` | services + legal facts (`null` = not known yet) |
| `src/data/replay.ts` | the sample part shown by the scrubber |

`docs/02-handoff.md` is the state of record. When something material changes (deployed,
DNS done, a decision reversed), update it in the same session — a stale handoff is worse
than none, because the next session trusts it.

## Environment traps

- **This shell exports `PORT=0`.** Always pin the port:
  `npm run dev -- --port 4321 --host 127.0.0.1`. Unpinned, the dev server logs
  `127.0.0.1:0` and looks broken.
- **npm, not bun** (bun is not installed here).
- **Astro 5.18.2 is pinned deliberately.** The installer advertises v7; do not migrate as
  a side effect of an unrelated task.
- Repo: `github.com/Stanwesly/riplay-web`, now **public**, branch `master`.
  Local: `~/Projects/riplay`.
- `github.com/Aeell/riplay` is the **owner's old one-shot AI experiment** (automation agency
  + client-side toolbox). It is an archive: do not resurrect it, do not "finish" it, do not
  copy its design system. Its only live value is two pre-built tools worth salvaging to
  `/nastroje`: `tools/googlefont2svg/` (font → SVG/DXF, real CNC/laser paths) and
  `tools/converter/` (STL/DXF in-browser). PDF Toolkit, QR Studio and Image Compressor were
  dropped on purpose.
- The OVH VPS that once served that old site is **gone and not coming back**. There is no
  server to deploy to, patch, or pay for. Anything that assumes a runtime is wrong.

## Deploy and DNS

Static, on Netlify, currently deployed as a **manual Drop zip** (no git link yet):
`https://comforting-vacherin-7e37c5.netlify.app`.

```bash
cd ~/Projects/riplay
npm run build && (cd dist && zip -qr ../riplay-site.zip .)
# drag ~/Projects/riplay/riplay-site.zip onto app.netlify.com/drop
```

`dist/` and `riplay-site.zip` are build output and gitignored.

DNS facts (registrar OVH, **DNSSEC enabled**):

- Target: `A` on the apex → `75.2.60.5`; `CNAME` on `www` → the `.netlify.app` host.
- Delete both `A 51.161.122.78` and `AAAA 2001:41d0:701:1100::b909`. The **AAAA is the one
  people skip**, and it is what served a certificate that did not cover the name.
- **Never move the nameservers** away from OVH: DNSSEC drags the DS chain along and can
  black out the domain while it is rebuilt. Add the domain in Netlify *before* the records,
  or the certificate has nothing to attach to.
- Netlify free tier permits commercial use; Vercel Hobby forbids it, GitHub Pages terms
  exclude business sites. That reasoning is settled — do not reopen it.

## Verifying a deploy

Measure from outside; a successful upload or a green banner is not evidence. Check status
and HSTS headers, that the CSS asset returns `200` with `content-type: text/css`, that
`body` computes to `rgb(11, 11, 12)` (proves the design system loaded rather than a
browser default), that six Replay stages exist, and that the console is clean. Check both
the apex and `www`, over IPv4 **and** IPv6.

Say "not viewed" for anything visual you did not actually look at, and never report a
check as passed when it could not run.

## How to work on it

- One `PLAN.md` session at a time, and finish its **done test** before starting the next.
  If a session overruns, the next one slips — sessions are not skipped.
- Small, real steps beat big scaffolds: the page is ~24 KB with one inline script, so
  performance work is meaningless until there is real content. Do not optimise a sample.
- Prefer editing `src/data/*` and `src/pages/index.astro` over adding dependencies. There
  is no build complexity to fix.
- When the owner gives a fact (tolerance, price band, machine envelope), put it in
  `src/data/shop.ts` and delete the corresponding "doplní se" — do not sprinkle it in
  copy where it can drift.
- End a work session by updating `docs/02-handoff.md`, committing, and pushing. The owner
  resumes from that file, not from chat history.

## Communication

The owner writes in short, sometimes typo-heavy English, mixes Czech ("doplnit",
"PŘIPRAVUJEME"), and is usually mid-task on the machine. Answer in the same register:
lead with the answer or the action, keep it to a few sentences, name the one thing he has
to do next if anything is blocked on him. Skip preamble, skip restating what he said, skip
options he did not ask for. Explain a trade-off only when the choice is irreversible or
costs money.
