import "server-only";

export function isRussian(text: string): boolean {
  return /[Ѐ-ӿ]/.test(text);
}

export type TranslateResult =
  | { ok: true; translated: string }
  | { ok: false; reason: "not_found" | "network_error" };

interface MyMemoryResponse {
  responseStatus: number;
  responseData?: { translatedText?: string };
}

/** Russian → English via MyMemory (free, no API key). */
export async function translateRuToEn(text: string): Promise<TranslateResult> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ru|en`,
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
