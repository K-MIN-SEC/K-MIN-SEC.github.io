import { z } from 'astro/zod';
import data from '../data/site.json';
const optional = z.preprocess((value) => value ?? '', z.string());
export const siteInfo = z.object({
  name: z.string().min(1), brand: z.string().min(1), email: z.string().email(),
  school: z.string(), major: z.string(), classYear: z.string(),
  phone: optional, phoneHref: optional, birthDate: optional,
}).parse(data);
