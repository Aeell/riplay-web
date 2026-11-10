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

### D3 — Hosting and HTTPS **[SHIP]**
**Host chosen 2026-11-10: Netlify — deployed and verified, DNS still pending**
(`docs/02-handoff.md` §1–2). Netlify rather than Cloudflare Pages, Vercel or GitHub
Pages: the free tier permits commercial use (Vercel Hobby forbids it, GitHub Pages
terms exclude business sites), and the apex needs only one `A` record, so the OVH
nameservers and DNSSEC stay untouched (Cloudflare Pages would want the nameservers
moved). The OVH VPS of the old site is gone and not returning, so this is static
hosting with no runtime and no bill.

Remaining in this session: point `riplay.cz` at Netlify, retire the OVH parking page,
get a valid certificate covering the name.

Known state of the domain (from the OVH export, 2026-11-10): registrar OVH, DNS on OVH
anycast nameservers, **DNSSEC enabled**, `riplay.cz` and `www` both currently resolve to
OVH shared hosting (A `51.161.122.78`, AAAA `2001:41d0:701:1100::b909`) which serves the
parking page and a certificate that does not cover the name.

So: keep the registrar at OVH, and only replace the `A`/`AAAA` (or `CNAME` for `www`)
records — do not move the nameservers, because that drags DNSSEC (DS records) along with
it and can black out the domain while the chain is rebuilt. If the host later needs
Cloudflare DNS, do that as a separate planned step with DNSSEC disabled first at OVH.

**Done:** `https://riplay.cz` serves our build with a valid cert and no parking page.

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
architecture note, CI running the test suite.
**Done:** repo public, CI green, README does not overclaim.

### D16 — Slicer spine
Mesh import + 2.5D slicing to a toolpath, CLI, tests on a known model.
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

## Dependencies and risks

| Risk | Effect | Mitigation |
|---|---|---|
| No real parts to publish | Phase 1 stalls immediately | D6/D7 use anything already made; a paid job is not required for a passport |
| Photography is the bottleneck | Replay looks empty | D5 is a hard gate; shoot everything, keep it ugly-but-real |
| Domain/DNS access at OVH | No public site | D3; keep registrar, edit records only |
| **Domain expires 2027-02-13** | The whole project loses its name mid-build | Enable auto-renew now and set a calendar reminder for 2027-01-13; do this before any code |
| Scope creep into a slicer startup | Business earns nothing | Slicer work is capped to Phase 2 sessions; customers first |
| The Replay becomes decoration | Site becomes a normal portfolio | Every stage must carry real data or it does not ship |

## What is needed from the owner (blocking, in order)

1. **Photos** of anything already made + the machine (blocks D2, D5, D6).
2. **Legal identity**: trade licence (in progress — see D11), then IČO, VAT status,
   trading name. Address is settled: Mokrá 68, 460 01 Liberec – Machnín.
3. **Contact channel** you actually answer, and the hours you answer it.
4. **Machine facts**: envelope, spindle, achievable tolerance, materials.
5. **Price bands** you are willing to publish.
6. **Host decision** (D3) and access to the OVH DNS panel.
