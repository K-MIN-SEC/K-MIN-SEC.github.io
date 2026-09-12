import { z } from 'astro/zod';
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const accent = z.enum(['lime', 'mint', 'stone', 'sage']);
const text = z.string().min(1);
const optionalText = z.preprocess((v) => v === '' || v === null ? undefined : v, text.optional());
const mediaUrl = z.string().refine((v) => /^https:\/\//.test(v) || (/^\/(?!\/)/.test(v) && !v.includes('\\')), 'Use an HTTPS URL or a root-relative local path');
const optionalMedia = z.preprocess((v) => v === '' || v === undefined ? null : v, mediaUrl.nullable());
const nullableText = z.preprocess((v) => v === '' || v === undefined ? null : v, text.nullable());
export const projectSchema = z.object({
  id, title: text, internalName: optionalText, subtitle: text, category: text,
  status: text, year: text, accent, featured: z.boolean(), description: text,
  tags: z.array(text).default([]), sections: z.array(z.object({ title: text, body: text })).min(1),
  coverImage: optionalMedia, coverAlt: nullableText,
  videos: z.preprocess((v) => v ?? [], z.array(z.object({ title: text, src: mediaUrl, type: z.enum(['video', 'youtube']), poster: optionalMedia, caption: nullableText }))),
}).refine((v) => !v.coverImage || Boolean(v.coverAlt), 'coverAlt is required when coverImage is set');
export const playSchema = z.object({
  id, title: text, kind: text, description: text, accent,
  status: z.enum(['coming-soon', 'available']), projectId: z.preprocess((v) => v === '' || v === null ? undefined : v, id.optional()),
  demoUrl: optionalMedia, coverImage: optionalMedia, coverAlt: nullableText,
}).refine((v) => v.status !== 'available' || Boolean(v.demoUrl), 'Available demos need demoUrl').refine((v) => !v.coverImage || Boolean(v.coverAlt), 'coverAlt is required when coverImage is set');
export function unique<T extends { id: string }>(entries: T[], name: string) {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error(`Duplicate ${name} id`);
  return entries;
}
