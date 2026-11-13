// The font proxy, written once and wrapped twice: Netlify Functions and Cloudflare Pages
// Functions both just call `fontResponse`. It only uses fetch/DataView/AbortSignal, so it
// runs unchanged in Node, Netlify's runtime and Workers.
//
// Google serves .ttf instead of .woff2 to an ancient user agent, which is what opentype.js
// can parse — no woff2/Brotli decoder has to ship to the browser.

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 '&.,+!/-]{0,63}$/;
const WEIGHT = /^[1-9]00$/;

// Google orders the CSS blocks by subset; latin is the last one.
function ttfUrl(css) {
  const urls = [...css.matchAll(/src:\s*url\((https:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
  return urls.at(-1) ?? null;
}

const fail = (message, status) => new Response(message, {
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
});

export async function fontResponse(url) {
  const params = url.searchParams;
  const family = (params.get('family') ?? '').trim();
  const weight = params.get('weight') ?? '400';
  const italic = params.get('italic') === '1';

  // The family is interpolated into a URL, so a permissive pattern here would turn this
  // endpoint into an open proxy.
  if (!FAMILY.test(family)) return fail('neplatná rodina písma', 400);
  if (!WEIGHT.test(weight)) return fail('neplatný řez', 400);

  const name = encodeURIComponent(family).replace(/%20/g, '+');
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${name}:${axis}`;

  try {
    const cssResponse = await fetch(cssUrl, {
      headers: { 'user-agent': 'Mozilla/4.0', accept: 'text/css,*/*;q=0.1' },
      signal: AbortSignal.timeout(8000),
    });
    // Google answers 400 for a family or weight it does not have; to the page that simply
    // means "this one does not exist".
    if (!cssResponse.ok) {
      return fail(`Google nezná „${family}“ ${weight} (${cssResponse.status})`, cssResponse.status < 500 ? 404 : 502);
    }

    const url = ttfUrl(await cssResponse.text());
    if (!url) return fail('z odpovědi Google se nedal přečíst soubor písma', 502);

    const font = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!font.ok) return fail(`soubor písma se nestáhl (${font.status})`, 502);

    // Same bytes for a year: the edge serves every later visitor and the browser keeps it
    // on disk, so going back to a font already tried is instant.
    return new Response(await font.arrayBuffer(), {
      headers: {
        'content-type': 'font/ttf',
        'cache-control': 'public, max-age=31536000, immutable',
        'netlify-cdn-cache-control': 'public, max-age=31536000, immutable',
        'cdn-cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return fail(`stahování písma selhalo: ${error.name === 'TimeoutError' ? 'vypršel čas' : error.message}`, 504);
  }
}
