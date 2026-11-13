// Cloudflare Pages Function: this file is the whole /api/font route on Pages.
// Pages bundles it with esbuild, so the shared module is inlined — nothing to install.

import { fontResponse } from '../../src/lib/font-proxy.mjs';

export const onRequestGet = ({ request }) => fontResponse(new URL(request.url));
