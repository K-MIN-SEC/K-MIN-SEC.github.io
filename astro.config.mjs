import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), ''), ...process.env };
const site = env.SITE_URL || 'https://example.com';
const parsed = new URL(site);
if (!['https:', 'http:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
  throw new Error('SITE_URL must be an http(s) origin without a path. Set BASE_PATH separately.');
}
if (parsed.hostname === 'example.com') console.warn('[MINSEC] Preview domain in use. Set SITE_URL before publishing.');
export default defineConfig({
  site,
  base: env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') && !page.includes('/admin/') && !page.endsWith('/account/') && !page.endsWith('/space/') })],
});
