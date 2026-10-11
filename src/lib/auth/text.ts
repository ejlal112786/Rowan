/**
 * Text normalisation for values that are compared or displayed.
 *
 * Zero-width and bidirectional control characters are removed before comparing anything
 * that came from outside Rowan (provider messages, form input, email addresses). They
 * are invisible, they break naive string comparisons, and they are a standard way to
 * smuggle a visually identical value past a check or into a log line.
 */

/** Zero-width space/joiner/non-joiner and the byte-order mark. */
export const ZERO_WIDTH_PATTERN = /[\u200b-\u200d\ufeff]/g;

/** Bidirectional overrides and isolates. */
export const BIDI_CONTROL_PATTERN = /[\u202a-\u202e\u2066-\u2069]/g;

/** Collapse all whitespace runs into single spaces and trim the result. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Remove invisible characters that carry no meaning in a comparison. */
export function stripInvisible(value: string): string {
  return value.replace(ZERO_WIDTH_PATTERN, "").replace(BIDI_CONTROL_PATTERN, "");
}
