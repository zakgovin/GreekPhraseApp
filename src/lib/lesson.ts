import { normalize, phrases } from "./content";

export type ExerciseKind = "assemble" | "complete" | "recall";
export type AnswerMethod = "words" | "text" | "speech";
export interface LessonExercise {
  kind: ExerciseKind;
  words: string[];
  options: { id: number; text: string }[];
  missing: number;
}
const alternatives: Record<string, string[]> = {
  "a2-001": ["Ονομάζομαι Ζαχάρ.", "Το όνομά μου είναι Ζαχάρ."],
  "a2-002": ["Είμαι 37 χρονών.", "Είμαι τριάντα επτά ετών.", "Είμαι 37 ετών."],
  "a2-006": [
    "Τώρα ζω στη Λάρνακα, στην Κύπρο.",
    "Τώρα μένω στη Λάρνακα της Κύπρου.",
  ],
  "a2-007": ["Ζω μόνος μου.", "Μένω μόνος."],
  "a2-009": ["Έχω έναν αδερφό."],
  "a2-010": ["Ο αδερφός μου μένει στο Μπλαγκοβέστσενσκ."],
  "a2-011": ["Εργάζομαι ως σχεδιαστής βιντεοπαιχνιδιών."],
  "a2-012": [
    "Εργάζομαι στην εταιρεία Gaijin.",
    "Δουλεύω στη Gaijin.",
    "Εργάζομαι στη Gaijin.",
  ],
  "a2-013": ["Μου αρέσει το διάβασμα βιβλίων."],
  "a2-019": ["Πίνω συνήθως τσάι."],
  "a2-020": ["Θα ήθελα τσάι χωρίς ζάχαρη, παρακαλώ."],
  "a2-025": ["Δεν ανάβει."],
  "a2-034": ["Σας ευχαριστώ πολύ για τη βοήθειά σας."],
  "a2-049": ["Δεν νιώθω καλά."],
  "a2-065": ["Είμαι καλύτερα τώρα."],
};

// Curated alternatives for short conversational answers. This is deliberately
// finite: a matcher must not pretend to understand unrestricted Greek speech.
const conversationAlternatives: Record<string, string[]> = {
  "Με λένε Ζαχάρ και είμαι τριάντα επτά χρονών.": [
    "Ονομάζομαι Ζαχάρ και είμαι 37 χρονών.",
    "Με λένε Ζαχάρ. Είμαι 37 ετών.",
  ],
  "Είμαι από το Μπλαγκοβέστσενσκ, στη ρωσική Άπω Ανατολή.": [
    "Είμαι από το Μπλαγκοβέστσενσκ, στη Ρωσία.",
    "Είμαι από το Μπλαγκοβέστσενσκ, στην Άπω Ανατολή της Ρωσίας.",
  ],
  "Τώρα μένω στη Λάρνακα, στην Κύπρο. Μένω μόνος μου.": [
    "Μένω στη Λάρνακα, στην Κύπρο.",
    "Τώρα μένω στη Λάρνακα, στην Κύπρο.",
    "Ζω στη Λάρνακα, στην Κύπρο.",
  ],
};

export function answerKey(value: string) {
  return normalize(value)
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(^|\s)τριαντα επτα(?=\s|$)/gu, (_, space: string) => space + "37")
    .replace(/\s+/g, " ")
    .trim();
}
export function matchesPhrase(
  expected: string,
  answer: string,
  cardId?: string,
) {
  const key = answerKey(answer);
  return (
    Boolean(key) &&
    [
      expected,
      ...(cardId ? (alternatives[cardId] ?? []) : []),
      ...(conversationAlternatives[expected] ?? []),
    ].some((variant) => answerKey(variant) === key)
  );
}
export const phraseWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean);
function hash(value: string) {
  let result = 2166136261;
  for (const character of value)
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function shuffled<T>(values: T[], seed: string) {
  let state = hash(seed);
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const stopWords = new Set(
  "ο η το τα οι του της των στη στην στο στον στα σε και να για με μου σου σας μας μια ένα έναν θα δεν από πως τι που"
    .split(" ")
    .map(answerKey),
);
const vocabulary = [
  ...new Set(
    phrases
      .flatMap((phrase) => phraseWords(phrase.el))
      .map((word) => word.replace(/[.,;!?·]/g, "")),
  ),
];

export function lessonExercise(
  text: string,
  kind: ExerciseKind,
  seed: string,
): LessonExercise {
  const words = phraseWords(text);
  const candidates = words
    .map((word, index) => ({ word, index }))
    .filter(
      ({ word }) =>
        answerKey(word).length >= 3 && !stopWords.has(answerKey(word)),
    );
  const chosen = candidates.length
    ? candidates[hash(seed) % candidates.length]
    : { word: words[0], index: 0 };
  const target = chosen.word.replace(/[.,;!?·]/g, "");
  const cardId = phrases.find((phrase) => phrase.el === text)?.id;
  const distractors = shuffled(
    vocabulary.filter(
      (word) =>
        answerKey(word) !== answerKey(target) &&
        answerKey(word).length >= 3 &&
        !matchesPhrase(
          text,
          words
            .map((value, index) => (index === chosen.index ? word : value))
            .join(" "),
          cardId,
        ),
    ),
    seed + ":options",
  ).slice(0, 2);
  const options =
    kind === "complete"
      ? shuffled(
          [target, ...distractors].map((word, id) => ({ id, text: word })),
          seed,
        )
      : shuffled(
          words.map((word, id) => ({ id, text: word })),
          seed,
        );
  return { kind, words, options, missing: chosen.index };
}

export function checkLessonAnswer(
  expected: string,
  exercise: LessonExercise,
  answer: string,
  method: AnswerMethod,
  cardId: string,
) {
  return exercise.kind === "complete" && method === "words"
    ? matchesPhrase(
        expected,
        exercise.words
          .map((word, index) => (index === exercise.missing ? answer : word))
          .join(" "),
        cardId,
      )
    : matchesPhrase(expected, answer, cardId);
}
