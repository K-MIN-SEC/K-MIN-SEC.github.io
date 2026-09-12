export type SiteEventName = 'page_view' | 'project_open' | 'devlog_open' | 'demo_open' | 'demo_start' | 'demo_complete' | 'engagement';
export type SiteEvent = { name: SiteEventName; path: string; contentId?: string; durationMs?: number };
export type AnalyticsAdapter = (event: SiteEvent) => void;
let adapter: AnalyticsAdapter | undefined;

/** Install an analytics provider after your chosen consent flow. Default: no network requests. */
export function setAnalyticsAdapter(next?: AnalyticsAdapter) { adapter = next; }
export function track(name: SiteEventName, detail: Omit<SiteEvent, 'name' | 'path'> = {}) {
  const event: SiteEvent = { name, path: location.pathname, ...detail };
  window.dispatchEvent(new CustomEvent<SiteEvent>('minsec:event', { detail: event }));
  try { adapter?.(event); } catch (error) { console.warn('[MINSEC] Analytics adapter failed', error); }
}
track('page_view');
const clickEvents = new Set<SiteEventName>(['project_open', 'devlog_open', 'demo_open']);
document.addEventListener('click', (event) => {
  const el = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event]') : null;
  const name = el?.dataset.event as SiteEventName;
  if (el && clickEvents.has(name)) track(name, { contentId: el.dataset.contentId });
});
let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
let activeMs = 0;
function flush() {
  if (visibleSince) activeMs += performance.now() - visibleSince;
  visibleSince = 0;
  if (activeMs > 0) track('engagement', { durationMs: Math.round(activeMs) });
  activeMs = 0;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush(); else visibleSince = performance.now();
});
window.addEventListener('pagehide', flush);
window.addEventListener('pageshow', () => { if (document.visibilityState === 'visible') visibleSince = performance.now(); });
