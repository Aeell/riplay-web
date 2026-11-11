# Handoff — state of the project, 2026-11-10

Written so the next session (or another agent) can resume without re-discovering anything.
Read this first, then `docs/00-concept.md` (the rules) and `PLAN.md` (the sessions).

---

## 1. What exists right now

| | |
|---|---|
| Source | `github.com/Aeell/riplay-web` — **public**, branch `master` |
| Local path | `~/Projects/riplay` |
| Astro | 5.18.2 (a v7 exists; deliberately not migrating) |
| Build | `npm run build` → `dist/` — one page, ~112 KB incl. the PNG icons, no webfonts |
| **Live** | **https://comforting-vacherin-7e37c5.netlify.app** |
| Custom domain | `riplay.cz` — **not yet pointed**, still OVH parking |
| Deploy method | **git-linked** → `Aeell/riplay-web` `master`; a push is the deploy |

Verified live on 2026-11-10, measured from outside the browser:
HTTP 200 over HTTPS with HSTS, design-system CSS loading (`body` = `rgb(11,11,12)`),
headline `Dílna, kterou si můžeš přehrát.`, all six Replay stages and the scrubber in the
DOM, no console errors, no horizontal overflow, footer address + `mailto:info@riplay.cz`
present.

Re-verified 2026-11-11, after the move to a git-linked deploy: `/_astro/*.css` 200
`text/css`, `/mark.svg` 200 `image/svg+xml`, `/og.png` and `/apple-touch-icon.png` 200
`image/png`, `og:image` at 1200×630, and `x-frame-options: DENY` present — the first
proof that `netlify.toml` is honoured, since Drop deploys ignored it.

Front page contents: hero, Replay scrubber over a **sample** part (labelled as a sample —
constitution rule: nothing unreal), three services with unknown facts rendered as
`doplní se`, an exploded section drawing, the workshop state table, the build journal,
contact CTA, legal footer.

Visual system added 2026-11-10: brand mark, nine-glyph icon set, exploded assembly
section, favicon, touch icon and social card — all authored as SVG, see §7.

---

## 2. riplay.cz is live — cut over 2026-11-11

Done and verified from the public internet. OVH stays authoritative (`ns200` /
`dns200.anycast.me` unchanged); only site records moved. Final state:

| Record | Value |
|---|---|
| `riplay.cz` A | `75.2.60.5` (Netlify) |
| `riplay.cz` AAAA | none — IPv6 clients fall back to IPv4 |
| `www` CNAME | `comforting-vacherin-7e37c5.netlify.app` |
| `MX` ×5, SPF TXT, both hosting-marker TXTs | untouched |
| `auto`…`tools` A, `ftp` CNAME | untouched, now pointless |

- **Primary domain in Netlify is `riplay.cz`**; `www` redirects to it.
- **Certificate**: Let's Encrypt `CN=riplay.cz`, SAN `riplay.cz` + `www.riplay.cz`, issued
  2026-11-11 07:52 UTC, expires 2027-02-09. Renewal is automatic.
- Verified: `https://riplay.cz` → `200`, valid cert, title `Riplay — dílna, kterou si můžeš
  přehrát`; `http://riplay.cz` → `301 https://riplay.cz/`; `https://www.riplay.cz` → `301
  https://riplay.cz/`; HSTS `max-age=31536000` plus every `netlify.toml` header
  (`x-frame-options: DENY`, `nosniff`, `referrer-policy`) present on the custom domain.
- **IPv6 is verified nowhere**: this laptop's network has no IPv6 route at all
  (`ipv6.google.com` fails too), so `www` over v6 is untested, not broken.
- OVH quirks, for the next time: the "add entry" form takes the **subdomain only** (`www`,
  not `riplay.cz`, or it becomes a root CNAME and is refused), and a CNAME cannot be added
  while any other record sits on that name — the `www` `TXT` `3|welcome` had to go first.

Leftovers, none urgent: delete the seven stale subdomain `A` records and the `ftp` CNAME;
decide on the OVH **Starter** hosting plan (check whether the mailbox is bundled in before
cancelling); optionally drop the duplicate SPF `TXT`.

---

## 3. Decisions made this session (and why)

- **Netlify** over Cloudflare Pages / Vercel / GitHub Pages: free tier permits commercial
  use (Vercel Hobby forbids it, GitHub Pages terms exclude business sites), and the apex
  needs one `A` record so OVH nameservers + DNSSEC stay untouched (Cloudflare Pages wants
  the nameservers).
- **The OVH VPS is gone, but its address is not.** `51.161.122.78` (and the matching
  `2001:41d0:701:1100::b909`) is still the `A`/`AAAA` for the apex, `www` and seven
  subdomains, and that host answers HTTPS with a certificate that does not cover
  `riplay.cz` — which is why the domain has no working HTTPS today. The same zone holds
  the mail records, so the change has to be surgical (§2) rather than a nameserver move.
- **`github.com/Aeell/riplay` is not used.** It is a one-shot AI experiment (automation
  agency + client-side toolbox, CS/EN/DE, GA4, its own design system), last pushed May
  2026, previously served from the VPS. The owner's verdict: it does not matter if it is
  replaced. It stays public and untouched as an archive. The new site lives in
  `Aeell/riplay-web`.
