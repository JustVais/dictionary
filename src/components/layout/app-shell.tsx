import { Header } from "./header";
import { BottomTabBar } from "./bottom-tab-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header className="hidden md:block" />
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-20 pt-4 md:pb-4">
        {children}
      </main>
      <BottomTabBar className="md:hidden" />
    </div>
  );
}
