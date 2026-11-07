import { describe, expect, it } from "vitest";
import { family, phraseById } from "./content";
import { lessonExercise } from "./lesson";
import {
  adaptivePlan,
  advanceLearning,
  continueLesson,
  createSession,
  emptyProgress,
  exerciseFor,
  helpLesson,
  memoryKey,
  newDraft,
  parseProgress,
  pauseSession,
  rateSession,
  resumeSession,
  revealAnswer,
  submitLessonAnswer,
  type Progress,
} from "./progress";
const start = new Date("2026-11-07T09:00:00Z");
function recall(p: Progress, at = start, id?: string) {
  p = {
    ...p,
    session: createSession(
      p,
      at,
      id ? { cardId: id, skill: "phrase" } : undefined,
    ),
  };
  while (p.session!.items[p.session!.index]?.phase === "learn")
    p = advanceLearning(p, p.session!.id, p.session!.index, at);
  return p;
}
function answer(
  p: Progress,
  correct: boolean,
  at: Date,
  method: "words" | "text" = "words",
) {
  const s = p.session!,
    item = s.items[s.index],
    card = phraseById[item.cardId];
  const task = lessonExercise(
    card.el,
    item.exercise ?? "assemble",
    s.id + ":" + s.index,
  );
  const text = correct
    ? task.kind === "complete" && method === "words"
      ? task.words[task.missing]
      : card.el
    : "λάθος απάντηση";
  return continueLesson(submitLessonAnswer(p, text, method, at), at);
}
function round(p: Progress, correct: boolean) {
  p = recall(p);
  let tick = 0;
  while (!p.session!.completedAt) {
    const s = p.session!;
    if (s.items[s.index].phase === "learn")
      p = advanceLearning(p, s.id, s.index, start);
    else p = answer(p, correct, new Date(start.getTime() + ++tick * 20000));
  }
  return p;
}