- **Deploy is git-linked (2026-11-11).** Netlify is authorised for the GitHub identity
  `Aeell`, and a Netlify repo picker only lists repos of that identity. The repo was first
  created under `Stanwesly`, so it could never appear. The fix was to move the repo to
  `Aeell` and link it — not a collaborator invite, and not a deploy token in CI.
  `Stanwesly/riplay-web` survives as a stale mirror; do not push to it.

---

## 4. The old site, and what is salvaged from it

`Aeell/riplay` is the previous site: RIPlay as an **automation agency** (Feb–May 2026),
static HTML in CS/EN/DE with five browser tools, a Node API, served from a VPS that no
longer exists. It stays public and read-only as the record. A depth-1 clone for inspection
sits at `~/Projects/riplay-old` — re-clone from GitHub if it is ever removed.

The tool source needs no build step, so moving one is path rewriting plus testing, not a
rebuild. Target path: `/nastroje`.

| Tool | Size | Why it fits a workshop |
|---|---|---|
| `tools/googlefont2svg/` | 968 KB | Font → SVG/DXF paths — real laser/CNC toolpaths from text |
| `tools/converter/` | 2.0 MB | STL/DXF/PDF conversion in the browser; rescues badly exported customer files |

The other three — PDF Toolkit, QR Studio, Image Compressor — are office utilities with no
workshop story. They stay in the archive until there is a reason to port them; that is an
**open decision, not a queue**, and the site says so rather than promising an order.

**Recorded on the site at `/archiv`** (`src/pages/archiv.astro`, in the nav and footer):
what the old site was, why the brand moved from automation agency to workshop, all five
tools with their fate, and what is deliberately dropped —

- Google Analytics 4 and the consent banner (the new site has no third-party tracking)
- the German version (Czech is the customer language, English the audience language)
- the `/api` endpoints: they died with the VPS, so server-side compression of large PDFs
  is gone for good, not "coming back"
- the agency copy itself: "we help companies streamline processes" is unfalsifiable, which
  is exactly what this site exists to avoid

Porting a tool means **rewriting it in the current visual language and vendoring its
libraries** — no third-party CDN, no analytics — never copying the old pages across.

---

## 5. Working locally

This shell exports `PORT=0`, so always pin the port explicitly:

```bash
cd ~/Projects/riplay
npm run dev -- --port 4321 --host 127.0.0.1     # http://127.0.0.1:4321
npm run build                                    # → dist/
```

### Deploys

**`Aeell/riplay-web`** (public, branch `master`) is the source of truth and is linked to the
Netlify site as of 2026-11-11, so a `git push` is the deploy and the Drop workflow is
retired. `netlify.toml` carries the build contract — `npm run build`, publish `dist`, Node
22, long-cache `/_astro/*`, never cache HTML — and the UI fields for build command and
publish directory are left **empty** on purpose, because duplicating them there is how the
two drift apart.

A clean clone was verified before linking: `npm ci && npm run build` produces a 112 KB
`dist/` with the page and every asset.

Why the account swap was necessary: Netlify is authorised for the GitHub identity `Aeell`,
and its repo picker only lists repositories belonging to that identity. The project was
first created under `Stanwesly`, which is why the picker showed every `Aeell` repo and no
`riplay-web`. Moving the repo was the fix; a collaborator invite or a deploy token in CI
would both have papered over the same mismatch.

Local consequences:

```bash
gh auth switch --user Aeell       # the active gh account on this machine is now Aeell
gh auth switch --user Stanwesly   # switch back for other projects on this box
git remote -v                     # origin = Aeell/riplay-web; stanwesly = stale mirror
```

The old hand deploy still works, but it no longer publishes the site:

```bash
npm run build && (cd dist && zip -qr ../riplay-site.zip .)
# then drag ~/Projects/riplay/riplay-site.zip onto app.netlify.com/drop
```

`riplay-site.zip` and `dist/` are gitignored — they are build output, never committed.

---

## 6. Resume checklist, in order

1. [x] DNS: done 2026-11-11 — `riplay.cz` + `www` live on Netlify, valid cert covering
   both names, §2. IPv6 still unverified: no v6 route on the laptop.
2. [x] Netlify is linked to `Aeell/riplay-web` (§5) — a `git push` is now the deploy.
3. [ ] Push the domain decision back into `PLAN.md` D3 and tick it.
4. [ ] Next content session is **D2** — typed `parts`/`episodes` collections so a new part
       page needs no code. That is what turns this from a page into a workshop log.
5. [ ] Real facts still needed from the owner: machine envelope and real tolerance, actual
       part photos, price bands, `IČO`. **`IČO` is blocked on the Czech trade licence**
       (`PLAN.md` D11) — do not fill it in speculatively; the footer renders
       `IČO doplní se` on purpose.
6. [x] Old site archived at `/archiv` (§4): repo kept public, page records what
       survives and what is deliberately dropped.
7. [ ] Tools migration (`/nastroje`): port `googlefont2svg` first (CNC/laser text
       paths), then the converter. Both need de-branding, local libraries and the new
       visual language. Porting the other three is an open decision (owner's call).

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
