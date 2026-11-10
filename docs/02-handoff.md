# Handoff — state of the project, 2026-11-10

Written so the next session (or another agent) can resume without re-discovering anything.
Read this first, then `docs/00-concept.md` (the rules) and `PLAN.md` (the sessions).

---

## 1. What exists right now

| | |
|---|---|
| Source | `github.com/Stanwesly/riplay-web` — **public**, branch `master` |
| Local path | `~/Projects/riplay` |
| Astro | 5.18.2 (a v7 exists; deliberately not migrating) |
| Build | `npm run build` → `dist/` — one page, ~24 KB total, no webfonts |
| **Live** | **https://comforting-vacherin-7e37c5.netlify.app** |
| Custom domain | `riplay.cz` — **not yet pointed**, still OVH parking |
| Deploy method | Netlify **Drop** (manual zip upload). No git link yet. |

Verified live on 2026-11-10, measured from outside the browser:
HTTP 200 over HTTPS with HSTS, design-system CSS loading (`body` = `rgb(11,11,12)`),
headline `Dílna, kterou si můžeš přehrát.`, all six Replay stages and the scrubber in the
DOM, no console errors, no horizontal overflow, footer address + `mailto:info@riplay.cz`
present.

Front page contents: hero, Replay scrubber over a **sample** part (labelled as a sample —
constitution rule: nothing unreal), three services with unknown facts rendered as
`doplní se`, an exploded section drawing, the workshop state table, the build journal,
contact CTA, legal footer.

Visual system added 2026-11-10: brand mark, nine-glyph icon set, exploded assembly
section, favicon, touch icon and social card — all authored as SVG, see §7.

---

## 2. The one thing still between us and riplay.cz

DNS, in this order — the domain must exist in Netlify **before** the records, or the
certificate has nothing to attach to.

1. Netlify site → **Domain management** → *Add a domain* → `riplay.cz`.
   Decline **Netlify DNS**; choose external/self-managed records.
2. OVH DNS zone — **delete** `A 51.161.122.78` and `AAAA 2001:41d0:701:1100::b909`.
   That AAAA is what served a certificate not covering the name.
3. **Add** `A` on `riplay.cz` → `75.2.60.5`, and `CNAME` on `www` →
   `comforting-vacherin-7e37c5.netlify.app`.
4. Wait for certificate issued in Netlify, then enable **Force HTTPS**.
5. Verify: apex + `www` over IPv4 **and** IPv6, valid cert, no parking page, and a
   deliberate choice of which hostname is primary (`www` → apex redirect is the default
   the footer/law expects).

Do **not** move the nameservers away from OVH: DNSSEC is on, and moving them drags the DS
chain along, which can black out the domain while it is rebuilt.

---

## 3. Decisions made this session (and why)

- **Netlify** over Cloudflare Pages / Vercel / GitHub Pages: free tier permits commercial
  use (Vercel Hobby forbids it, GitHub Pages terms exclude business sites), and the apex
  needs one `A` record so OVH nameservers + DNSSEC stay untouched (Cloudflare Pages wants
  the nameservers).
- **The OVH VPS is gone.** Not paid, not coming back. Consequence: the site is pure static
  files, so there is no runtime, no monthly bill, no patching. It also means nothing in
  DNS points at a stale VPS IP — the only records are the two parking ones.
- **`github.com/Aeell/riplay` is not used.** It is a one-shot AI experiment (automation
  agency + client-side toolbox, CS/EN/DE, GA4, its own design system), last pushed May
  2026, previously served from the VPS. The owner's verdict: it does not matter if it is
  replaced. It stays public and untouched as an archive. The new site lives in
  `Stanwesly/riplay-web`.
- **Deploy is manual (Drop) for now.** Wiring git is an open decision, not an oversight:
  it costs a collaborator invite or a Netlify account switch.

---

## 4. Salvage list from the old repo

Both are pre-built static files (no build step, no `node_modules`), so moving them is
path rewriting plus testing, not a rebuild. Target path: `/nastroje`.

| Tool | Size | Why it fits a workshop |
|---|---|---|
| `tools/googlefont2svg/` | 968 KB | Font → SVG/DXF paths — real laser/CNC toolpaths from text |
| `tools/converter/` | 2.0 MB | STL/DXF/PDF conversion in the browser; rescues badly exported customer files |

