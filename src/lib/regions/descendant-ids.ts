import type { Region } from "@/lib/types";

/** Inclusive subtree of region ids under `rootId` (includes the root). */
export function descendantRegionIds(
  regions: readonly Region[],
  rootId: string,
): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.parent_id && ids.has(region.parent_id) && !ids.has(region.id)) {
        ids.add(region.id);
        changed = true;
      }
    }
  }

  return ids;
}
