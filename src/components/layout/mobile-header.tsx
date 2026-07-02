"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function MobileHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const section = NAV_ITEMS.find((item) => pathname.startsWith(item.href));

  return (
    <header
      className={cn("sticky top-0 z-40 border-b bg-background", className)}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-base font-semibold">
          {section?.label ?? "Vocabulary"}
        </h1>
        <ThemeToggle />
      </div>
    </header>
  );
}
