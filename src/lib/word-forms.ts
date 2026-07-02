import nlp from "compromise";

/**
 * Inflected forms of a word (verb conjugations, noun plural, adjective
 * comparative/superlative), generated locally — no API. Returns [] for
 * phrases or parts of speech without inflections.
 */
export function getWordForms(
  word: string,
  partOfSpeech?: string | null
): string[] {
  const base = word.trim().toLowerCase();
  if (!base || base.includes(" ")) return [];

  const forms: string[] = [];
  const add = (form?: string) => {
    const f = form?.trim().toLowerCase();
    if (f && f !== base && !forms.includes(f)) forms.push(f);
  };

  const doc = nlp(base);
  switch (partOfSpeech?.toLowerCase()) {
    case "verb": {
      doc.tag("Verb");
      const [conj] = doc.verbs().conjugate() as Array<Record<string, string>>;
      if (conj) {
        add(conj.PresentTense);
        add(conj.PastTense);
        add(conj.Participle);
        add(conj.Gerund);
      }
      break;
    }
    case "noun": {
      doc.tag("Noun");
      add(doc.nouns().toPlural().text());
      break;
    }
    case "adjective": {
      doc.tag("Adjective");
      const [conj] = doc.adjectives().conjugate() as Array<
        Record<string, string>
      >;
      if (conj) {
        add(conj.Comparative);
        add(conj.Superlative);
      }
      break;
    }
  }
  return forms;
}
