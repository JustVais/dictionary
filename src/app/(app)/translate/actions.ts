"use server";

import { requireUser } from "@/lib/auth-guard";
import { lookupWord, type WordDetails } from "@/lib/dictionary";
import { isRussian, translateRuToEn } from "@/lib/translate";
import { getWordForms } from "@/lib/word-forms";

export type LookupActionResult =
  | {
      ok: true;
      details: WordDetails;
      forms: string[];
      /** Set when the input was Russian: the original query, shown as "слово → word". */
      sourceWord?: string;
    }
  | { ok: false; reason: string };

export async function lookupWordAction(
  word: string
): Promise<LookupActionResult> {
  await requireUser();
  const trimmed = word.trim();
  if (!trimmed) return { ok: false, reason: "Enter a word to look up" };

  let query = trimmed;
  let sourceWord: string | undefined;
  if (isRussian(trimmed)) {
    const translation = await translateRuToEn(trimmed);
    if (!translation.ok) {
      return {
        ok: false,
        reason:
          translation.reason === "not_found"
            ? "Couldn't translate that word"
            : "Translation failed. Please try again.",
      };
    }
    query = translation.translated;
    sourceWord = trimmed;
  }

  const result = await lookupWord(query);
  if (!result.ok) {
    // The dictionary has no entry, but for Russian input the translation
    // itself is still useful — return it with no definition.
    if (sourceWord && result.reason === "not_found") {
      return {
        ok: true,
        details: { word: query },
        forms: getWordForms(query),
        sourceWord,
      };
    }
    return {
      ok: false,
      reason:
        result.reason === "not_found"
          ? "No definition found for that word"
          : "Something went wrong. Please try again.",
    };
  }

  return {
    ok: true,
    details: result.details,
    forms: getWordForms(result.details.word, result.details.partOfSpeech),
    sourceWord,
  };
}
