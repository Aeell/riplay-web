# Riplay — what this site is

**Status:** definition v0.1, 2026-11-10
**Domain:** riplay.cz — registered 2026-02-13 at OVH, **expires 2027-02-13**, DNS on OVH
anycast (`dns200/ns200.anycast.me`), DNSSEC enabled. Live on Netlify since 2026-11-11
with a Let's Encrypt certificate covering the apex and `www`. The mail records in the
same zone are why the nameservers stay at OVH — see `docs/02-handoff.md` §2.
**Owner:** one person, workshop at Mokrá 68, Liberec – Machnín. **Trade licence not yet
issued** (EU national, awaiting a criminal-record extract from the home country), so no
page may claim OSVČ status, and no page may be published in a state that implies it.
**Working tagline:** *Dílna, kterou si můžeš přehrát.* — A workshop you can replay.

---

## 1. The one sentence

Riplay is a public one-person precision workshop: it sells CAD, CNC milling, precise
parts and 3D-printed assemblies to ordinary people, and it shows the entire making of
every object as a replay — which is the same engine that powers the open-source 5-axis
slicer being built in the same workshop.

## 2. Why this is not a normal site

Normal freelance-workshop sites are: a grid of pretty photos, three "our services"
cards, a stock photo of a laptop, and "kontaktujte nás pro cenovou nabídku". They show
*results* and hide *work*. They are unfalsifiable.

This site does the opposite. The unit of content is not a project photo, it is a
**part passport**: a permanent, structured, timestamped page per object containing the
brief, the CAD, the CAM, the machine, the time, the cost, the failure, the result —
and a **Replay** scrubber that moves the object through those stages.

Consequences that make it structurally different:

- There is no "portfolio" page, because every part is already a page.
- There is no blog feed, because the build log is a *serialised record of a machine's
  state*, and each episode is dated against the machine config that existed that day.
- There is no e-shop, because nothing is in stock. Every object is made after it is
  asked for.
- The site is open source. The slicer is open source. A competitor can copy all of it.
  That is the intended moat: being the workshop that hides nothing.

## 3. The Replay (the signature mechanic)

One interaction, used everywhere: a scrubber across the life of an object.

```
ZADÁNÍ → CAD → CAM → STROJ → MONTAŽ → HOTOVO
```

Each stage carries real data: who asked, what it had to fit, the file, the toolpath,
the machine, minutes, material cost, price, and what went wrong. Dragging the
scrubber changes the drawing, the toolpath, the tool position, the material state
and the numbers together.

The same component later renders slicer output: layers, perimeters, supports,
5-axis tool orientation. **The website's signature visual and the slicer's preview
are one codebase.** That is the convergence worth building around; it is why the
slicer is not a distraction from the business but its content engine.

## 4. Three audiences, three paths

| Audience | Arrives with | Needs | Path |
|---|---|---|---|
| **Zákazník** — ordinary person, CZ, non-technical | a cracked trim, a missing clip, a console that should charge a phone | proof you can do it, a price, a date, a warranty | photo → 24 h reply → part passport → part |
| **Maker / hobbyist** — global, technical | curiosity about the 5-axis retrofit and the open slicer | honesty, source, detail, progress | episode → GitHub → follows the build |
| **Small company / prototyper** | a one-off bracket, a jig, a short run | tolerances, materials, envelope, reliability | capabilities → quote → repeat work |

The first audience pays the bills. The second creates reach and credibility. The third
is the upside. Every page must be useful to at least one of them and must not be
written as if it is for all three.

The toolbox (`/nastroje`) is the one surface built for the **first two only**: someone
who will never buy a milled part must finish one small task in two minutes, and a maker
must get a file they can cut. A tool that serves neither audience stays in `/archiv`.

## 5. The constitution (non-negotiable rules)

1. **Nothing unreal.** No stock photos, no invented reviews, no "we" when it is one
   person. If a number is unknown, the page shows that it is unknown rather than a
   plausible guess.
2. **Every claim links to the artefact that proves it** — a passport, an episode, a
   file, a timestamp.
3. **Every part is replayable.** If it cannot be replayed, it is not published.
4. **Failures are published.** Scrapped parts, missed dates, wrong toolpaths. Trust
   comes from the failures being visible, not hidden.
5. **Prices and dates are stated** as bands, not withheld behind a form.
6. **Open by default.** Site source, slicer source, machine documentation.
7. **Czech is the customer language, English is the audience language.** One content
   model, two renderings; Czech is never a translation afterthought.
8. **The site is a timestamped snapshot of a workshop**, not a timeless brochure.
   Every page says *stav k &lt;datum&gt;*.

## 6. What we are explicitly not building

- an e-shop with a cart (no stock, no warehouse)
- a stock-photo agency landing page with "Naše služby" cards
- a generic MDX blog with 300 SEO articles
- a community / course / newsletter-first content machine
- a customer portal with logins (until there is a reason)
- a template that could belong to any workshop in any country

## 7. Page inventory (v1)

| Route | What it is | Primary audience |
|---|---|---|
| `/` | the replay hero, what the shop can actually do, what is on the bench now | all |
| `/dil/<slug>` | part passport: replay + data + story + price | zákazník |
| `/zakazka` | commission intake, photo-first, no account | zákazník |
| `/cena` | honest price bands, lead times, what is included | zákazník |
| `/denik/<ep>` | build episode, dated against machine config | maker |
| `/stroj` | the machine: config table, current state, jobs | maker |
| `/o` | the person, the bench, the IČO — no resume prose | all |
| `/archiv` | the previous site as a record: what it was, what survives of it | maker |
| `/nastroje` | the toolbox: tools that finish one thing, for a customer or a partner | both |

## 8. Technical shape

- **Static by default.** Astro, zero client JS except where it earns its place (the
  Replay, the intake form). Portable: any static host, no runtime lock-in.
- **Content lives in git**, typed with a schema (`src/content/parts`, `.../episodes`).
  A new part is a commit. That is what makes the passport a guarantee and not a
  promise, and it means the whole workshop history is forkable.
- **No stock imagery, ever.** Every asset has a caption saying where it came from
  (phone camera, CAD screenshot, machine log).
- **Design language:** technical drawing, not marketing. Hairline grid, dimension
  lines, sheet numbers, monospaced data, one safety-orange accent, graphite ground.
  If a layout choice would look at home on a SaaS site, it is wrong.
- **Performance budget:** LCP under 1.5 s on a mid-range phone, no webfonts blocking
  text, images as AVIF/WebP.
- **Hosting:** Netlify, git-linked — a push is a deploy (D3). Static output, no runtime;
  the build stays portable so the host can change without touching content.

## 9. Known unknowns (must be filled, and the site shows them unfilled)

- legal identity: trading name, IČO, DIČ/VAT status. The registrant is a natural person
  with a **residential** Liberec address; whether that address is published in the footer
  (an OSVČ must state name, address and IČO) or a business address is used instead is an
  open decision, not a detail to guess at.
- real machine envelope, achievable tolerances, materials actually cut/printed
- price bands and realistic lead times
- contact channel the owner actually answers (phone? WhatsApp? e-mail?) — as of
  2026-11-11 `info@riplay.cz` **receives** mail but nobody can log in to it; `PLAN.md`
  D3b is the gate that closes this
- whether the workshop is at home or a rented space (affects "visit by appointment")
- photography: none exists yet; the passports are blocked on real photos

## 10. Open questions to settle later, deliberately not now

- GPL-3.0 vs AGPL-3.0 for the slicer
- whether to accept card payments or invoice only
- English launch timing for the build log
- whether `/stroj` gets a live camera feed (privacy + power cost) or only telemetry
