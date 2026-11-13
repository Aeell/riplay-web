import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The passport schema. Every field a part must be able to state is here, and every field
// that is not yet known is explicitly nullable — the page renders `doplní se`, never a
// plausible guess. That is the constitution expressed as a type.

const stage = z.object({
  /** short label in the scrubber */
  k: z.string(),
  /** one sentence: what actually happened */
  n: z.string(),
  /** time spent, as written by hand — null when nobody wrote it down */
  t: z.string().nullable().default(null),
});

const parts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/parts' }),
  schema: z.object({
    title: z.string(),
    /** one sentence a customer would understand */
    summary: z.string(),
    /** `sample` is the one part that exists to demonstrate the Replay; it must say so */
    status: z.enum(['sample', 'in-progress', 'done']),
    started: z.coerce.date(),
    material: z.string().nullable().default(null),
    machine: z.string().nullable().default(null),
    tolerance: z.string().nullable().default(null),
    /** real minutes on the bench, once somebody timed it */
    minutes: z.number().int().nonnegative().nullable().default(null),
    /** price band shown to the customer, not a quote */
    price: z.string().nullable().default(null),
    stages: z.array(stage).min(1),
    failures: z.array(z.string()).default([]),
  }),
});

const episodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/episodes' }),
  schema: z.object({
    n: z.string(),
    title: z.string(),
    summary: z.string(),
    status: z.enum(['planned', 'published']),
    /** null while the episode is only announced */
    date: z.coerce.date().nullable().default(null),
    /** the machine configuration the episode is dated against */
    machineConfig: z.string().nullable().default(null),
  }),
});

export const collections = { parts, episodes };
