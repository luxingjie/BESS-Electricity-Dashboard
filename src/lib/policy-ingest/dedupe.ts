import { createHash } from "node:crypto";

export function normalizePolicyUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }
  // Drop common tracking params
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export function contentHash(parts: {
  url: string;
  title?: string | null;
  documentId?: string | null;
}): string {
  const payload = [
    normalizePolicyUrl(parts.url),
    (parts.documentId || "").trim().toLowerCase(),
    (parts.title || "").trim().toLowerCase(),
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

function tokenizeTitle(title: string): Set<string> {
  const normalized = title.toLocaleLowerCase("zh-CN").trim();
  const tokens = new Set<string>();

  for (const word of normalized
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)) {
    tokens.add(word);
  }

  // Character bigrams help near-duplicate detection for CJK titles without spaces.
  const compact = normalized.replace(/\s+/g, "");
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(compact)) {
    for (let index = 0; index < compact.length - 1; index += 1) {
      tokens.add(compact.slice(index, index + 2));
    }
  }

  return tokens;
}

/** Jaccard similarity over tokens; used to merge near-duplicate titles. */
export function titleSimilarity(left: string, right: string): number {
  const a = tokenizeTitle(left);
  const b = tokenizeTitle(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isNearDuplicateTitle(
  left: string,
  right: string,
  threshold = 0.82,
): boolean {
  return titleSimilarity(left, right) >= threshold;
}
