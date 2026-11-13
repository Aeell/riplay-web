# Moving riplay.cz from Netlify to Cloudflare Pages — draft for review

**Status: drafted 2026-11-13. Nothing deployed, no account created, no DNS record touched.**
This document plus the files it names are the whole proposal. Approving it is Gate 0 below;
nothing in this repository deploys on its own.

The site is a static `dist/` plus exactly one Function (the font proxy). Netlify hosts it today
(site `f3abf7bc-b006-4cc4-a72a-8e3832df1c2d`), and its production deploys are paused on credits
(15 credits each, 300/month). Cloudflare Pages charges no deploy credits at all. That is the
whole reason for the move; nothing about the site changes.

## 1. What is already in the repo

| File | What it is |
|---|---|
| `wrangler.toml` | The Pages project: `name = "riplay"`, `pages_build_output_dir = "./dist"`, compatibility date. No bindings, no `nodejs_compat` |
| `functions/api/font.js` | The Pages Function — three lines around `src/lib/font-proxy.mjs`, which was written to run on both hosts |
| `public/_routes.json` | `{"include": ["/api/*"]}` — page views never invoke a Function, so they cost nothing and cannot break |
| `public/_headers` | `netlify.toml`'s rules in Pages syntax: immutable `/_astro/*`, security headers everywhere |
| `src/pages/404.astro` | Top-level `404.html`. **Required, not cosmetic** — see §3 |
| `scripts/verify-pages.mjs` | 17 checks against workerd through `wrangler pages dev` |
| `package.json` | `preview:pages`, `verify:pages`; `wrangler` as a devDependency only |

`netlify.toml` and `netlify/functions/font.mjs` stay until the switch is finished and the old
host is retired. Two deploys' worth of config existing at once is the point: it makes the move
reversible.

## 2. The local test (run it before approving)

```bash
npm run build            # 12 pages, dist/ 1.4M
npm run preview:pages    # wrangler pages dev dist --port 8788 — workerd, not a static server
npm run verify:pages     # in a second terminal
```

Measured on this laptop, 2026-11-13 (all 17 pass):

```
PASS  / serves HTML — 200 text/html
PASS  the home page is the real page, not an error shell — 27843 bytes
PASS  security headers arrive from _headers — nosniff / strict-origin-when-cross-origin / DENY
PASS  HTML is never cached — public, max-age=0, must-revalidate
PASS  fingerprinted asset is served immutable — public, max-age=31536000, immutable
PASS  a nested page is served at its canonical URL — 200
PASS  the slashless URL redirects to the canonical one — 308 → /nastroje/vrstvy/
PASS  /robots.txt, /sitemap-index.xml, /sitemap-0.xml are served
PASS  /api/font returns a real TrueType file — 200 font/ttf 392208 B TTF
PASS  /api/font is cacheable for a year
PASS  the family guard survives bundling — 400
PASS  an unknown family is still a 404
PASS  an unknown URL is a 404, not a soft 200 of the homepage
PASS  the 404 is the site's own page
PASS  canonical still points at riplay.cz, not pages.dev
```

That last check matters: the canonical and the sitemap name `riplay.cz`, so the site must never
be *served* from a `*.pages.dev` host as its primary URL — the custom domain is not optional
politeness, it is what D10's canonicals already claim.

The Function line proves something a static preview cannot: Pages bundles
`functions/api/font.js` from source, resolving the shared `src/lib/font-proxy.mjs`, and the
guard against a path-shaped `family` still returns 400 after bundling.

## 3. The one real difference found: Pages would have created soft 404s

