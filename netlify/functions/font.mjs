// The browser never talks to Google: it asks riplay.cz for a font and this function
// fetches it. That keeps the site's promise (no third-party requests from the page)
// while still offering the whole Google Fonts catalogue, with no API key anywhere.
//
// Google serves .ttf instead of .woff2 to an ancient user agent, which is exactly what
// opentype.js can parse — no woff2/Brotli decoder needs to ship to the browser.

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 '&.,+!/-]{0,63}$/;
const WEIGHT = /^[1-9]00$/;

// Google orders the CSS blocks by subset; latin is the last one, which is what we want.
function ttfUrl(css) {
  const urls = [...css.matchAll(/src:\s*url\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  return urls.at(-1) ?? null;
}

const fail = (message, status) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const family = (params.get('family') ?? '').trim();
  const weight = params.get('weight') ?? '400';
  const italic = params.get('italic') === '1';

  // Validate before anything reaches Google: the family is interpolated into a URL,
  // so a permissive pattern here would make this an open proxy.
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
    // Google answers 400 for a family or weight it does not have; to the page that is
    // simply "this one does not exist", so don't dress it up as an upstream failure.
    if (!cssResponse.ok) return fail(`Google nezná „${family}“ ${weight} (${cssResponse.status})`, cssResponse.ok === false && cssResponse.status < 500 ? 404 : 502);

    const url = ttfUrl(await cssResponse.text());
    if (!url) return fail('z odpovědi Google se nedal přečíst soubor písma', 502);

    const fontResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!fontResponse.ok) return fail(`soubor písma se nestáhl (${fontResponse.status})`, 502);

    // Same bytes for a year: the CDN serves every later visitor, and the browser keeps
    // it on disk, so going back to a font you already tried is instant.
    return new Response(await fontResponse.arrayBuffer(), {
      headers: {
        'content-type': 'font/ttf',
        'cache-control': 'public, max-age=31536000, immutable',
        'netlify-cdn-cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return fail(`stahování písma selhalo: ${error.name === 'TimeoutError' ? 'vypršel čas' : error.message}`, 504);
  }
};
