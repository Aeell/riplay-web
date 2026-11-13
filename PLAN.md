# Riplay — 30 sessions, day by day

One "day" = one focused session (2–3 h), not one calendar day. Sessions are
sequential; if a session overruns, the next one slips rather than being skipped.
Every session ends with a **done test** you can check in ten seconds. A session that
does not pass its done test is not finished.

Legend: **[SHIP]** = something becomes publicly visible.

---

## Phase 0 — Foundation (D1–D4)

### D1 — Concept, design language, skeleton
Write the constitution (`docs/00-concept.md`), build the design system (graphite,
hairline grid, one accent, mono data), scaffold Astro, and prototype the Replay
scrubber with a **sample** part, clearly labelled as a sample.
**Done:** `npm run dev` shows a page that explains the project in five seconds.

### D2 — The content model ✅ done 2026-11-13
Typed collections: `parts` and `episodes`. Frontmatter schema covers what a passport
must contain (brief, material, machine, minutes, price band, stage assets, failures).
One part page renders entirely from data.

Shipped as `src/content.config.ts` (Astro content layer, glob loader, zod schema): every
unknown fact is **nullable by type**, so `doplní se` is enforced by the schema rather than
remembered by the author. `/dil/[slug]` renders the passport — facts, Replay driven by the
entry's own stages, failures, markdown body — and `/dil` indexes the collection. The
homepage journal now reads `episodes` instead of a hardcoded array, so announcing an
episode is a file too. `Replay` takes props with the sample as default, which is what lets
the same drawing serve a real part without a second component.
**Done:** dropping a new `.md` file into `src/content/parts/` produces a working page and an
index entry, with no code change — verified by building `/dil/vzorova-vlozka/` and `/dil/`
from the sample entry alone.

### D3 — Hosting and HTTPS **[SHIP]** ✅ done 2026-11-11

Netlify, git-linked to `Aeell/riplay-web`: a `git push` is the deploy. Why Netlify — the
free tier permits commercial use (Vercel Hobby forbids it, GitHub Pages terms exclude
business sites), and the apex needs only one `A` record, so the OVH nameservers and
DNSSEC stay where they are.

What the cutover actually was: `A riplay.cz → 75.2.60.5`, the `AAAA` deleted, `www` as a
`CNAME` to the Netlify site. The zone was **not** a parking zone — it carried five `MX`
records and an SPF record for OVH mail, which is why records were edited in place instead
of moving the nameservers. Let's Encrypt issued `CN=riplay.cz` covering `riplay.cz` and
`www.riplay.cz`; `www` and plain HTTP both 301 to `https://riplay.cz/`. Exact records,
the OVH form quirks and the certificate dates are in `docs/02-handoff.md` §2.

**Done:** `https://riplay.cz` serves this build over a valid certificate, no parking page.

#### D3 · amendment — Cloudflare Pages, drafted 2026-11-13 (not applied)

Netlify's deploys are paused on credits (15 per production deploy), so the move is drafted but
**deliberately not executed**: no account, no DNS change, no deploy. `docs/03-pages-migration.md`
is the reviewable plan; this entry is what lives in the repo.

