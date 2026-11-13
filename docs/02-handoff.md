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
| Build | `npm run build` → `dist/` — seven routes, no webfonts blocking text |
| **Live** | **https://riplay.cz** — site `f3abf7bc-b006-4cc4-a72a-8e3832df1c2d`, default URL `comforting-vacherin-7e37c5.netlify.app` |
| Custom domain | `riplay.cz` — **live since 2026-11-11**, Let's Encrypt covering apex + `www`, records in §2 |
| Deploy method | git-linked → `Aeell/riplay-web` `master`. **Paused 2026-11-13: the 300 free credits are spent, so production deploys are refused** — the hook is fine. See §5 and `DEPLOY.md` |

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

- **The RT control stack is proven in operation (owner, 2026-11-12):** a small CNC router
  is already controlled by Pi 5 + Flexi-HAL on the Remora Pi software. Not a paper stack —
  the shop's bench reality.
- **Machine direction (owner, 2026-11-12, open — "we'll see"):** take the platform a notch
  further into a **swappable-head machine** — CNC head / print head in an **enclosed
  envelope** with controllable, fast-changing temperature. Implications for the solution:
  head swap as LinuxCNC M6 with per-head tool offsets, extruder as a **U axis letter**
  (LinuxCNC has no E; axes are XYZABC UVW) so **one post-processor dialect serves both
  heads**, chamber temperature as another process loop, and the schedule gaining head +
  chamber-setpoint fields. Unverified bench item: Flexi-HAL analog I/O for thermistor/
  heater (RS485 is on the board — a companion MCU is the fallback). **LinuxCNC post is
  done in the fork** (`~/Projects/riplay-slicer`, commit `574d065`): box gcode comes out
  in LinuxCNC dialect, extrusion on U; the D16 done test still needs a real print on the
  machine plus the user-defined M-code files (M104/M109/M140/M190) in PROGRAM_PREFIX.
- **"Slicer" is the public word; the product is a 5-axis 3D printing solution (2026-11-12).**
  The site already says "Slicer, který neexistuje" and lists `5osý slicer · prototyp` — the
  term stays because it is what the maker audience searches for. What gets built is defined
  in `docs/research-slicer-fork.md` (machine retrofit + human-in-the-loop CAM for
  deposition + tabulated bead model + Replay viewer) and summarised in concept §3
  ("The word slicer"). Explicitly not a planar-stack monolith, not autonomy research.
  The full architecture/position paper is `docs/5axis-print-solution.md` — the planar
  trick, why the 2D path forces an autonomy chase, the control-loop architecture on the
  shop's verified Pi 5 + Flexi-HAL + Remora/LinuxCNC RT stack, and the Czech draft for
  the EP 01 episode (D14). **The machine-side integration spec is
  `docs/machine-integration.md`** (`riplay-machine`: switchable kinematics as the
  CNC↔5-axis seam, M100–M199 process layer, sim-first development order).

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

**The order is decided (owner, 2026-11-11):** GoogleFont2SVG first, then the converter.

### T3 verdicts (2026-11-13) — one per tool, with the audience named

| Tool | Verdict | Audience | Why |
|---|---|---|---|
| Image compressor | **archived** | zákazník with a 12 MB phone photo | The tool did nothing the phone does not already do; what that visitor needs is told in the intake copy (send the photo as it is, the site shrinks nothing and stores nothing). A page would be a utility with no workshop story. |
| PDF toolkit | **archived, for now** | partner sending a shop drawing | A PDF is a page, not a path. Pulling real vectors out needs a PDF parser and turns a raster "trace" into a guess about tolerances — exactly the kind of number this site refuses to invent. Revisit only when a real customer file forces it. |
| QR studio | **archived as a page; becomes a feature** | the workshop itself | The useful QR here is the one printed on the delivery note, pointing at the part's passport. That belongs to D23 paperwork, not to `/nastroje`. |

The rule that produced these: a tool ships only if it names an audience **outside** the
workshop and finishes one thing in under two minutes. All three failed one half of it.
Later the toolbox is meant to hold tools for **both kinds of visitor** — the customer who
knows nothing about CNC or 3D printing, and the partner/maker who speaks the language.
That rule is written into `PLAN.md` as the Tools programme (T1–T3): a tool ships only if
it can name the audience it serves, and the other three are judged against it in T3.

