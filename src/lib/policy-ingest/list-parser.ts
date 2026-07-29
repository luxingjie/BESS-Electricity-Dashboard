import * as cheerio from "cheerio";

import type { PolicyListCandidate } from "./types";

function absoluteHttpUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Heuristic list-page parser: collect unique in-domain anchors with usable titles.
 * Prefer same-origin detail links; skip mailto/javascript and the list URL itself.
 */
export function parsePolicyListHtml(
  html: string,
  listUrl: string,
  options: { maxCandidates?: number } = {},
): PolicyListCandidate[] {
  const maxCandidates = options.maxCandidates ?? 25;
  const $ = cheerio.load(html);
  const list = new URL(listUrl);
  const seen = new Set<string>();
  const candidates: PolicyListCandidate[] = [];

  $("a[href]").each((_, element) => {
    if (candidates.length >= maxCandidates) return false;
    const href = $(element).attr("href");
    const absolute = absoluteHttpUrl(href, listUrl);
    if (!absolute) return;

    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      return;
    }
    if (parsed.origin !== list.origin) return;
    if (absolute === listUrl || absolute === `${listUrl}/`) return;

    const title = normalizeTitle(
      $(element).text() || $(element).attr("title") || "",
    );
    if (title.length < 8 || title.length > 300) return;
    if (/^(home|首页|更多|more|next|prev|上一页|下一页)$/i.test(title)) return;

    const key = absolute.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const timeText =
      $(element).closest("li, tr, article, div").find("time").first().attr("datetime") ||
      $(element).closest("li, tr, article, div").find("time").first().text() ||
      null;

    candidates.push({
      title,
      url: absolute,
      publishedAt: timeText ? normalizeTitle(timeText) : null,
    });
  });

  return candidates;
}
