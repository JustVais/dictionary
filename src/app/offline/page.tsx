import Link from "next/link";
import { ReviewSession } from "@/components/cards/review-session";
import { Button } from "@/components/ui/button";

// Statically rendered so `@serwist/next` precaches it into `__SW_MANIFEST`;
// the service worker serves it as the document fallback when a navigation
// can't reach the network (e.g. cold-launching the installed app offline).
// It has no `requireUser()` layout, so it renders without a server round-trip.
// `ReviewSession` with no initial words restores the cached "Study All" queue
// from IndexedDB (`loadQueue("all")`) and buffers grades in the outbox.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-lg font-semibold">Offline review</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re offline. Reviewing your cached cards — grades sync once
          you&apos;re back online.
        </p>
      </div>

      <ReviewSession initialWords={[]} scopeId="all" aheadOfSchedule={false} />

      <Link href="/cards" className="mx-auto">
        <Button variant="outline" size="sm">
          Back to Cards
        </Button>
      </Link>
    </main>
  );
}