Skipped on purpose: PDF Toolkit, QR Studio, Image Compressor — office utilities, no
workshop story, and they'd dilute the single-idea front page.

A copy of the old repo is at `/tmp/riplay-old` (depth-1 clone) — **temporary**. Re-clone
from `Aeell/riplay` when the migration session starts.

---

## 5. Working locally

This shell exports `PORT=0`, so always pin the port explicitly:

```bash
cd ~/Projects/riplay
npm run dev -- --port 4321 --host 127.0.0.1     # http://127.0.0.1:4321
npm run build                                    # → dist/
```

Deploying by hand while git is unwired:

```bash
npm run build && (cd dist && zip -qr ../riplay-site.zip .)
# then drag ~/Projects/riplay/riplay-site.zip onto app.netlify.com/drop
```

`riplay-site.zip` and `dist/` are gitignored — they are build output, never committed.

---

## 6. Resume checklist, in order

1. [ ] DNS: the five steps in §2. Then verify externally (apex, `www`, IPv6, cert).
2. [ ] Decide: git-linked deploys or keep dragging zips. Git is worth it the moment real
       edits start.
3. [ ] Push the domain decision back into `PLAN.md` D3 and tick it.
4. [ ] Next content session is **D2** — typed `parts`/`episodes` collections so a new part
       page needs no code. That is what turns this from a page into a workshop log.
5. [ ] Real facts still needed from the owner: machine envelope and real tolerance, actual
       part photos, price bands, `IČO`. **`IČO` is blocked on the Czech trade licence**
       (`PLAN.md` D11) — do not fill it in speculatively; the footer renders
       `IČO doplní se` on purpose.
6. [ ] Tools migration (`/nastroje`) — only after the domain is live; it is a public
       surface and should not be built on a temporary URL.

---

## 7. Brand and drawings

Everything visual is authored vector, in the site's own language. There is deliberately no
icon dependency and **no generated imagery**: a machine-generated photo of a part that has
not been made would be the exact lie the constitution forbids. When real photos exist they
replace drawings; drawings never pretend to be photos.

| Path | What |
|---|---|
| `src/components/Mark.astro` | the mark: hairline circle (a part) + accent play glyph. Survives 16 px |
| `public/mark.svg` | same mark as favicon, on a graphite rounded tile |
| `src/components/Icon.astro` | nine glyphs, 24 px grid, 1.4 stroke, no fills: brief/cad/cam/mill/print/done/cnc/assembly |
| `src/components/Iso.astro` | exploded assembly as an orthographic section — hatch, bolt centre lines, **no dimensions** |
| `public/og.png` | 1200×630 social card |
| `public/apple-touch-icon.png` | 180×180 touch icon |
| `assets/og.svg` | social card source (not published) |

Regenerate the raster assets after editing their SVG sources:

```bash
rsvg-convert -w 1200 -h 630 assets/og.svg -o public/og.png
```

Rules of the system, so it stays one system:

- The accent `#ff5c1a` appears **once per view** — numbers, the play glyph, the Replay
  progress, or one active state. Never two competing acccents in a section.
- Icons are stroke-only and inherit `currentColor`; they may never be filled, coloured or
  rotated. Numbers stay in the mono face, not inside glyphs.
- The section drawing carries **no dimensions**, only the label `sestava · řez, bez rozměrů`.
  A number there would read as a real part's spec.
- Drawings are line art on the same 48/96 px grid as the page background; no gradients, no
  shadows, no 3D rendering.
- Screenshots of the site are working artefacts, gitignored (`.shots/`), because the
  machine's browser cannot always paint while the desktop is idle — use headless Chromium
  against the dev server instead:
  `chromium --headless=new --window-size=1440,2900 --screenshot=.shots/full.png http://127.0.0.1:4321/`

## 8. Rules that must survive the handoff

- **Nothing unreal.** No stock photos, no invented numbers, no fake finished projects.
  Anything unknown renders as a visible gap (`doplní se`). This is the whole point of the
  site, not a placeholder convention.
- Address is published deliberately (already public on Maps/Mapy.cz); contact is
  `info@riplay.cz`. Do not reintroduce the old Gmail or the phone number into page copy.
- `/usr/share/omarchy` is package-owned — unrelated to this repo, but the same instinct
  applies: user content in `src/`, build output in `dist/`, nothing hand-edited in-between.
