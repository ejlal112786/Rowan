import { cn } from "@/lib/utils";

/**
 * Rowan logomark: a stylised rowan branch drawn with the current text colour.
 *
 * Decorative by design — the product name is always present as real text next
 * to it, so the mark itself is hidden from assistive technology.
 */
export function RowanMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("size-6", className)}
    >
      <path
        d="M12 21V10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 15.9c-3.1 0-5.6-2.5-5.6-5.6 3.1 0 5.6 2.5 5.6 5.6Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12.35 12.9c0-3.1 2.5-5.6 5.6-5.6 0 3.1-2.5 5.6-5.6 5.6Z"
        fill="currentColor"
        opacity="0.6"
      />
      <circle cx="12" cy="5.4" r="2.1" fill="currentColor" />
    </svg>
  );
}