---

## 5. Working locally

This shell exports `PORT=0`, so always pin the port explicitly:

```bash
cd ~/Projects/riplay
npm run dev -- --port 4321 --host 127.0.0.1     # http://127.0.0.1:4321
npm run build                                    # → dist/
```

### Deploys

**`Aeell/riplay-web`** (public, branch `master`) is the source of truth and was linked to
the Netlify site on 2026-11-11 — the live deploy honours `netlify.toml` (its custom
headers show up on live responses), which Drop deploys never do. **Since 2026-11-13 the cause is known, and it is not the hook.** This account is on
Netlify's credit plans: 300 credits a month on Free, 15 per production deploy, 20 per GB of
bandwidth. The balance ran out, so production deploys are refused — they fail in about 0.1 s
with no build log, where successful ones took 16 s and left a `dist/` behind. The repo link,
the webhook and `netlify.toml` are all fine; nothing needs reinstalling. Deploy Previews and
branch deploys cost 0 credits, but they are disabled for this site (Settings → Build &
deploy → Branches) and the pause sits above them: pushing a branch produced no deploy at all
(verified 2026-11-13, branch deleted).

So until credits return: a `git push` is *code on GitHub only*, the live site keeps serving
the last good deploy, and work is batched into one release instead of ten. `DEPLOY.md` holds
the credit maths and the Cloudflare Pages path — the font proxy already has a Pages adapter
(`functions/api/font.js`), with `public/_routes.json` keeping page views off it.
`netlify.toml` carries the build contract — `npm run build`, publish `dist`, Node
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
2. [ ] **Deploys paused by credits (2026-11-13), not a broken hook.** Nothing to fix in the
       dashboard: the 300 monthly credits are spent. Wait for the cycle reset, buy a pack, or
       move hosting per `DEPLOY.md`. Asked Netlify support 2026-11-13: a courtesy grant, a
       ruling on the Open Source plan for the tooling, and whether a cheaper route exists.
       Meanwhile: batch work into a single deploy, and use `npm run preview:full` as the
       review loop — it costs nothing.
3. [x] Domain decision pushed into `PLAN.md` D3, which now closes as done (2026-11-11).
4. [x] Review of the D2/D14 routes (2026-11-13) — three defects, all fixed in `de20234`:
       (a) the episode route and the index each decided "is this live" separately, so a row could
       link to a page that was never generated; there is now one predicate, `isLive()` in
       `src/lib/episodes.ts` (published + dated + non-empty body), used by both; (b) the schema
       refuses a published episode without a date, because every page here states "stav k";
       (c) `.prose` was copy-pasted into both article pages and had already drifted — it is one
       block in `global.css` now. Proven by negative tests: published-without-date fails the
       build (*"publikovaná epizoda musí mít datum"*), published-with-date-but-empty produces no
       page and lists as "připravujeme". The first two attempts at that second test failed on a
       malformed fixture (YAML colon), which proves nothing — the fixture was fixed before the
       result was believed.
4. [x] D14 published (2026-11-13) — `/denik/ep-00/` ("Proč pětioska") plus `/denik/` index.
       Only episodes with `status: published` get a URL; planned ones are listed and unlinked,
       so no page exists that promises content. Episode copy cites only what the repo can prove.
4. [x] D13 built, half blocked (2026-11-13) — `/stroj` renders from `src/data/machine.ts`.
       Every row carries the artefact that proves it; right now that artefact is the owner's
       statement, so the page says so in its first paragraph. Photos (D5) and machine telemetry
       (D20) replace the `src` strings without touching the page.
4. [x] D4 built, done test blocked (2026-11-13) — `/zakazka` is the photo-first intake with no
       backend: it assembles the message and hands it to the sender's mail app. Nothing goes to
       a server. The draft is kept in the browser's `localStorage`, the page says so in plain
       words, and a „Vymazat“ button erases it (the copy was corrected on review 2026-11-13 —
       it had claimed the form stored nothing while saving a draft). **The done test cannot pass until D3b**,
       because "it arrives where you actually read" needs a readable inbox.
4. [x] D2 done (2026-11-13) — `src/content.config.ts` defines typed `parts` and `episodes`
       collections with every unknown fact nullable by type; `/dil/[slug]` renders a passport
       from data, `/dil` indexes them, and the homepage journal reads the collection. A new
       `.md` in `src/content/parts/` is a page and an index row with no code change.
