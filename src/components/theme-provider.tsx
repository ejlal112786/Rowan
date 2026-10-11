"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme provider.
 *
 * `next-themes` writes a `class` on <html> and stores the preference locally,
 * which keeps themed rendering entirely client-side (no server round trip) and
 * avoids a flash of the wrong theme.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
