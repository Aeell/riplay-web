# Deploying riplay.cz without paying

The site is currently on Netlify (site `f3abf7bc-b006-4cc4-a72a-8e3832df1c2d`), git-linked to
`Aeell/riplay-web`, serving `dist/`. The build is reproducible anywhere: `npm install`,
`npm run build`, publish `dist/`.

## Why Netlify stopped deploying

Netlify's credit plans (Free = **300 credits/month**) charge for usage, not for the plan:

| Action | Cost |
|---|---|
| Production deploy | **15 credits each** |
| Deploy preview / branch deploy | **0 credits** |
| Bandwidth | 20 credits per GB |
| Web requests | 2 credits per 10,000 |
| Function compute | 10 credits per GB-hour |

So a free month is roughly **20 production deploys**, or **15 GB of traffic**, or a mix. When
the balance is gone, deploys are paused and only so-called operational credits keep existing
sites online — the site stays up, nothing new ships. The balance resets at the start of each
billing cycle.

Two consequences worth knowing:

- Pushing a commit to `master` is not free — every merge costs 15 credits. Batch commits,
  and test locally with `npm run preview:full` instead of deploying to check.
- Deploy Previews are free, but this site has branch deploys **off**, so pushing a branch
  creates nothing. Enabling it is Settings → Build & deploy → Branches.

## The free-forever option: Cloudflare Pages

Cloudflare Pages has no deploy credits, no bandwidth limit and no card requirement:
**500 builds/month, unlimited bandwidth, 100,000 function invocations/day** free. The font
proxy is already written for it — `functions/api/font.js` is the Pages Function, sharing
`src/lib/font-proxy.mjs` with the Netlify adapter.

1. Create a free Cloudflare account and add `riplay.cz` as a zone.
2. Cloudflare gives you two nameservers; set them at **OVH** (Domain → DNS servers) in place
   of the current ones. This moves DNS, not the domain — OVH stays the registrar, and the
   mailbox at OVH is unaffected.
3. Workers & Pages → **Create → Pages → Connect to Git** → `Aeell/riplay-web`.
   - Framework preset: Astro (or none)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: set `NODE_VERSION=22` as a build variable (the repo's `netlify.toml`
     does not apply here).
4. After the first deploy, Pages → Custom domains → add `riplay.cz` and `www.riplay.cz`.
   Because the zone is already on Cloudflare, the apex works without CNAME tricks, and the
   certificate is issued automatically.
5. `public/_routes.json` limits the Function to `/api/*`, so ordinary page views never touch
   it.

Until the nameservers change, the existing site keeps serving from Netlify — the move is
reversible at any point by pointing DNS back.

## Checking a deployment

```bash
curl -sI https://riplay.cz/                                  # 200, cache headers
curl -s -o /tmp/f.ttf -w '%{http_code} %{content_type}\n' \
  'https://riplay.cz/api/font?family=Lobster&weight=400'     # 200 font/ttf
head -c4 /tmp/f.ttf | od -An -tx1                            # 00 01 00 00 (TrueType)
npm run verify:font && npm run verify:mesh && npm run verify:paths
```

`npm run verify:proxy` additionally calls the real endpoint and proves the TTF comes back
(the only check in the repo that needs the network).