5. [ ] Real facts still needed from the owner: machine envelope and real tolerance, actual
       part photos, price bands, `IČO`. **Machine identity is on record (2026-11-12):
       Wattsan 0404-mini, 2.2 kW spindle, stock RichAuto A11E DSP removed, LinuxCNC on
       Pi 5 + Flexi-HAL runs it** — envelope/tolerance stay `doplní se` until measured.
       **`IČO` is blocked on the Czech trade licence**
       (`PLAN.md` D11) — do not fill it in speculatively; the footer renders
       `IČO doplní se` on purpose.
6. [x] Old site archived at `/archiv` (§4): repo kept public, page records what
       survives and what is deliberately dropped.
7. [x] T1 done — `/nastroje` is live with the font→outline converter (`src/pages/nastroje.astro`,
       geometry in `src/lib/font-geometry.mjs`, verifier in `scripts/verify-font2dxf.mjs`).
       Built-in face is Liberation Sans (OFL), 402 KB, plus upload of any TTF/OTF. No CDN.
       Since 2026-11-11 the same page offers all 1958 Google Fonts families through
       `/api/font` (`netlify/functions/font.mjs`, no API key) — the browser asks us, we ask
       Google, and the TTF is cached in memory, in the Cache API and for a year on the CDN.
       Refresh the catalogue with `npm run fonts:catalog`.
8. [x] T2 done except PDF — `/nastroje/prevod` converts STL/OBJ/PLY/GLB and SVG ↔ DXF in
       and out, with no third-party library (`src/lib/mesh.mjs`, `src/lib/paths2d.mjs`),
       verified by `scripts/verify-mesh.mjs` and `scripts/verify-paths2d.mjs`. Files over
       40 MB are refused with a message instead of freezing the tab. Only PDF stays open,
       because it is a page rather than a path.
8. [ ] Recover access to `info@riplay.cz` (`PLAN.md` D3b) — the site's only contact path.
       Delivery is proven by probe; the inbox is unreadable until the owner logs in to OVH.
9. [ ] Before any outreach campaign: DMARC + DKIM, then a test send that passes (§9).
10. [x] `docs/research-slicer-fork.md` (2026-11-12) — fork research for the future
       `riplay-slicer` (PLAN D15–D18, D21): fork `Fractal-Cortex` (GPL-3.0 — closes the
       concept §10 license question toward GPL-3.0). **M0 started the same day:** fork at
       `~/Projects/riplay-slicer` (branch `riplay-spine`), headless `cli.py` slices a box
       to gcode. Scope decision in handoff §3: "slicer" is the public word, the build is a
       5-axis 3D printing solution. D2 is still the next content session.

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

## 9. Mail: what is proven, and what is not

`info@riplay.cz` is the site's only conversion path — the CTA is a `mailto:` with that
address. Probed from this machine on 2026-11-11:

- `mx0`/`mx1.mail.ovh.ca` answer `250 2.1.5 Ok` for `info@riplay.cz`
- a random address on the same domain answers `550 5.1.1 User unknown`

So the mailbox exists, the domain is not catch-all, and mail is being delivered. What is
**not** proven is access: nobody currently logs in, so the 24-hour reply promise in the CTA
cannot be kept until the owner recovers the OVH account. That is `PLAN.md` D3b, and it is a
gate, not a nicety — every other page is worthless if the one contact path is a dead inbox.

Hygiene for the planned outreach campaign: SPF is present; **DMARC is missing** and no DKIM
selector turned up among ten common names (selectors are arbitrary, so confirm in the OVH
manager before assuming it is off). Without both, cold mail from this domain is filtered
before a human sees it. Legally, Czech law (480/2004 Sb.) requires prior consent for
commercial e-mail, and the "existing customer" exception does not cover a scraped list —
not even B2B.

**Open decision (2026-11-13):** the homepage and `/zakazka` both promise a reply "do jednoho
pracovního dne" while nobody can read `info@riplay.cz`. That is the one claim on the site the
workshop cannot currently keep, so it is recorded here rather than quietly softened: either
D3b closes and the promise stands, or the copy changes to what is actually true until it does.
Not changed unilaterally, because it is the site's only conversion path and the owner may
recover access this week.
