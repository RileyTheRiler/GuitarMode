// Input sanitizers for user-controlled data embedded in LLM prompts. Stripping
// control characters and capping length limits prompt-injection surface.

// Strip all control characters (including newlines) and truncate. Use for
// single-line fields like titles, keys, and chord lists.
export function sanitize(value: string, maxLen: number): string {
  return value.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, maxLen);
}

// Strip control characters except tab (\x09) and newline (\x0A), then truncate.
// Use for free-text like chat messages where line breaks are meaningful.
export function sanitizeMultiline(value: string, maxLen: number): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ").trim().slice(0, maxLen);
}
