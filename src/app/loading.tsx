import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading boundary.
 *
 * Rendered while a server component segment is resolving. It announces a busy
 * state to assistive technology and shows neutral placeholders rather than
 * simulated content.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div role="status" aria-live="polite" className="sr-only">
        Loading page content
      </div>
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
