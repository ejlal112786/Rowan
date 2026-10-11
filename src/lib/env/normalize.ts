/**
 * Normalisation shared by the public and server environment readers.
 *
 * Hosting platforms hand back `""` for variables that are present but empty
 * (and `undefined` for variables that are absent). Both are treated as
 * "not configured" so an empty string never fails URL validation or silently
 * becomes a valid value.
 */
export function normalizeEnvRecord(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") {
      normalized[key] = undefined;
      continue;
    }

    const trimmed = value.trim();
    normalized[key] = trimmed.length > 0 ? trimmed : undefined;
  }

  return normalized;
}
