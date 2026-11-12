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

### D2 — The content model
Typed collections: `parts` and `episodes`. Frontmatter schema covers what a passport
must contain (brief, material, machine, minutes, price band, stage assets, failures).
One part page renders entirely from data.
**Done:** dropping a new `.mdx` file into `parts/` produces a working page and an
index entry, with no code change.

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

### D4 — Intake **[SHIP]**
`/zakazka`: photo-first, no account. Realistic v1: the form assembles a pre-filled
WhatsApp/e-mail message with the photo attached by the sender — no backend, no
broken promise, works from a phone in a garage.
**Done:** submit a test commission from a phone; it arrives where you actually read.

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

### D10 — CZ search basics
Titles/headings/description per page, `LocalBusiness` + `Product`/`Service` schema,
sitemap, robots, canonical. Target real phrases ("3D tisk na zakázku", "frézování
hliníku", "náhradní díl do auta na míru").
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

Big files are refused at the door: over 40 MB the tool says so instead of freezing the tab,
before the bytes are even read. PLY is read by property **name and type** from the header
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

### T3 — The other three, judged by the rule
Image compressor, PDF toolkit, QR studio: each either earns a page under the audience rule
or stays archived. Nothing ships because it already exists.
**Done:** one decision per tool recorded in `docs/02-handoff.md` §4, each with the
audience named.

Do not build `/nastroje` as a directory of links to archived pages. A tool appears there
only after it has been brought over.

---

## Phase 2 — The Build (D13–D22)

### D13 — `/stroj` **[SHIP]**
The machine as a page: Pi 5, FlexiHAL, RichAuto DSP11 router, what is stock, what is
retrofitted, what is broken. Config table is data, not prose.
**Done:** page published; every claim traceable to a photo or a log.

### D14 — Episode 0 **[SHIP]**
"Proč pětioska" — the retrofit story so far: what works, what failed, what it cost.
**Done:** episode published and linked from the homepage.

### D15 — Slicer repo **[SHIP]**
`riplay-slicer` public: README with an honest status line, license decision, short
architecture note, CI running the test suite. The repo **name** keeps the word "slicer"
(search term, the taunt); the README **defines** it as a 5-axis 3D printing solution —
see `docs/research-slicer-fork.md` §2 and concept §3.
**Done:** repo public, CI green, README does not overclaim.

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

### D17 — Viewer
Browser layer preview (Three.js): scrub through layers, highlight perimeters.
**Done:** a real sliced model is scrubbable in the browser.

### D18 — One engine, two uses
Point the site's Replay at the slicer viewer for a printed part.
**Done:** the homepage replay and the slicer preview share the viewer component.

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
