import "server-only";
import type { DictionaryEntry } from "@/types/dictionary";

export interface WordSense {
  definition: string;
  partOfSpeech?: string;
  example?: string;
}

export interface WordDetails {
  word: string;
  /** Native-language (Russian) translation, set when the query was Russian. */
  translation?: string;
  definition?: string;
  partOfSpeech?: string;
  example?: string;
  phoneticText?: string;
  /** Up to MAX_SENSES alternative senses; the first matches the primary fields. */
  senses?: WordSense[];
}

const MAX_SENSES = 3;

export type DictionaryLookupResult =
  | { ok: true; details: WordDetails }
  | { ok: false; reason: "not_found" | "network_error" };

type SourceResult =
  | { details: WordDetails }
  | { error: "not_found" | "network_error" };

function extractFreeDictionary(entry: DictionaryEntry, word: string): WordDetails {
  const senses: WordSense[] = entry.meanings
    .flatMap((meaning) =>
      meaning.definitions.map((d) => ({
        definition: d.definition,
        partOfSpeech: meaning.partOfSpeech,
        example: d.example,
      }))
    )
    .slice(0, MAX_SENSES);
  const primary = senses[0];

  return {
    word,
    definition: primary?.definition,
    partOfSpeech: primary?.partOfSpeech,
    example: primary?.example,
    phoneticText: entry.phonetic ?? entry.phonetics.find((p) => p.text)?.text,
    senses,
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

// --- Merriam-Webster (v3) -------------------------------------------------
// Learner's and the Intermediate school dictionary share the same JSON shape.
// A definition and its example live together in def[].sseq, so we walk that
// tree rather than the flat `shortdef` to keep them paired. Text carries MW
// markup tokens like {bc}, {it}...{/it}, {phrase}, and {sx|word||} links.

interface MwEntry {
  meta?: { id?: string; stems?: string[] };
  hwi?: { hw?: string; prs?: { ipa?: string; mw?: string }[] };
  fl?: string;
  def?: { sseq?: unknown[] }[];
}

function cleanMwText(text: string): string {
  return text
    .replace(/\{bc\}/g, "")
    .replace(/\{ldquo\}/g, "“")
    .replace(/\{rdquo\}/g, "”")
    // link tokens: {sx|word|id|}, {d_link|word|id}, {a_link|word} → keep word
    .replace(/\{(?:sx|dxt|d_link|i_link|et_link|a_link|dx_def)\|([^|}]*)(?:\|[^}]*)?\}/g, "$1")
    // paired formatting tokens
    .replace(/\{\/?(?:it|wi|phrase|inf|sup|qword|parahw|b|sc)\}/g, "")
    // learner glosses in examples, e.g. "[=he did that]"
    .replace(/\s*\[=[^\]]*\]/g, "")
    // anything else in braces
    .replace(/\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collect `sense` objects (those carrying defining text) in document order. */
function collectMwSenses(node: unknown, out: Record<string, unknown>[]): void {
  if (!Array.isArray(node)) return;
  if (node[0] === "sense" && node[1] && typeof node[1] === "object") {
    out.push(node[1] as Record<string, unknown>);
    return;
  }
  for (const child of node) collectMwSenses(child, out);
}

/** Pull definition text and the first example from a sense's `dt` array. */
function readMwDt(dt: unknown): { definition: string; example?: string } {
  if (!Array.isArray(dt)) return { definition: "" };
  const textParts: string[] = [];
  let example: string | undefined;
  for (const token of dt) {
    if (!Array.isArray(token)) continue;
    if (token[0] === "text") {
      textParts.push(String(token[1]));
    } else if (token[0] === "vis" && !example && Array.isArray(token[1])) {
      const first = token[1][0] as { t?: string } | undefined;
      if (first?.t) example = cleanMwText(first.t);
    } else if (token[0] === "uns" && Array.isArray(token[1])) {
      // nested defining text (usage notes) — recurse into each group
      for (const group of token[1]) {
        const nested = readMwDt(group);
        if (nested.definition) textParts.push(nested.definition);
        if (!example) example = nested.example;
      }
    }
  }
  return { definition: cleanMwText(textParts.join(" ")), example };
}

function normalizeHeadword(entry: MwEntry): string {
  const hw = entry.hwi?.hw ?? entry.meta?.id ?? "";
  return hw.replace(/\*/g, "").replace(/:.*$/, "").toLowerCase();
}

function extractMerriamWebster(data: MwEntry[], word: string): WordDetails | null {
  const entries = data.filter(
    (e): e is MwEntry => typeof e === "object" && e !== null && Array.isArray(e.def)
  );
  const matches = entries.filter(
    (e) => normalizeHeadword(e) === word || e.meta?.stems?.includes(word)
  );
  // Prefer an exact-headword entry (e.g. "run" over the phrase "for example").
  matches.sort(
    (a, b) => Number(normalizeHeadword(b) === word) - Number(normalizeHeadword(a) === word)
  );

  const senses: WordSense[] = [];
  let phoneticText: string | undefined;
  for (const entry of matches) {
    const prs = entry.hwi?.prs?.[0];
    if (!phoneticText && (prs?.ipa || prs?.mw)) phoneticText = prs.ipa ?? prs.mw;
    const senseObjs: Record<string, unknown>[] = [];
    for (const block of entry.def ?? []) collectMwSenses(block.sseq, senseObjs);
    for (const sense of senseObjs) {
      const { definition, example } = readMwDt(sense.dt);
      if (definition) senses.push({ definition, partOfSpeech: entry.fl, example });
      if (senses.length >= MAX_SENSES) break;
    }
    if (senses.length >= MAX_SENSES) break;
  }

  const primary = senses[0];
  if (!primary) return null;
  return {
    word,
    definition: primary.definition,
    partOfSpeech: primary.partOfSpeech,
    example: primary.example,
    phoneticText,
    senses,
  };
}

function lookupMerriamWebster(reference: string, key: string) {
  return async function (word: string): Promise<SourceResult> {
    try {
      const res = await fetch(
        `https://dictionaryapi.com/api/v3/references/${reference}/json/${encodeURIComponent(
          word
        )}?key=${key}`,
        { cache: "no-store" }
      );
      if (!res.ok) return { error: "network_error" };
      const data = (await res.json()) as unknown;
      // A miss returns an array of spelling suggestions (strings) or [].
      if (!Array.isArray(data) || typeof data[0] !== "object") return { error: "not_found" };
      const details = extractMerriamWebster(data as MwEntry[], word);
      return details ? { details } : { error: "not_found" };
    } catch {
      return { error: "network_error" };
    }
  };
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
  const senses: WordSense[] = (entry.defs ?? [])
    .map((def): WordSense | null => {
      const [posAbbr, ...rest] = def.split("\t");
      const definition = rest.join("\t").trim();
      if (!definition) return null;
      return { definition, partOfSpeech: DATAMUSE_POS_MAP[posAbbr] };
    })
    .filter((sense): sense is WordSense => sense !== null)
    .slice(0, MAX_SENSES);
  const primary = senses[0];
  if (!primary) return null;

  return {
    word,
    definition: primary.definition,
    partOfSpeech: primary.partOfSpeech,
    senses,
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

// Tried in order; the first source with a definition wins. Merriam-Webster
// (learner-friendly, keyed) leads when configured, then free sources. Add more
// sources here (same SourceResult shape) to extend the fallback chain.
const SOURCES = [
  process.env.MW_LEARNERS_KEY &&
    lookupMerriamWebster("learners", process.env.MW_LEARNERS_KEY),
  process.env.MW_INTERMEDIATE_KEY &&
    lookupMerriamWebster("sd3", process.env.MW_INTERMEDIATE_KEY),
  lookupFreeDictionary,
  lookupDatamuse,
].filter((s): s is (word: string) => Promise<SourceResult> => Boolean(s));

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
