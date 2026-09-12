import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const devlog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/devlog' }),
  schema: z.object({
    title: z.string(), description: z.string(), date: z.coerce.date(),
    category: z.string(), tags: z.array(z.string()).default([]), projectId: z.string().nullable().optional(),
    sample: z.boolean().default(false), draft: z.boolean().default(false),
  }),
});
export const collections = { devlog };
