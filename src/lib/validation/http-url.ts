/** Safe HTTP(S) protocol check for use inside Zod refinements. */
export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
