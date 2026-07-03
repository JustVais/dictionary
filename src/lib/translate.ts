import "server-only";

export function isRussian(text: string): boolean {
  return /[Ѐ-ӿ]/.test(text);
}

export type TranslateResult =
  | { ok: true; translated: string }
  | { ok: false; reason: "not_found" | "network_error" };

/**
 * Translate via Google's unofficial `gtx` endpoint (free, no API key).
 * Much better ru↔en quality than MyMemory. It's undocumented and unofficial,
 * so `translate()` falls back to MyMemory if it ever fails or rate-limits.
 */
async function google(
  text: string,
  from: string,
  to: string
): Promise<TranslateResult> {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`,
      { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return { ok: false, reason: "network_error" };
    // Shape: [ [ [translatedSegment, originalSegment, ...], ... ], ... ]
    const data = (await res.json()) as [Array<[string, ...unknown[]]>, ...unknown[]];
    const segments = data?.[0];
    if (!Array.isArray(segments)) return { ok: false, reason: "not_found" };
    const translated = segments
      .map((s) => (typeof s?.[0] === "string" ? s[0] : ""))
      .join("")
      .trim();
    if (!translated) return { ok: false, reason: "not_found" };
    return { ok: true, translated: translated.toLowerCase() };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

interface MyMemoryResponse {
  responseStatus: number;
  responseData?: { translatedText?: string };
}

/** Fallback translator via MyMemory (free, no API key). */
async function mymemory(
  text: string,
  from: string,
  to: string
): Promise<TranslateResult> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { ok: false, reason: "network_error" };
    const data = (await res.json()) as MyMemoryResponse;
    const translated = data.responseData?.translatedText?.trim();
    if (data.responseStatus !== 200 || !translated) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, translated: translated.toLowerCase() };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

/** Google first (quality), MyMemory as a fallback if it's unavailable. */
async function translate(
  text: string,
  from: string,
  to: string
): Promise<TranslateResult> {
  const primary = await google(text, from, to);
  if (primary.ok) return primary;
  return mymemory(text, from, to);
}

/** Russian → English. */
export function translateRuToEn(text: string): Promise<TranslateResult> {
  return translate(text, "ru", "en");
}

/** English → Russian (used to backfill card translations). */
export function translateEnToRu(text: string): Promise<TranslateResult> {
  return translate(text, "en", "ru");
}
