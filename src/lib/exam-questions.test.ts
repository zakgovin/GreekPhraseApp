import { describe, it, expect } from "vitest";
import data from "../data/exam-questions.json";
import { family, phraseById, phrases, sources } from "./content";
import { lessonExercise, wordTile, checkLessonAnswer } from "./lesson";
import {
  checkQuestionAnswer,
  examQuestions,
  questionAnswer,
  questionBlock,
} from "./exam-questions";
import { emptyProgress, parseProgress } from "./progress";

describe("Personal examiner questions", () => {
  it("covers all 38 numbered questions with complete supported answers", () => {
    expect(examQuestions.map((q) => q.number)).toEqual(
      Array.from({ length: 38 }, (_, i) => i + 1),
    );
    expect(new Set(examQuestions.map((q) => q.id)).size).toBe(38);
    expect(new Set(examQuestions.map((q) => q.el)).size).toBe(38);
    for (const q of examQuestions) {
      expect(q.cardIds.length).toBeGreaterThan(0);
      for (const id of q.cardIds) expect(phraseById[id]).toBeDefined();
      const answer = questionAnswer(q);
      expect(answer).not.toMatch(/_{2,}|\.\.\.|\{.+\}/u);
      expect(checkQuestionAnswer(q, answer)).toBe(true);
      const exercise = lessonExercise(answer, "assemble", q.id);
      expect(checkQuestionAnswer(q, exercise.tiles.join(" "))).toBe(true);
      expect(new Set(exercise.options.map((o) => o.id)).size).toBe(
        exercise.words.length,
      );
    }
  });
  it("reuses existing cards and keeps the new source separate from official exam PDFs", () => {
    expect(data.cards).toHaveLength(35);
    expect(
      examQuestions.filter((q) =>
        q.cardIds.every((id) => Number(id.slice(3)) <= 122),
      ).length,
    ).toBe(17);
    expect(sources[data.source.id]).toMatchObject({
      kind: "user_list",
      year: null,
      file: null,
      pdf_page: null,
    });
    expect(new Set(phrases.map((card) => card.el)).size).toBe(phrases.length);
    expect(family("a2-123")).toBe(family("a2-106"));
    for (const word of data.properWords)
      expect(wordTile(word + ".")).toBe(word);
  });
  it("uses the supplied facts without conflating product and project work or adding sport and TV habits", () => {
    const answer = (number: number) =>
      questionAnswer(examQuestions[number - 1]);
    expect(answer(3)).toContain("Νοέμβριο του 2023");
    expect(answer(10)).toContain("πρώτο όροφο, πάνω από το ισόγειο");
    expect(answer(10)).toContain("τρία δωμάτια");
    expect(answer(17)).toContain("προϊόντων πληροφορικής");
    expect(answer(20)).toContain("τρίτη χρονιά");
    expect(answer(29)).toContain("Δεν κάνω κάποιο άθλημα");
    expect(answer(30)).toContain("κάθε τρεις μήνες");
    expect(answer(35)).toBe("Μαθαίνω τα νέα από φίλους και γνωστούς.");
    expect(answer(38)).toContain("Δεν βλέπω μαγειρικές εκπομπές");
  });
  it("starts a bounded new block and moves to unpractised questions after restoring history", () => {
    const p = emptyProgress();
    expect(questionBlock(p)).toEqual(["exam-q-01", "exam-q-02", "exam-q-03"]);
    p.practice = questionBlock(p).map((id) => ({
      id: crypto.randomUUID(),
      taskId: id,
      skill: "phrase",
      at: "2026-11-07T10:00:00Z",
      assisted: true,
      checked: true,
      correct: 1,
      total: 1,
    }));
    const restored = parseProgress(JSON.stringify(p));
    expect(questionBlock(restored)).toEqual([
      "exam-q-04",
      "exam-q-05",
      "exam-q-06",
    ]);
    expect(restored.memory).toEqual({});
  });
  it("accepts known personal alternatives and rejects incorrect facts and negations", () => {
    expect(checkQuestionAnswer(examQuestions[0], "Ονομάζομαι Ζαχάρ.")).toBe(
      true,
    );
    expect(checkQuestionAnswer(examQuestions[0], "Δεν με λένε Ζαχάρ.")).toBe(
      false,
    );
    expect(checkQuestionAnswer(examQuestions[8], "Μένω σε σπίτι.")).toBe(false);
    const question = examQuestions[9],
      task = lessonExercise(questionAnswer(question), "assemble", "housing");
    expect(
      checkLessonAnswer(
        questionAnswer(question),
        task,
        task.tiles.join(" "),
        "words",
        question.cardIds[0],
      ),
    ).toBe(true);
  });
});
