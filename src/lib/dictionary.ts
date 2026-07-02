import "server-only";
import type { DictionaryEntry } from "@/types/dictionary";

export interface WordDetails {
  word: string;
  definition?: string;
  partOfSpeech?: string;
  example?: string;
  phoneticText?: string;
}

export type DictionaryLookupResult =
  | { ok: true; details: WordDetails }
  | { ok: false; reason: "not_found" | "network_error" };

type SourceResult =
  | { details: WordDetails }
  | { error: "not_found" | "network_error" };

function extractFreeDictionary(entry: DictionaryEntry, word: string): WordDetails {
  const meaning = entry.meanings[0];
  const definition = meaning?.definitions[0];

  return {
    word,
    definition: definition?.definition,
    partOfSpeech: meaning?.partOfSpeech,
    example: definition?.example,
    phoneticText: entry.phonetic ?? entry.phonetics.find((p) => p.text)?.text,
  };
}

async function lookupFreeDictionary(word: string): Promise<SourceResult> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { cache: "no-store" }
    );
    if (res.status === 404) return { error: "not_found" };
    if (!res.ok) return { error: "network_error" };
    const data = (await res.json()) as DictionaryEntry[];
    if (!data[0]) return { error: "not_found" };
    return { details: extractFreeDictionary(data[0], word) };
  } catch {
    return { error: "network_error" };
  }
}

interface DatamuseEntry {
  word: string;
  defs?: string[];
}

const DATAMUSE_POS_MAP: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
};

function extractDatamuse(entry: DatamuseEntry, word: string): WordDetails | null {
  const first = entry.defs?.[0];
  if (!first) return null;

  const [posAbbr, ...rest] = first.split("\t");
  const definition = rest.join("\t").trim();
  if (!definition) return null;

  return {
    word,
    definition,
    partOfSpeech: DATAMUSE_POS_MAP[posAbbr],
  };
}

async function lookupDatamuse(word: string): Promise<SourceResult> {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`,
      { cache: "no-store" }
    );
    if (!res.ok) return { error: "network_error" };
    const data = (await res.json()) as DatamuseEntry[];
    const entry = data.find((e) => e.word.toLowerCase() === word);
    const details = entry ? extractDatamuse(entry, word) : null;
    if (!details) return { error: "not_found" };
    return { details };
  } catch {
    return { error: "network_error" };
  }
}

// Tried in order; the first source with a definition wins. Add more sources
// here (same SourceResult shape) to extend the fallback chain.
const SOURCES = [lookupFreeDictionary, lookupDatamuse];

export async function lookupWord(word: string): Promise<DictionaryLookupResult> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "not_found" };

  let sawNetworkError = false;
  for (const source of SOURCES) {
    const result = await source(normalized);
    if ("details" in result) return { ok: true, details: result.details };
    if (result.error === "network_error") sawNetworkError = true;
  }

  return { ok: false, reason: sawNetworkError ? "network_error" : "not_found" };
}
