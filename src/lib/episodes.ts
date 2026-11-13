import type { CollectionEntry } from 'astro:content';

// One definition of "this episode is live", used by both the index and the route, so the
// listing can never link to a page that was not generated. A page needs a date and actual
// words: an announced-but-unwritten episode stays listed and unlinked, whatever its status
// field says.
export function isLive(episode: CollectionEntry<'episodes'>): boolean {
  return episode.data.status === 'published'
    && episode.data.date !== null
    && (episode.body ?? '').trim().length > 0;
}
