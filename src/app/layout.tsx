import "@fontsource-variable/inter";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { AppShell } from "@/components/app-shell/app-shell";
import { Sidebar } from "@/components/app-shell/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { appConfig } from "@/config/app";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";

/**
 * Root layout.
 *
 * Server component: it reads validated public configuration, renders the
 * persistent sidebar on the server, and composes the client shell around the
 * page content.
 */
export function generateMetadata(): Metadata {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  return {
    ...(appUrl === undefined ? {} : { metadataBase: new URL(appUrl) }),
    title: {
      default: `${appConfig.name} — ${appConfig.category}`,
      template: `%s · ${appConfig.name}`,
    },
    description: appConfig.description,
    applicationName: appConfig.name,
    // The shell is not a public marketing site; indexing decisions belong to a
    // later phase once real content exists.
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // One session resolution per request (React caches it), so the shell can render the
  // accurate account state without every component re-asking the provider.
  const user = await getCurrentUser();

  const accountSummary =
    user === null ? null : { email: user.email, displayName: user.displayName };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell sidebar={<Sidebar user={accountSummary} />} user={accountSummary}>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
