/** Minimal HTML string helpers for the server-rendered pages. */

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export function escapeHtml(value: string): string {
  return value.replace(/["&'<>]/g, (char) => ESCAPES[char] ?? char);
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

/** Join template fragments, dropping empty/false pieces. */
export function joinHtml(parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join("\n");
}
