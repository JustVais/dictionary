"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function WordSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const trimmed = value.trim();
      router.replace(
        trimmed ? `/vocabulary?q=${encodeURIComponent(trimmed)}` : "/vocabulary"
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, router]);

  return (
    <Input
      type="search"
      placeholder="Search all words…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
