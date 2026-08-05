import { isNearDuplicateTitle, normalizePolicyUrl } from "./dedupe";
import { isStaleDate } from "./hard-filter";

export type DraftCleanupRow = {
  id: string;
  title: string | null;
  source_url: string | null;
  content_hash: string | null;
  event_date: string | null;
  created_at: string;
};

/** Pure helper: pick stale / duplicate ai_draft ids to delete (keep newest). */
export function selectAiDraftsToClean(
  drafts: readonly DraftCleanupRow[],
  lookbackDays: number,
  now: Date,
): string[] {
  const toDelete = new Set<string>();

  for (const draft of drafts) {
    const day = draft.event_date || draft.created_at.slice(0, 10);
    if (isStaleDate(day, lookbackDays, now)) {
      toDelete.add(draft.id);
    }
  }

  const survivors = drafts.filter((draft) => !toDelete.has(draft.id));

  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const keptTitles: string[] = [];

  for (const draft of survivors) {
    const url = draft.source_url
      ? normalizePolicyUrl(draft.source_url)
      : null;
    if (url) {
      if (seenUrls.has(url)) {
        toDelete.add(draft.id);
        continue;
      }
      seenUrls.add(url);
    }

    if (draft.content_hash) {
      if (seenHashes.has(draft.content_hash)) {
        toDelete.add(draft.id);
        continue;
      }
      seenHashes.add(draft.content_hash);
    }

    const title = draft.title?.trim() || "";
    if (
      title &&
      keptTitles.some((kept) => isNearDuplicateTitle(kept, title))
    ) {
      toDelete.add(draft.id);
      continue;
    }
    if (title) keptTitles.push(title);
  }

  return [...toDelete];
}
