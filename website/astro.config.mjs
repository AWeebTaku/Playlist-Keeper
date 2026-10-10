import { defineConfig } from 'astro/config';

// Served from https://aweebtaku.github.io/Playlist-Keeper/ (GitHub Pages project site). With a custom domain: set `site` to it and drop `base`.
export default defineConfig({
  site: 'https://aweebtaku.github.io',
  base: '/Playlist-Keeper',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
