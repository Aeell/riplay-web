// Netlify Functions v2 adapter — same logic as the Cloudflare Pages function, because
// both call src/lib/font-proxy.mjs. Kept so an upgrade to a credit plan needs no work.

import { fontResponse } from '../../src/lib/font-proxy.mjs';

export default async (request) => fontResponse(new URL(request.url));
