import { describe, expect, it } from "vitest";
import { phrases } from "./content";
import {
  answerKey,
  checkLessonAnswer,
  lessonExercise,
  matchesPhrase,
} from "./lesson";

describe("Automatic language exercises", () => {
  it("provides a complete, stable word bank for all reviewed phrases, including repeated words", () => {
    for (const card of phrases) {
      const task = lessonExercise(card.el, "assemble", card.id);
      expect(task).toEqual(lessonExercise(card.el, "assemble", card.id));
      expect(new Set(task.options.map((option) => option.id)).size).toBe(
        task.words.length,
      );
      expect(
        [...task.options]
          .sort((a, b) => a.id - b.id)
          .map((option) => option.text),
      ).toEqual(task.words);
      expect(
        checkLessonAnswer(
          card.el,
          task,
          task.words.join(" "),
          "words",
          card.id,
        ),
      ).toBe(true);
    }
  });
  it("makes every missing-word question answerable and rejects unrelated words", () => {
    for (const card of phrases) {
      const task = lessonExercise(card.el, "complete", card.id);
      expect(task.options).toHaveLength(3);
      expect(
        task.options.filter((option) =>
          checkLessonAnswer(card.el, task, option.text, "words", card.id),
        ),
      ).toHaveLength(1);
      expect(checkLessonAnswer(card.el, task, "λάθος", "words", card.id)).toBe(
        false,
      );
    }
  });
  it("accepts reviewed alternatives and speech-style numbers without accepting negations or wrong facts", () => {
    expect(matchesPhrase("Με λένε Ζαχάρ.", "ΟΝΟΜΑΖΟΜΑΙ ΖΑΧΑΡ", "a2-001")).toBe(
      true,
    );
    expect(
      matchesPhrase("Είμαι τριάντα επτά χρονών.", "Είμαι 37 χρονών.", "a2-002"),
    ).toBe(true);
    expect(
      matchesPhrase("Με λένε Ζαχάρ.", "Δεν με λένε Ζαχάρ.", "a2-001"),
    ).toBe(false);
    expect(
      matchesPhrase("Είμαι τριάντα επτά χρονών.", "Είμαι 38 χρονών.", "a2-002"),
    ).toBe(false);
    expect(matchesPhrase("Δεν έχω παιδιά.", "Έχω παιδιά.", "a2-008")).toBe(
      false,
    );
    expect(answerKey("  Μένω, στη ΛΆΡΝΑΚΑ!  ")).toBe(
      answerKey("μένω στη λαρνακα"),
    );
  });
  it("accepts concise reviewed conversational answers without changing personal facts", () => {
    const from = "Είμαι από το Μπλαγκοβέστσενσκ, στη ρωσική Άπω Ανατολή.";
    expect(
      matchesPhrase(from, "Είμαι από το Μπλαγκοβέστσενσκ, στη Ρωσία."),
    ).toBe(true);
    expect(
      matchesPhrase(from, "Είμαι από το Μπλαγκοβέστσενσκ, στην Κύπρο."),
    ).toBe(false);
    expect(
      matchesPhrase(
        "Τώρα μένω στη Λάρνακα, στην Κύπρο. Μένω μόνος μου.",
        "Μένω στη Λάρνακα, στην Κύπρο.",
      ),
    ).toBe(true);
  });
});
