// @ts-check
import { defineConfig } from 'astro/config';

// Static output on purpose: the whole site is a portable set of files.
// Deploy target is decided on Day 3 (see PLAN.md); nothing here locks it in.
export default defineConfig({
  site: 'https://riplay.cz',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto' },
});
