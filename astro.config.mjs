// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output on purpose: the whole site is a portable set of files.
// Deploy target is decided on Day 3 (see PLAN.md); nothing here locks it in.
export default defineConfig({
  site: 'https://riplay.cz',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    // The host answers /cesta/ (the build writes directories, and the redirect goes that way),
    // which is what the canonical already points at. The sitemap has to say the same URL or it
    // sends crawlers through a redirect for every page.
    sitemap({
      serialize: (item) => {
        const url = new URL(item.url);
        if (!url.pathname.endsWith('/')) url.pathname += '/';
        return { ...item, url: url.href };
      },
    }),
  ],
  build: { inlineStylesheets: 'auto' },
});
