/**
 * Time zones offered by the account surface.
 *
 * A deliberately short list of the zones Rowan's first users are likely to need rather
 * than a full IANA dump: the profile schema validates membership, so the list has to be
 * something a person can actually choose from. Expanding it is a Phase 7 task.
 */
export const TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Stockholm",
  "Pacific/Auckland",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export function isTimezone(value: unknown): value is Timezone {
  return typeof value === "string" && (TIMEZONES as readonly string[]).includes(value);
}
