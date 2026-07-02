"use client";

import { useEffect } from "react";

/**
 * Stores the browser's IANA timezone in a cookie so server-side stats
 * queries can bucket reviews by the user's local days, not UTC.
 */
export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);

  return null;
}
