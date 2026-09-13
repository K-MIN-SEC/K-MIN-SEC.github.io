import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
export default defineConfig({
  output: 'server',
  session: false,
  adapter: cloudflare({imageService: 'passthrough'}),
  trailingSlash: 'always',
  devToolbar: {enabled: false},
  // Prebundle these before the worker starts so discovery cannot invalidate
  // the SSR handler while Cloudflare's development runner is loading it.
  vite: {optimizeDeps: {include: [
    'astro/assets/services/noop', 'astro/logger/console', '@supabase/supabase-js',
  ]}},
});
