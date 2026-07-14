/**
 * Join class-name fragments, dropping falsy values. Kept as its own module so
 * every UI-kit file can import it without pulling in React components (avoids
 * accidental import cycles through the barrel).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