Cloudflare Pages treats a build with no top-level `404.html` as a **single-page application** and
answers every unknown URL with `200` and the homepage
([docs](https://developers.cloudflare.com/pages/configuration/serving-pages)). Every typo, every
stale link, every unlinked URL would have become a duplicate of `/` — immediately after D10
shipped canonicals, a sitemap and structured data. Netlify never did this, so it is a regression
that only appears on the new host.

`src/pages/404.astro` is the switch that turns it off: Astro emits `dist/404.html`, and Pages then
serves it with a real 404 status, walking up the directory tree for nested paths. The local test
asserts both the status and that the body is the site's page, so the guarantee is measured rather
than trusted.

The page itself is written in the site's voice (it says the URL does not exist instead of
pretending to redirect) and links to `/`, `/dil/`, `/nastroje/` and `/zakazka/`. Nothing on it
promises anything that is not there.

## 4. The decision that is not mine: DNS

Pages can only serve an **apex** domain from a zone whose nameservers are Cloudflare's — an apex
cannot be a CNAME, and OVH offers no ALIAS/CNAME-flattening record. So the realistic options:

| Option | What it costs | Verdict |
|---|---|---|
| **A. Move the zone's nameservers to Cloudflare** | Recreate every record first, re-issue DNSSEC; OVH stays registrar | **Recommended** — the apex works, the certificate is automatic, one provider for DNS and hosting |
| B. Keep OVH DNS, serve pages at `www` only | `www` CNAME to `riplay.pages.dev`; apex keeps pointing at Netlify | Rejected: apex is the canonical host in every page, and two hosts serving one site is exactly the drift the sitemap was written to prevent |
| C. Cloudflare CNAME/partial setup | CNAME setup is an Enterprise feature | Not available |

This is the same trade-off D3 recorded when Netlify was chosen ("the apex needs only one `A`
record, so the OVH nameservers and DNSSEC stay where they are"). The move reverses that
decision deliberately, and the cost is the mail records.

**Nothing may be switched before the zone is copied.** The zone currently carries five `MX`
records and the SPF TXT for `info@riplay.cz` (`docs/02-handoff.md` §2). A nameserver change
without them silently kills the inbox, and the inbox is already the site's weak point (D3b:
nobody can read it yet). Read the actual zone — do not work from this list, and do not assume
DKIM or DMARC exist; the handoff never confirmed either.

## 5. Runbook, with the approval gates

**Gate 0 — you approve this draft.** Nothing below happens before that.

1. **Export the OVH zone** (OVH manager → DNS zone → *Download zone file*, or the equivalent
   printable view) and keep it in the repo's untracked notes, not in chat. Record the current
   TTLs.
2. **Create the Cloudflare account and add `riplay.cz` as a zone.** Cloudflare assigns two
   nameservers; do not change anything at OVH yet.
3. **Recreate every record from the export** — site records can wait, mail cannot: all `MX`,
   SPF, and DKIM/DMARC if the export shows them. Then diff the Cloudflare zone against the export
   field by field (name, type, value, priority, TTL). This diff is the checkpoint that decides
   whether the next step is safe.
4. **Create the Pages project** — Workers & Pages → Create → Pages → Connect to Git →
   `Aeell/riplay-web`. Build command `npm run build`, output `dist`, `NODE_VERSION=22`. The repo
   already carries `wrangler.toml`, so the output directory is read from it.
5. **Test the `*.pages.dev` URL before any DNS change.** Run the same checks against it:
   `npm run verify:pages -- https://<project>.pages.dev`. Expect the canonical check to still name
   `riplay.cz` (it is baked into the build), and every header and the font proxy to behave.
6. **Gate 1 — you approve the nameserver switch.** Only now replace OVH's NS records with
   Cloudflare's two.
7. **Attach the custom domain** (Pages → Custom domains → `riplay.cz`, then `www.riplay.cz`).
   Certificate issuance is automatic; nothing to paste.
8. **Gate 2 — post-switch acceptance**, from a network that is not this one if possible:
   `npm run verify:pages -- https://riplay.cz`, plus `npm run verify:proxy -- https://riplay.cz/api/font`,
   `curl -sI https://riplay.cz/` (headers), and the Rich Results test + Search Console verify that
   D10 has been waiting for a live deploy to run.
9. **Keep Netlify up (DNS-only)** for at least a week after the switch. Its last build stays
   downloadable; the site can be pointed back by restoring the two NS records at OVH.

## 6. Rollback

Everything reversible, in this order of preference: delete the custom domain in Pages (the
`*.pages.dev` URL keeps working for tests), or restore OVH's original NS records. Netlify's site,
its last deploy and its `netlify.toml` are untouched by any of the above, so a rollback is a DNS
change of minutes, not a rebuild. Keep the exported zone until the switch has survived a renewal
or two.

## 7. What this move changes in the repo afterwards

- `netlify.toml` and `netlify/functions/font.mjs` become dead weight — delete them in the same
  commit that records the completed switch, not before.
- `DEPLOY.md` gets rewritten around Pages; the credit maths stays as the record of why.
- `netlify.toml`'s job (build contract, Node 22, cache headers) is now split between
  `wrangler.toml` and `public/_headers`, which is why both exist here already.

## 8. Open questions for the owner

1. Does the OVH **Starter** hosting plan hold the mailbox, or is mail on OVH's free MX plan? The
   answer decides whether the mailbox survives an OVH plan change (unrelated to DNS, but the same
   login).
2. Is DNSSEC enabled at OVH today? If yes, it must be re-enabled at Cloudflare after the switch;
   if it is left half-configured, resolvers see bogus answers.
3. Keep Netlify as a cold standby permanently, or delete the site once Pages has served a month?
4. `info@riplay.cz` is still unreadable (D3b). Moving DNS is the moment to fix that, because the
   mail records are being copied by hand anyway.