- **Config:** `wrangler.toml` (project name, `pages_build_output_dir = "./dist"`, compatibility
  date, no bindings), `public/_headers` (netlify.toml's rules in Pages syntax), and the existing
  `public/_routes.json` + `functions/api/font.js` from the original kit.
- **Local test on the real runtime:** `wrangler` as a devDependency, `npm run preview:pages`
  (workerd, not a static server) and `npm run verify:pages` — 17 checks, all passing, including
  the Function bundled from source, the family guard, headers, the 308 to a canonical slash URL,
  and the sitemap/robots.
- **One regression caught by testing, fixed here:** Pages serves `200` + the homepage for every
  unknown URL unless the build has a top-level `404.html` (documented SPA fallback). That would
  have manufactured soft 404s right after D10. `src/pages/404.astro` now produces it, and the
  local test asserts both the status and the body.
- **The real decision is DNS, not config:** Pages cannot serve an apex without the zone's
  nameservers, so the move reverses D3's "one A record at OVH" trade-off. The runbook copies and
  diffs every record — five `MX`, SPF, and DKIM/DMARC *if the export shows them* — before any
  switch, with a Gate 0 (approve the draft), Gate 1 (approve the nameserver switch) and a
  documented rollback.

**Done (when it happens):** `https://riplay.cz` served by Pages over a valid certificate,
`verify:pages` green against the custom domain, mail proving delivery, and Rich Results +
Search Console finally runnable.

IPv4 verified; IPv6 unverified only because the laptop has no IPv6 route.

### D3b — The contact channel actually works **[gate]**

The site has exactly one conversion path: `mailto:info@riplay.cz` in the CTA. Probed
2026-11-11 against `mx0`/`mx1.mail.ovh.ca`: the address answers `250 2.1.5 Ok`, while a
random address on the same domain answers `550 5.1.1 User unknown` — the mailbox exists,
it is not a catch-all, and OVH delivers to it. **Delivery is not the problem; access is.**
Nobody can log in to read it today, which makes the CTA's "odpovídám do jednoho
pracovního dne" a promise the workshop cannot keep.

Owner-only, in this order:

1. Log in to the OVH account that owns `riplay.cz` → **Web Cloud → E-mail → riplay.cz**.
   If that login is also lost, recover it with the registrar address on file, or ask OVH
   support with proof of domain ownership (the domain's invoice is enough).
2. Confirm `info@riplay.cz` exists, reset the password, and look for a **forwarding rule**
   to an address that no longer exists — a stale forward eats incoming mail silently.
3. Send a message from a phone to `info@riplay.cz` and open it in OVH webmail.

**Done:** a message sent from outside arrives, is readable, and a reply sent from it lands
in an inbox the owner actually checks.

### D4 — Intake **[SHIP]** ⚠ built 2026-11-13, done test blocked by D3b
`/zakazka`: photo-first, no account. Realistic v1: the form assembles a pre-filled
WhatsApp/e-mail message with the photo attached by the sender — no backend, no
broken promise, works from a phone in a garage.

Built as a `mailto:` composer that says what it is: nothing is uploaded to any server, the
message is previewed live, and a copy button covers clients that truncate long `mailto:` URLs.
The draft survives a reload — and because it does, the copy names `localStorage` explicitly for
what it is, and a **Vymazat** button erases it. Storing something while claiming to store
nothing would have been a lie on the one page that asks strangers for their photos. WhatsApp is omitted rather than faked —
there is no published phone number, and inventing one would break the constitution. The
homepage CTA and the nav now point at the page instead of at an anchor.
**Photos, and the mail client that does not open (2026-11-13).** The page used to say "attach the
photos in the mail app" and leave it there. Three things now stand between a stranger and a lost
commission:

1. **The photos are compressed before anything else happens.** A picker takes up to 8 images,
   re-encodes each to JPEG at 1600 px on the long edge unless it is already small, and shows the
   before/after size — measured 1.2 MB → 80 kB and 1.4 MB → 82 kB on 3000×2000 test images.
   A file the browser cannot decode (HEIC is the usual one) is named as unreadable instead of
   silently dropped, and the total is shown against a 10 MB limit.
2. **One file to attach, not eight downloads.** The prepared photos are packed into a ZIP in the
   browser — store-only, no dependency, because the entries are already JPEGs. Verified as a real
   archive with `unzip -t` and Python's `zipfile` (CRC OK, PNG/JPEG bytes intact), not just by
   looking at the header.
3. **The fallback is a panel, not an apology.** A `mailto:` that opens nothing leaves the page
   focused; after 1.5 s the form reveals the address, the subject, the full message in a readonly
   box, copy buttons for the message and the address, and the photo download. It is also reachable
   on demand ("E-mail se neotevřel?"). When the clipboard itself is refused, the panel opens and
   the text is selected, so the fallback is Ctrl+C rather than an instruction to go looking.

What is still true: nothing is uploaded, the browser cannot attach files to a `mailto:`, and the
message can only leave from the sender's own mailbox.

**Done:** submit a test commission from a phone; it arrives where you actually read.
**Blocked:** the second half needs a readable inbox, which is D3b. The photo path and the manual
fallback are verified in a browser; the arrival is not, and cannot be until D3b.

---

## Phase 1 — Proof (D5–D12)

### D5 — Photography
One session, consistent light: parts on the bench, the machine, the mess, process
shots. Build the asset pipeline (AVIF/WebP, sizes, mandatory captions).
**Done:** 20 usable, captioned images in the repo.

### D6 — Part #1 passport **[SHIP]**
The first real object: brief → CAD → CAM → machine → result, with real minutes and
real money. Replace the sample in the hero.
**Done:** the hero replay is a real part with real numbers.

### D7 — Part #2: the rescue **[SHIP]**
A broken/missing OEM part reproduced. This is the highest-converting story for
ordinary customers — they have the same broken thing in their car.
**Done:** page published, linked from the homepage.

### D8 — Price page **[SHIP]**
Bands, not "contact us": minimum job, hourly CAM rate, material markup, lead times,
what is and is not included, warranty.
**Done:** a stranger can estimate their job without writing to you.

### D9 — Local discovery
The listing already exists (Google Maps and Mapy.cz both carry Mokrá 68, 460 01 Liberec),
so this session is **claim and align**, not create: ownership access, categories, hours,
the "made to order" description, photos, and the same facts as the site. The site links
to the listings and the listings link to the site — that mutual reference is what local
search actually reads.
**Done:** both listings claimed, facts identical to the site, cross-linked both ways.

### D10 — CZ search basics — **built 2026-11-13**, the done test needs a live site
Titles/headings/description per page, `LocalBusiness` + `Product`/`Service` schema,
sitemap, robots, canonical. Target real phrases ("3D tisk na zakázku", "frézování
hliníku", "náhradní díl do auta na míru").

**What shipped:**

- **Titles lead with what people type, not with the brand.** The home title is now
  "CNC frézování a 3D tisk na zakázku — Riplay"; the intake page targets "náhradní díl na míru";
  the three tools are titled by their query ("Písmo na DXF a SVG zdarma", "Převod STL na DXF a
  SVG ↔ DXF", "G-code viewer — náhled po vrstvách"). Every description is 70–170 characters and
  says what the page does, in the words the page itself uses.
- **Structured data built from the same facts the page shows** (`src/lib/seo.ts`): `LocalBusiness`
  with the real address, e-mail and an `OfferCatalog` of the three services; `WebSite`;
  `WebApplication` per free tool (price 0, because that is what the page says); `BlogPosting` per
  published episode. Fields the site does not have — phone, opening hours, IČO, prices, ratings —
  are **omitted by construction**: there is no code path that could invent them, and a check
  asserts they stay absent.
- **Sitemap** from `@astrojs/sitemap` with a `serialize` that appends the trailing slash the host
  actually serves, so it agrees with the canonicals instead of sending a crawler through a redirect
  per page. It enumerates built pages, so a new page cannot silently fall out of it.
- **`robots.txt`** allows everything (nothing here is hidden) and names the sitemap index.
- **Canonicals** already existed and were already right (they come from the URL that returns 200);
  `og:url` and `og:site_name` now sit beside them.

**Verification:** `npm run verify:seo` reads `dist/`, not the source — 69 checks: title presence,
length and uniqueness, description lengths, absolute slash-terminated canonicals, JSON-LD parsing
plus required fields per type, the no-invented-fields guarantee, sitemap ↔ built pages in both
directions, robots → sitemap. Proved able to fail: one title shortened in `dist` produced a FAIL,
and the file was restored.

**Not done, honestly blocked:** Google's Rich Results test and Search Console both need the public
URL, and production deploys are paused (credits). Until this build is live the claim is "valid
locally", not "passes Rich Results".

**Canonicals are now checked, and one was wrong.** `npm run verify:site` resolves every internal
reference in the build, including `<link rel="canonical">`. It found that `404.html` carried a
canonical pointing at `https://riplay.cz/404/` — a URL that does not exist, and a claim that the
page has an address when the whole point is that it does not. The layout now accepts
`canonical={null}` and the 404 uses it: no canonical, no `og:url`. Every other page keeps one, and
the check keeps it that way.

**Done:** Rich Results test passes; Search Console verified.

### D11 — First commission through the site **[BLOCKED until trade licence]**
Run one real job end to end via the site, and publish it as a passport with the
customer's permission.

**Hard gate:** paid work requires the trade licence. Until the licence is issued the site
may be built, published and read, and free-of-charge work for the portfolio may happen,
but no invoice. Concretely: nothing on the site may say OSVČ, IČO or "fakturuji" before
the extract lands in the trade register.

**The document has a three-month fuse.** The criminal-record extract (or equivalent from
the home country) must be **no more than 3 months old** when filed, and non-Czech
documents generally need a registered translator. So: the day the document arrives,
file — do not let it sit while the site gets polished. An expired extract means asking
the home country again, which is the slowest link in the whole chain.

**Done:** money received, passport published, intake proven in production.

### D12 — Ship gate 1
Lighthouse ≥ 95 mobile, accessibility pass, Czech copy proofread by a human.
**Done:** written verdict: is the site doing its job? Fix the worst thing found.

---

## Tools programme (T1–T3) — the toolbox, and who it is for

The tools are not a side quest and not a utilities directory. They exist for the two
people who arrive here without wanting to buy a milled part:

| Audience | What they arrive with | What a tool owes them |
|---|---|---|
| **Zákazník** — no CNC or 3D-printing vocabulary | a photo, a broken part, a file they cannot open | finishes one thing in under two minutes, no jargon, no sign-up |
| **Partner / maker** — speaks the language | DXF, STL, toolpaths, tolerances | a file they can actually cut or print, plus what the conversion cost them |

**Rule: every tool names the audience it serves.** A tool that serves neither stays in
`/archiv` with the reason written down. That is what keeps the toolbox a workshop instead
of a generic file-utilities site competing with a thousand clones.

Porting a tool means **rewriting it in the current visual language with its libraries
vendored into the repo** — no third-party CDN, no analytics — never copying the old page
across. One tool per session; the build must stay small.

### T1 — `/nastroje` + GoogleFont2SVG **[SHIP]** ✅ done 2026-11-11
Pick a font or drop in your own TTF/OTF, type text, get real outlines: SVG and DXF in
millimetres. Vendored OpenType.js only — the DXF is written by this repo (R12 POLYLINE,
`$INSUNITS = 4`), so there is no second geometry dependency and the scale is ours to check.
**All of Google Fonts, no key.** The old tool asked Google for fonts straight from the
browser; this one asks `riplay.cz`. `netlify/functions/font.mjs` fetches the `.ttf` — Google
serves TTF to a deliberately old user agent, so no woff2 decoder has to ship — and returns
it with a one-year cache, so the page still makes no third-party request and never hands a
visitor's IP to Google. The catalogue, all 1958 families in 82 KB, is generated by
`npm run fonts:catalog` and loaded on first touch. A chosen face is cached three ways
(memory, Cache API, HTTP + CDN for a year), so going back to a font you already tried is
instant instead of another round trip — the lag in the original was one round trip per
click. Liberation Sans (SIL OFL 1.1) stays as the offline fallback.

**Done:** measured, not eyeballed — `scripts/verify-font2dxf.mjs` proves cap height equals
the font's own metric (34.399 mm at a 50 mm em), width scales 1:1, extents in the DXF match
the computed bounds, and every contour is a closed POLYLINE.

### T2 — `/nastroje/prevod`, the 3D subset **[SHIP]** ✅ done 2026-11-11
The converter trimmed to what a workshop actually rescues. First slice, shipped: **STL, OBJ,
PLY and GLB in and out** — the four a partner or a slicer will hand you. Serves a partner
first ("this STL is wrong for my CAM"), a customer second ("open this file someone sent me").

**No third-party library and therefore no GPL-2.0 inheritance** — the old tool vendored
`p2r3/convert`, but four mesh formats are ~400 lines to read and write, so they live in
`src/lib/mesh.mjs`. That keeps the page at 11 KB of HTML with a small script and nothing
to licence.

**2D slice shipped too:** SVG ↔ DXF in millimetres (`src/lib/paths2d.mjs`). SVG paths are
parsed properly — all commands, curves flattened to 0.02 mm, arcs, group and element
transforms, `width`/`viewBox` converted to millimetres, `rect`/`circle`/`ellipse`/`line`/
`polygon`/`polyline`. DXF reads LINE, LWPOLYLINE, POLYLINE, VERTEX with bulges, ARC and
CIRCLE, honours `$INSUNITS`, and keeps open paths open on export. Still not done: **PDF** —
it is a page, not a path, and a raster trace would be a different claim.

Scale applies to 2D as well as 3D, and the page prints the resulting millimetres under the
button, so the number on screen is the number CAM will cut. The exported SVG canvas equals
the geometry (no padding), because a drawing that arrives 2 mm larger than the part is a
wrong part. Big files are refused at the door: over 40 MB the tool says so instead of
freezing the tab, before the bytes are even read, and every reader refuses more than
1.5 M triangles from the file's own header. PLY is read by property **name and type** from the header
(scanners put normals or colour first, some write doubles), and a type the reader does not
know is refused with its name rather than silently misread.

**Done:** measured, not eyeballed — `scripts/verify-mesh.mjs` sends a known 10 mm cube
through all four writers and readers and requires 12 triangles, 1000 mm³ and a 10 × 10 × 10
box back; also proves ASCII-STL detection, OBJ quad fan-triangulation, OBJ negative indices,
binary PLY read by name with double coordinates, GLB node transforms, scale (×2 → 8000 mm³),
unknown PLY types refused, oversized files refused, and broken files refused with a message
instead of guessed at. `scripts/verify-paths2d.mjs` does the same for 2D: viewBox → mm,
group transforms, curve tolerance against the real curve, arcs, DXF bulges, and open paths
staying open through a DXF round trip.

### T3 — The other three, judged by the rule ✅ decided 2026-11-13
Image compressor, PDF toolkit, QR studio: each either earns a page under the audience rule
or stays archived. Nothing ships because it already exists.

All three stay archived, each for a stated reason, and two of the three have their real
need served elsewhere instead of by a page: the image compressor's audience is the
customer with 12 MB phone photos, and the answer is intake guidance rather than a tool; the
QR studio's audience is the workshop itself, so a code belongs **on the printed delivery
note**, not as a public page. PDF remains the honest gap in `/nastroje/prevod`.
**Done:** one decision per tool recorded in `docs/02-handoff.md` §4, each with the
audience named.

Do not build `/nastroje` as a directory of links to archived pages. A tool appears there
only after it has been brought over.

---

## Phase 2 — The Build (D13–D22)

### D13 — `/stroj` **[SHIP]** ⚠ built 2026-11-13, half of the done test blocked
The machine as a page: **Wattsan 0404-mini, 2.2 kW spindle; stock RichAuto A11E DSP
removed — LinuxCNC on Pi 5 + Flexi-HAL runs it** (owner facts, 2026-11-12), what is
stock, what is retrofitted, what is broken. Config table is data, not prose.

Built from `src/data/machine.ts`: nine configuration rows, four changes (control,
kinematics, print head, chamber), and an explicit "what is not settled" list. Every row
carries a `src` string, so a claim without proof is visible as such — today they all read
"údaj majitele, 2026-11-12", and the page opens by saying that no photo or log exists yet.
Unknown envelope, tolerance and materials stay `null` and render `doplní se`.
**Done:** page published; every claim traceable to a photo or a log.
**Blocked:** the traces are still owner statements. D5 (photos) and D20 (telemetry) turn
them into artefacts; the data file is where that changes, not the page.

### D14 — Episode 0 **[SHIP]** ✅ done 2026-11-13
"Proč pětioska" — the retrofit story so far: what works, what failed, what it cost.

Published at `/denik/ep-00/`, with `/denik/` as the index. Written only from what the repo can
establish: the DSP's opacity as the reason for the swap, the missing LinuxCNC post-processor
(U instead of E, temperatures as M-codes, no G28 in-program), and the one unverified thing —
Flexi-HAL analog input for the thermistor and heater. Costs and hours are `doplní se`, because
an estimate here would be exactly the kind of number the site exists to refuse.
**Done:** episode published and linked from the homepage — verified: the homepage links EP 00
and leaves EP 01 unlinked until it exists; `/denik/` lists both and links only the published one.
**Note:** the summary on the homepage still says "co shořelo" from the earlier draft; the episode
body says what actually happened. Tighten that phrase when the next episode is written.

**Review (2026-11-13):** the routes were re-read with fresh eyes and three defects fixed — one
definition of a live episode shared by index and route (`isLive()`), a schema rule that makes a
published episode without a date a build failure, and one `.prose` block in `global.css` instead of
two divergent copies. The guarantee is now testable, and was tested by trying to break it.

### D15 — Slicer repo **[SHIP]** ⚠ prepared 2026-11-13, publishing is the owner's call
`riplay-slicer` public: README with an honest status line, license decision, short
architecture note, CI running the test suite. The repo **name** keeps the word "slicer"
(search term, the taunt); the README **defines** it as a 5-axis 3D printing solution —
see `docs/research-slicer-fork.md` §2 and concept §3.

Prepared in `~/Projects/riplay-slicer` (branch `riplay-spine`, local commit `ba42bbe`), not
pushed anywhere:

- **README rewritten** around an M0 status line — "it slices, and it has not printed anything on
  the real machine yet" — naming what it does and refusing what it does not (5-axis chunking, bead
  model, collision checking, a real print). Upstream's manual is preserved verbatim as
  `README.upstream.md`, so Fractal Cortex's attribution and its copyright survive the rewrite.
- **Six tests where there were none**: the bundled model slices headlessly, engine output carries
  `;Layer`/`;Shell`, extrusion lands on `U` with no `E` left, the dialect drops Klipper's header
  (`home_ab`, `Z_TILT_ADJUST`, `M84`), keeps `M104/M109/M140/M190`, has no `G28`, ends on `M2`,
  and the post alone maps a hand-written engine file. `6/6 OK` locally, ~2 min because it runs
  the real engine.
- **CI** (`.github/workflows/ci.yml`) runs that suite on Python 3.11 and 3.13.
- **`rtree` declared in `requirements.txt`**: trimesh imports it lazily at slice time, so a clean
  CI machine would have failed on the first run. Found by running the suite, not by reading.
- Tracked `__pycache__/*.pyc` removed, `.gitignore` added, empty `__init__.py` dropped.

**Done:** repo public, CI green, README does not overclaim.
**Remaining step is the owner's:** create the GitHub repo and push `riplay-spine`. Until then the
honest statement is "tests pass locally", not "CI is green" — no CI has run yet.

### D16 — Slicer spine
Mesh import + 2.5D slicing to a toolpath, CLI, tests on a known model. The spine is a
**headless driver over the forked engine**, not a slicer rewrite: `cli.py` slices a box
headless and the **LinuxCNC post is done** (2026-11-12, `post_linuxcnc.py`: header/footer
rewritten for LinuxCNC, extrusion mapped to the U axis letter — LinuxCNC has no E —
temps as user-defined M-code executables, no G28/homing in-program, ends with M2;
engine output untouched, regression-checked). Remaining for the done test: the gcode
printed on a real machine (bench: user-defined M-code files + U-joint config), and the
test suite on a known model.
**Done:** `riplay-slicer slice model.stl` produces gcode for a real print.

### D17 — Viewer — **done 2026-11-13**
Browser layer preview: scrub through layers, perimeters distinguished from infill.
`/nastroje/vrstvy` takes a `.gcode` in the browser (nothing uploaded), parses it with
`src/lib/gcode.mjs` and draws one layer at a time on a 2D canvas, with prev/next, a slider
and readouts for layer count, Z, paths, filament and footprint.

**Deviation from the plan, recorded:** the plan said Three.js. Three.js is ~600 KB before
the first line of my code, and the site may not use a CDN, so it would have been a half-
megabyte download to draw flat polylines. A 2D canvas draws the same picture at a few KB
and keeps the whole tool self-contained. A rotatable 3D view stays listed as a limit on
the page, not as a feature I claim.

**What a real file taught (this is the point of D17):** the synthetic test passed while the
reader was wrong in three ways that only a real slice could show.

- **z-hop invented layers.** The engine lifts Z between travel moves, so Z goes 0.3 → 0.6 →
  0.3 inside one layer. Layer-per-Z-change reported **51 365 layers** for a 445-layer print.
  Fixed by using the file's own `;Layer` markers when present (`;LAYER:` and `;LAYER_CHANGE`
  too), with rising-Z only as a documented fallback — and the page tells the user which
  source it used.
- **A leading `Z30` poisoned layer 1.** A layer's height is the lowest Z before its first
  toolpath, not the first or the highest: the hop to 0.6 comes before the first extrude, and
  the layer is still the 0.3 one.
- **The marker test was case-sensitive** (`Layer` but not `LAYER`), so the reader silently
  fell back to Z for files it should have read exactly.

After the fixes the reader reports **445 layers, z 0.30 → 133.50 mm, 31 762 mm of filament**
for `/tmp/pipe.gcode`, matching the engine's own 445 `;Layer` markers, and the browser draws
each layer (≈12 000 painted pixels on layer 1, ≈7 000 at 223).

**A demo that is not a lie:** the page used to open empty, which is a tool nobody tries. It now
ships `public/vrstvy/ukazka.gcode` (283 KB, 62 KB gzipped, loaded only on click): a 30 × 20 × 4 mm
plate with a Ø6 hole and a brim, 13 layers at 0.3 mm, sliced by our own engine —
`.venv/bin/python cli.py desticka.stl ukazka.gcode 0.3` in `~/Projects/riplay-slicer`, the STL made
with `trimesh.creation.box([30,20,4]).difference(cylinder(radius=3, height=20))`. The page says what
it is: real toolpaths, never printed, and written in Klipper's dialect — on LinuxCNC a post would
have to rewrite it first. A download link ships the same file.

**Arcs are curves, not chords.** G2/G3 used to be counted, admitted to, and then drawn as the
straight line between their endpoints — a chord where the file has an arc, which is the
millimetre-level lie the tool exists to avoid. They are tessellated now in the file's own plane
(G17/G18/G19) from I/J/K or R (R>0 the minor arc, R<0 the major one, start equal to end a full
circle), with the step angle chosen so that no chord strays more than `ARC_TOLERANCE_MM = 0.02 mm`
from the true arc — 70 segments for a Ø50 circle. The tolerance is a parser option, carried on
`stats.arcTolerance`, and stated on the page. G20 scales coordinates, arc centres and R to
millimetres and says so in the notes; out-of-plane arcs are computed in their plane and drawn as
the XY projection, a limit the page states rather than hides.

**The page shows the arcs, with their numbers.** The sliced sample contains no G2/G3, so the arc
drawing would have been invisible to anyone opening the tool. The page now has a second button and
ships `public/vrstvy/oblouky.gcode`: hand-written, two 0.3 mm layers, six arcs on stated circles
(r 10 and Ø 10 on layer 0, the same 0.5 mm smaller on layer 1, plus one quarter written as R), a
70 × 15 mm footprint, and no caveats from the reader. Its exact geometry — centres, radii,
direction, footprint — is written next to the buttons, and `verify:gcode` parses that shipped file
against the same numbers, so the page cannot go on describing a file that changed.

**Verification:** `scripts/verify-gcode.mjs` — 61 checks (`npm run verify:gcode`), including
the three failures above and the arc geometry as regression tests. Browser check on `127.0.0.1:4331`: a 21 MB,
531 893-line file loads in ~2 s, scrubs 1 → 223 → 224, draws, and reports 108.36 × 68.78 mm.
**Not** verified against PrusaSlicer/Cura output, and not live — Netlify deploys are paused
(§5 of the handoff).
**Done:** a real sliced model is scrubbable in the browser.

### D18 — One engine, two uses — **done 2026-11-13**
Point the site's Replay at the slicer viewer for a printed part.

**What now happens:** `src/lib/layer-draw.mjs` is one renderer (fit, flip Y, paint infill under
perimeters) used by both `/nastroje/vrstvy` and the Replay's print stage. The homepage print stage
used to be 27 hand-drawn horizontal lines — a picture of a print, not a print. It now paints real
toolpaths: `scripts/build-replay-sample.mjs` (`npm run sample:replay`) slices-with-the-reader a
real `.gcode` and writes `/vrstvy/vzor.json` — 8 of 445 layers, decimated to 0.6 mm, rounded to
0.1 mm, **16 KB gzipped, fetched only when someone opens the print stage**. The homepage itself
did not grow: 6.4 KB of HTML and a 1.1 KB script.

The stage builds the part layer by layer from those paths, and says under itself what it is:
"dráhy z opravdového řezu · 8 vrstev, zjednodušeno". With `prefers-reduced-motion` it draws the
finished stack instead of animating. If the fetch fails the note says so rather than showing an
empty stage that reads as a finished drawing.

**What is honestly missing:** the plan wants the Replay pointed at a **printed** part. Nothing has
been printed on the real machine yet (D16), so the homepage still shows the sample and still
carries the sample badge. When D16 lands: regenerate the JSON from that part's gcode
(`npm run sample:replay -- <file> <layers> <step>`), point the part page at it, and drop the
sample badge there.

**The component, not just the renderer (same day).** `src/components/ToolpathViewer.astro` plus
`src/lib/toolpath-viewer.ts` is one `<toolpath-viewer>` element that owns the canvas, the scrubber
(slider, layer label, prev/next) and the print animation. The two pages now contain no drawing
code at all: the toolbox hands it a parsed file and listens for `layerchange`; the Replay hands it
the reduced sample and calls `play()`. What differs between the pages is only which chrome they
show — the element takes `controls` or `stack`. Cost: the homepage went from 6.4 to 8.9 KB gzipped
because the element is inlined there, and the separate 1.1 KB Replay chunk disappeared.

**Still missing (not the component's job):** the Replay still shows the sample, because nothing has
been printed on the real machine (D16). When it is: `npm run sample:replay -- <file> <layers>
<step>`, point the part page at it, drop the sample badge there.

**Done:** the homepage replay and the slicer preview draw with the same renderer.

### D19 — Episode 1 **[SHIP]**
First hardware milestone (4th/5th axis motion on the bench). Film it, publish it,
include what did not work.
**Done:** episode published with video and a dated config change.

### D20 — Telemetry
Pi 5 agent → tiny endpoint → `/stroj` shows last job, state, uptime, with an honest
"offline" state. No fake liveness.
**Done:** machine page reflects reality; unplugging the Pi shows it as offline.

### D21 — Episode 2 **[SHIP]**
CAM for a genuinely 5-axis part; publish the toolpath replay.
**Done:** episode published; replay runs on the site.

### D22 — Ship gate 2
Slicer 0.1 with a demo file, three episodes live. Distribution: r/CNC, r/3Dprinting,
r/functionalprint, Hackaday tip, Czech maker groups.
**Done:** published, and the inbound traffic is measured.

---

## Phase 3 — Business plumbing (D23–D27)

### D23 — Paperwork
Quote template, order confirmation, delivery note, warranty terms (24 months for
consumers), complaint process. Get the CZ consumer-law details right.
**Done:** templates exist and are used on the next job.

### D24 — Invoicing
Fakturoid/iDoklad, QR payment, VAT status confirmed, expense capture.
**Done:** a real invoice issued from the template in under five minutes.

### D25 — Privacy and tracking
GDPR page for the photo intake, retention rule, no third-party trackers by default
(Plausible or nothing). Cookie-free.
**Done:** privacy page published and linked from every form.

### D26 — The real numbers
Fill the capability table: envelope, tolerances, materials, finishes, throughput.
Replace every placeholder chip on the site.
**Done:** zero "doplní se" markers left.

### D27 — Measurement
Analytics goals on intake, Search Console queries, a weekly one-line log of
inbound. Decide what "working" means numerically.
**Done:** dashboard answers: visits → intakes → jobs.

---

## Phase 4 — Launch (D28–D30)

### D28 — English build log
English renderings of episodes + slicer docs. Audience language, not a machine
translation.
**Done:** an English reader can follow the build without Czech.

### D29 — Launch **[SHIP]**
One announcement post that tells the truth about what this is, then distribution:
Czech maker groups, Reddit, HN (Show HN for the slicer), LinkedIn, local.
**Done:** launched, with a single canonical link.

### D30 — Retro
What brought work, what brought noise. Write the next 30 sessions.
**Done:** a written decision on what to double down on and what to kill.

---

## Outreach — before you e-mail anyone

The owner intends to approach workshops, businesses and possible sponsors or investors.
Three things must be true before the first message leaves, and two of them are technical:

1. **The address is reachable** (D3b). An outreach campaign sent from a mailbox nobody
   reads is the worst first impression available.
2. **The domain authenticates its mail.** Today SPF is present, **DMARC is absent**, and no
   DKIM selector was found under ten common names — selectors are arbitrary, so confirm in
   the OVH manager. DMARC (`p=none` first, then `quarantine`) plus DKIM is what keeps the
   first campaign out of spam folders, and cold mail from an unauthenticated domain is
   filtered before anyone reads it.
3. **The list is lawful.** Czech law (480/2004 Sb.) requires prior consent for commercial
   e-mail; the narrow "existing customer" exception does not cover a scraped list, not even
   to businesses. So: no bought or scraped lists. Approach named workshops with a message
   about their actual work, expect to follow up by phone, and count replies, not sends.

**Done (O1):** SPF, DKIM and DMARC all pass on a test send.
**Done (O2):** ten named targets contacted individually, replies logged, no purchased list.

---

## Review log

Reviews are recorded here with what they found, because a review that only says "looks good"
is worth nothing, and a defect found is more useful than a defect avoided.

**2026-11-13 · D18 follow-up (the viewer's edges).** Two things the previous passes missed:

1. **The Replay announced its drawing twice.** The SVG has its own `<title>`/`<desc>`, and the
   canvas laid over it carried `role="img"` with its own label, so a screen reader described the
   same picture twice, the second time without meaning. The viewer now takes `decorative`, which
   removes the canvas from the accessibility tree entirely; the toolbox viewer still names itself
   because it is the only thing on that page. Verified in the live DOM: the Replay exposes exactly
   one image, the SVG, with its own title. `decorative` is the right shape for it — it means "no
   information of its own", the same thing `alt=""` means, and the Replay still tells a screen
   reader about the print through its visible note ("dráhy z opravdového řezu · N vrstev"), so
   nothing is lost by hiding the canvas. The hint line follows the same flag, since a hint for a
   decorative drawing would be the same duplicate.
2. **The step buttons were always enabled**, so "← předchozí" on layer 1 and "další →" on the
   last layer were dead targets that still took focus and a click. The first fix used `disabled`,
   which introduced a second defect the next review caught: a button disabled while focused is
   dropped from the tab order, focus falls to `<body>`, and a keyboard user who steps to the last
   layer loses their place. The buttons now carry `aria-disabled` and stay focusable, the handlers
   ignore a press that cannot move (so it does not even fire `layerchange`), and one rule styles
   both `:disabled` and `[aria-disabled='true']`. `markEnds()` is the only place that decides,
   called from `show()` and from `clear()` — so a single-layer file ends with both ends
   unavailable and a cleared viewer cannot keep the previous file's state. Verified in the browser:
   at 13/13 focus is still on "další", a dead press fires 0 events, 1/1 marks both, clear marks
   both and hides the bar, and reloading a file puts the ends back.

**2026-11-13 · D17 + D18 (viewer, shared renderer).** Found by running the code against a real
sliced file, then re-reading it, not by reading alone:

1. **z-hop became layers.** Z oscillates 0.3 → 0.6 → 0.3 inside one layer; treating every Z change
   as a layer turned a 445-layer print into 51 365 "layers". Layer boundaries now come from the
   file's own markers, with rising Z only as a fallback that the page admits to.
2. **A leading `Z30` set layer 1's height** (and left it with no paths). A layer is as tall as the
   lowest Z before its first toolpath; empty layers are dropped.
3. **The marker regex was case-sensitive**, so uppercase `;LAYER` silently fell back to the
   approximate path.
4. **Every path lost its first segment**, and a path of one move disappeared entirely — paths
   started at the move's *destination*. Found while writing D18's fixtures, fixed in the parser.
5. **`pathBounds(layers)` instead of `pathBounds(paths)`** — the print stage painted nothing, and
   the error handler then overwrote a true "loaded" note with "could not load". Both fixed; a
   later paint error can no longer falsify the note.
6. **The sample note described the canvas but showed on every stage**, so it captioned the CAD
   sketch as toolpaths. It is now tied to the print stage in CSS.
7. **Millimetres were rounded away** in the readout (108.36 mm printed as "108").
8. **The line ceiling (400 000) was below the file ceiling (40 MB)**, so the workshop's own output
   was refused as "truncated". Raised to 1 000 000 lines: what the tool accepts, it reads whole.

Every one of 1–5 and 7 has a test now: `npm run verify:gcode` — 20 checks.

**2026-11-13 · second pass, the G-code reader (fresh eyes, same day).** Read as if someone else
had written it. Six things were silently wrong and two were dead weight:

1. **G91 was half implemented.** The page said the reader "counts with absolute" while the code
   applied relative X/Y and absolute Z. G90/G91 now work on every axis, and the warning is gone
   because there is nothing left to warn about.
2. **M83 was ignored** along with every other M-code, so a Prusa/Orca-style file reported far too
   little filament. M82/M83 are handled; switching back to absolute re-establishes the counter
   from the first value rather than comparing against a stale one.
3. **G92 was ignored.** After a reset or a tool change the next absolute E was measured from a
   stale total, adding a huge bogus figure to the filament. Position and counters are now reset.
4. **Retraction was counted as filament** (`Math.abs` of a negative delta) and drawn as a
   toolpath — a line where the machine laid nothing, plus every retract/unretract pair counted
   twice. Only a positive deposit draws and counts now; retracts, unretracts and hops are travel.
5. **Multiple extruders.** A tool change re-establishes the counter, but the *first* `T` is not a
   change: a leading `T0` is how single-extruder files open, and treating it as a change dropped
   the first move of the print.
6. **U was always filament**, so a file using U as a real fourth axis had axis travel counted as
   filament. U is filament only when the file writes no E.
7. **Dead bookkeeping cut:** `moves`, `travelMoves`, `perimeterPaths`, `infillPaths` were counted,
   never shown, and only kept alive by the verifier. The checks now assert the behaviour through
   paths and their kinds.
8. **Page cut:** three branches for the caveat became one `caveatOf()`, three DOM lookups per layer
   update became one `setText()`, the G91 row left "Co to neumí", and the prose now states what
   the code does (G90/G91, M82/M83, G92, retractions excluded).

Still approximate, and said so on the page: arcs draw as their endpoint, nothing is simulated, and
a file without layer markers gets layer boundaries guessed from Z.

**2026-11-13 · D18, extracting the shared component.** Three defects, each caught by building or
looking rather than by reading:

1. **The build broke** importing the custom-element module from the component's frontmatter: Astro
   prerendered it in Node, where `customElements` does not exist. Registration moved to a client
   script, and the module now guards for environments without it.
2. **The overlay canvas measured 279 px inside a 364 px frame.** The component's grid row sized
   itself to its content instead of the box it was covering. It is absolutely positioned inside
   the drawn area now — measured 558 × 364 against the SVG's 558 × 364.
3. **Rewriting the page silently dropped its `.field`/`.readout` styles**, which had only ever
   lived in that page. They are back, expressed in the project's tokens, so the file input and the
   readout read as designed again.

Behaviour was checked afterwards, not assumed: the demo still loads 13 layers with 74 → 57 paths
per layer and ~37 000 painted pixels, the Replay still reaches 8 layers, index advancing, ~46 000
painted pixels, and the part page's Replay behaves the same as the homepage's.

**2026-11-13 · third pass, the component itself.** Read `<toolpath-viewer>`, the toolbox page and
the Replay as one system. Five edge cases and one regression:

1. **An empty layer set left a lie on screen.** A file with no toolpaths kept the previous drawing
   while the bar said "vrstva —". An empty set now clears the canvas, restores the hint, hides the
   scrubber — and the page hides the readout that belonged to the other file.
2. **`show(NaN)` threw** (`layers[NaN]` is undefined). Non-finite input is clamped to the first
   layer now.
3. **`data-interval` of `""` or `0` meant a 0 ms interval** — a tight loop through every layer. It
   is floored at 60 ms with a sane default.
4. **A window resize listener was the wrong tool.** This element is sized by the layout around it
   (a grid column, or laid over the Replay's drawing), so it now observes itself; after a viewport
   change on the homepage the canvas measured 743 × 485 against the SVG's 743 × 485.
5. **`next()`/`prev()` were public API that nothing called** — the buttons use `show()` directly.
   Removed, so the element exposes `setLayers`, `show`, `play`, `stop` and one event.
6. **Regression from the earlier rewrite:** `.btn-quiet` had only ever been defined per page, so
   the demo button silently lost its quiet styling when that page was rewritten. It is one rule in
   `global.css` now, shared by the toolbox, the viewer and the font tool.

Re-entry was checked rather than assumed: the Replay loads nothing until the print stage is
opened, stops stepping when the stage is left, and starts the build over when it is opened again.

**What this review did not cover:** every browser check ran in a hidden preview tab
(`visibilityState: hidden`), where CSS transitions and timers are throttled. The print stack was
verified by painted pixels (51 904) and the note text, not by watching the animation play on a
visible screen; that is the owner's check. Nothing was verified against PrusaSlicer or Cura
output, and nothing is live — deploys are paused.

**2026-11-13 · D17 arcs (G2/G3 as curves, G20, G18/G19).** The reader counted arcs and then drew
the straight line between their endpoints: on screen the tool went somewhere the file never sent
it. G2/G3 are now tessellated from I/J/K or R in the file's own plane, with a stated chord
tolerance of 0.02 mm, and the page's limit list changed with the behaviour. 31 new checks compare
the drawn polyline against known circles — quarter arc, full circle, R minor and major, inches,
and both out-of-plane planes — including a sagitta measured over every chord rather than trusting
the formula that produced the points. Four of those checks failed on the first run; all four were
my test expectations (a 90° arc sampled at 14 points cannot have one exactly at 45°; R5 on a
chord of 10 is a semicircle, where the sign of R selects no side), not the parser, and the
expectations were corrected to the geometry.
**Not verified:** a real arc-heavy CAM file — our engine's slices contain no G2/G3 — so the
geometry is proven against hand-written files with known numbers, not against a machine's output.

**Review of that change, same day.** Four defects, all fixed: the arc's endpoint was computed twice
— once inside the arc block, once for the path that follows it — from two copies of the same
absolute/relative expressions, so a later change to one would have parted the curve from the path
(one `nx`/`ny` now feeds both); the 4096-segment ceiling could break the 0.02 mm promise silently,
and `tolerance: 0` made `stats` report a tolerance it never used (the value is validated, and when
the ceiling is hit the note states the deviation actually drawn); the plane mapping existed twice,
in `PLANES` and in hand-written ternaries, which is how axes get swapped (`PLANES` is the only
source and both directions read it); and G92 under G91 both set the position and moved from it, a
pre-existing bug found next door. Six new checks pin the relative-arc endpoint, both unusable-R
messages, the ceiling's disclosure, the tolerance fallback and G92.

## Dependencies and risks

| Risk | Effect | Mitigation |
|---|---|---|
| No real parts to publish | Phase 1 stalls immediately | D6/D7 use anything already made; a paid job is not required for a passport |
| Photography is the bottleneck | Replay looks empty | D5 is a hard gate; shoot everything, keep it ugly-but-real |
| Domain/DNS access at OVH | No public site | D3; keep registrar, edit records only |
| **Domain expires 2027-02-13** | The whole project loses its name mid-build | Enable auto-renew now and set a calendar reminder for 2027-01-13; do this before any code |
| Scope creep into a slicer startup | Business earns nothing | Slicer work is capped to Phase 2 sessions; customers first |
| The Replay becomes decoration | Site becomes a normal portfolio | Every stage must carry real data or it does not ship |
| The toolbox turns into a generic file-utilities site | Dilutes the single idea and competes with clones | The audience rule in the Tools programme: no tool ships without a named audience |

## What is needed from the owner (blocking, in order)

1. **Photos** of anything already made + the machine (blocks D2, D5, D6).
2. **Legal identity**: trade licence (in progress — see D11), then IČO, VAT status,
   trading name. Address is settled: Mokrá 68, 460 01 Liberec – Machnín.
3. **Contact channel** you actually answer, and the hours you answer it.
4. **Machine facts**: envelope, spindle, achievable tolerance, materials.
5. **Price bands** you are willing to publish.
6. **Host decision** (D3) and access to the OVH DNS panel.