describe("Adaptive lessons without manual limits or self-grades", () => {
  it("starts a small lesson and continues beyond the old three-per-day limit", () => {
    const p = emptyProgress();
    expect(adaptivePlan(p, start).fresh).toHaveLength(5);
    const low = { ...p, settings: { ...p.settings, dailyNew: 1, minutes: 5 } };
    const high = {
      ...p,
      settings: { ...p.settings, dailyNew: 10, minutes: 45 },
    };
    expect(adaptivePlan(low, start).fresh).toEqual(
      adaptivePlan(high, start).fresh,
    );
    const done = round(p, true);
    expect(new Set(done.reviews.map((review) => review.cardId)).size).toBe(5);
    expect(
      createSession(done, new Date(start.getTime() + 120000)).items.some(
        (item) => item.isNew,
      ),
    ).toBe(true);
  });
  it("uses observed results to add less new material after mistakes and more after steady success", () => {
    const comfortable = round(emptyProgress(), true),
      difficult = round(emptyProgress(), false);
    expect(adaptivePlan(comfortable, start).targetNew).toBeGreaterThan(
      adaptivePlan(difficult, start).targetNew,
    );
    expect(adaptivePlan(difficult, start).targetNew).toBe(2);
    expect(adaptivePlan(comfortable, start).reason).not.toContain(
      "дневной лимит",
    );
  });
  it("stores checked feedback before advancing and makes repeated taps harmless", () => {
    let p = recall(emptyProgress(), start, "a2-001");
    p = submitLessonAnswer(
      p,
      "Με λένε Ζαχάρ.",
      "text",
      new Date(start.getTime() + 15000),
    );
    expect(p.session!.feedback?.correct).toBe(true);
    expect(p.reviews).toHaveLength(0);
    const restored = parseProgress(JSON.stringify(p));
    expect(restored.session!.feedback).toEqual(p.session!.feedback);
    const graded = continueLesson(restored, new Date(start.getTime() + 16000));
    expect(graded.reviews).toHaveLength(1);
    expect(graded.reviews[0].rating).toBe(3);
    expect(graded.reviews[0].evidence).toBe("guided");
    expect(continueLesson(graded)).toBe(graded);
  });
  it("distinguishes scaffolded answers, hints and independent answers", () => {
    const seed = recall(emptyProgress(), start, "a2-001");
    const guided = answer(seed, true, start);
    expect(guided.reviews[0].evidence).toBe("guided");
    const helped = continueLesson(helpLesson(seed, start), start);
    expect(helped.reviews[0].rating).toBe(1);
    expect(helped.reviews[0].assisted).toBe(true);
    expect(helped.reviews[0].evidence).toBe("guided");
    expect(helped.memory[memoryKey("a2-001", "phrase")].dueAt).not.toEqual(
      guided.memory[memoryKey("a2-001", "phrase")].dueAt,
    );
  });
  it("returns a missed phrase only after other phrases and bounds remedial retries", () => {
    let p = recall(emptyProgress());
    const failed = p.session!.items[p.session!.index];
    p = answer(p, false, new Date(start.getTime() + 12000));
    const retry = p.session!.items.findIndex(
      (item) => item.retry && item.cardId === failed.cardId,
    );
    expect(retry).toBeGreaterThanOrEqual(p.session!.index + 2);
    const between = p.session!.items.slice(p.session!.index, retry);
    expect(
      between.filter(
        (item) =>
          item.phase === "recall" &&
          family(item.cardId) !== family(failed.cardId),
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(p.session!.items[retry].practiceOnly).toBe(true);
    const finished = round(emptyProgress(), false);
    expect(
      finished.reviews.filter((review) => review.retry).length,
    ).toBeLessThanOrEqual(5);
  });
  it("does not postpone scheduled repetition after an optional early rehearsal", () => {
    let p = answer(
      recall(emptyProgress(), start, "a2-001"),
      true,
      start,
      "text",
    );
    const key = memoryKey("a2-001", "phrase"),
      before = { ...p.memory[key] };
    p = recall(p, new Date(start.getTime() + 1000), "a2-001");
    expect(p.session!.items[p.session!.index].practiceOnly).toBe(true);
    p = answer(p, true, new Date(start.getTime() + 5000));
    expect(p.memory[key]).toEqual(before);
    expect(p.reviews.at(-1)!.scheduled).toBe(false);
  });
  it("does not mistake time in the background for slow learning", () => {
    let p = recall(emptyProgress(), start, "a2-001");
    p = {
      ...p,
      session: pauseSession(p.session!, new Date(start.getTime() + 10000)),
    };
    p = {
      ...p,
      session: resumeSession(p.session!, new Date(start.getTime() + 3600000)),
    };
    p = submitLessonAnswer(
      p,
      "Με λένε Ζαχάρ.",
      "text",
      new Date(start.getTime() + 3605000),
    );
    expect(p.session!.feedback!.responseMs).toBe(15000);
  });
  it("progresses across days and backs off after a failed independent answer", () => {
    let p = emptyProgress();
    let at = start;
    for (let day = 0; day < 3; day++) {
      p = answer(recall(p, at, "a2-001"), true, at, "text");
      at = new Date(
        Math.max(
          at.getTime() + 86400000,
          Date.parse(p.memory["a2-001:phrase"].dueAt),
        ),
      );
    }
    expect(exerciseFor(p, "a2-001")).toBe("recall");
    p = answer(recall(p, at, "a2-001"), true, at, "text");
    expect(p.reviews.at(-1)!.evidence).toBe("independent");
    const later = new Date(Date.parse(p.memory["a2-001:phrase"].dueAt));
    p = answer(recall(p, later, "a2-001"), false, later, "text");
    expect(exerciseFor(p, "a2-001")).toBe("assemble");
  });
  it("preserves old history, native-compatible schema and scheduling when upgrading 0.2.1", () => {
    let legacy = emptyProgress();
    legacy = {
      ...legacy,
      session: createSession(legacy, start, {
        cardId: "a2-001",
        skill: "speaking",
      }),
    };
    legacy = advanceLearning(legacy, legacy.session!.id, 0, start);
    legacy = rateSession(
      revealAnswer(legacy),
      legacy.session!.id,
      legacy.session!.index,
      3,
      start,
    );
    const raw = JSON.parse(JSON.stringify(legacy));
    raw.drafts.introduction = {
      ...newDraft(),
      turn: 1,
      ratings: [3],
      shown: true,
      text: "Είμαι από τη Ρωσία.",
    };
    delete raw.adaptiveVersion;
    raw.settings = { dailyNew: 3, minutes: 15, speechRate: 0.85 };
    const upgraded = parseProgress(JSON.stringify(raw));
    expect(upgraded.reviews).toEqual(legacy.reviews);
    expect(upgraded.memory["a2-001:speaking"]).toEqual(
      legacy.memory["a2-001:speaking"],
    );
    expect(upgraded.memory["a2-001:phrase"].dueAt).toBe(
      legacy.memory["a2-001:speaking"].dueAt,
    );
    expect(upgraded.memory["a2-001:phrase"].origin).toBe("legacy");
    expect(upgraded.version).toBe(1);
    expect(upgraded.drafts.introduction).toMatchObject({
      turn: 1,
      ratings: [3],
      shown: false,
      text: "Είμαι από τη Ρωσία.",
      answers: { legacy: "yes" },
    });
    expect(parseProgress(JSON.stringify(upgraded))).toEqual(upgraded);
  });
});
