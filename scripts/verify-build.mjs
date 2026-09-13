import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('dist');
const read = (file) => readFileSync(file, 'utf8');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
const files = walk(root).filter((p) => p.endsWith('.html'));
const attr = (tag, key) => tag.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1];
const home = read(join(root, 'index.html'));
const canonicalTag = home.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0];
const site = new URL(attr(canonicalTag || '', 'href'));
const base = site.pathname;
const titles = new Set();
let links = 0;
for (const file of files) {
  const html = read(file);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one h1`);
  assert.match(html, /<html lang="ko"/);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title && !titles.has(title), `${file}: unique title`); titles.add(title);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type']) assert.ok(html.includes(`property="${key}"`), `${file}: ${key}`);
  const canonical = new URL(attr(html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0] || '', 'href'));
  assert.equal(canonical.origin, site.origin);
  assert.ok(canonical.pathname.startsWith(base));
  const schema = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(JSON.parse(schema)['@context'], 'https://schema.org');
  for (const img of html.match(/<img\b[^>]*>/g) || []) assert.notEqual(attr(img, 'alt'), undefined, `${file}: image alt`);
  let previousHeading = 0;
  for (const match of html.matchAll(/<h([1-6])\b/g)) {
    const level = Number(match[1]);
    assert.ok(level <= previousHeading + 1, `${file}: skipped heading level`); previousHeading = level;
  }
  for (const tag of html.match(/<(?:a|link|script|img)\b[^>]*>/g) || []) {
    const ref = attr(tag, 'href') || attr(tag, 'src');
    if (!ref) continue;
    const target = new URL(ref.replaceAll('&amp;', '&'), canonical);
    if (target.origin !== site.origin) continue;
    assert.ok(target.pathname.startsWith(base), `${file}: missing base ${ref}`);
    let targetFile = join(root, decodeURIComponent(target.pathname.slice(base.length)));
    if (existsSync(targetFile) && statSync(targetFile).isDirectory()) targetFile = join(targetFile, 'index.html');
    assert.ok(existsSync(targetFile), `${file}: broken internal reference ${ref}`);
    if (target.hash && targetFile.endsWith('.html')) assert.ok(read(targetFile).includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${file}: missing fragment ${ref}`);
    links++;
  }
}
const sitemap = read(join(root, 'sitemap-0.xml'));
const robots = read(join(root, 'robots.txt'));
assert.ok(robots.includes(new URL('sitemap-index.xml', site).href));
assert.match(robots, site.hostname === 'example.com' ? /Disallow: \// : /Allow: \//);
for (const file of files) {
  const html = read(file);
  const canonical = attr(html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0] || '', 'href');
  const explicitlyNoindex = file.endsWith('404.html')
    || file.includes(`${join('dist', 'admin')}`)
    || file.includes(`${join('dist', 'account')}`)
    || file.includes(`${join('dist', 'space')}`);
  if (explicitlyNoindex) {
    assert.ok(!sitemap.includes(`<loc>${canonical}</loc>`), `${file}: noindex page present in sitemap`);
    assert.ok(html.includes('content="noindex, follow"'));
  } else {
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `${file}: absent from sitemap`);
    assert.ok(html.includes(`content="${site.hostname === 'example.com' ? 'noindex, follow' : 'index, follow'}"`));
  }
}
const projects = JSON.parse(read('src/data/projects.json')).items;
const play = JSON.parse(read('src/data/play.json')).items;
assert.equal((read(join(root, 'projects/index.html')).match(/class="project-card /g) || []).length, projects.length);
assert.equal((read(join(root, 'play/index.html')).match(/class="play-card /g) || []).length, play.length);
for (const p of projects) assert.ok(existsSync(join(root, `projects/${p.id}/index.html`)));
console.log(`Verified ${files.length} HTML pages, ${links} internal references, metadata, headings, sitemap, robots and all data-driven cards. Base: ${base}`);
