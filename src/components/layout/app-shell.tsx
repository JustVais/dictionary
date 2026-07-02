import { Header } from "./header";
import { BottomTabBar } from "./bottom-tab-bar";
import { ThemeToggle } from "./theme-toggle";
import { TimezoneSync } from "./timezone-sync";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TimezoneSync />
      <Header className="hidden md:block" />
      <ThemeToggle className="fixed right-4 top-3 z-40 md:hidden" />
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-20 pt-4 md:pb-4">
        {children}
      </main>
      <BottomTabBar className="md:hidden" />
    </div>
  );
}
