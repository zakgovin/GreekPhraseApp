import { describe, expect, it } from "vitest";
import {
  phrases,
  sources,
  defaultSkill,
  family,
  normalize,
  wordCount,
} from "./content";
import {
  advanceLearning,
  createSession,
  dailyCandidates,
  dayKey,
  dueItems,
  emptyProgress,
  exportProgress,
  getStats,
  loadProgress,
  memoryKey,
  parseProgress,
  rateSession,
  revealAnswer,
  STORAGE_KEY,
  type Progress,
} from "./progress";
import { checkListening } from "./exercises";
import { listeningTasks } from "../data/curriculum";
const now = new Date("2026-11-03T10:00:00Z");
function attempt(
  id: string,
  skill: "speaking" | "writing" | "understanding" = "speaking",
  grade = 3,
  p = emptyProgress(),
  at = now,
) {
  let next: Progress = {
    ...p,
    session: createSession(p, at, { cardId: id, skill }),
  };
  while (next.session!.items[next.session!.index]?.phase === "learn")
    next = advanceLearning(next, next.session!.id, next.session!.index, at);
  next = revealAnswer(next);
  return rateSession(next, next.session!.id, next.session!.index, grade, at);
}
function complete(p: Progress) {
  let next = p;
  while (next.session && !next.session.completedAt) {
    const s = next.session;
    if (s.items[s.index].phase === "learn")
      next = advanceLearning(next, s.id, s.index, now);
    else next = rateSession(revealAnswer(next), s.id, s.index, 3, now);
  }
  return next;
}
describe("Reviewed content and exercise semantics", () => {
  it("preserves 122 unique cards, 45 personal cards and valid source references", () => {
    expect(phrases).toHaveLength(122);
    expect(phrases.filter((c) => c.kind === "personal")).toHaveLength(45);
    expect(new Set(phrases.map((c) => c.id)).size).toBe(122);
    for (const c of phrases) {
      expect(c.el).not.toMatch(/…|\.{3}|_{2,}/);
      for (const id of c.sources) expect(sources[id]).toBeDefined();
    }
  });
  it("finds Greek without accents and treats final sigma consistently", () => {
    expect(normalize("ΓΕΙΤΟΝΙΆ")).toBe(normalize("γειτονιά"));
    expect(normalize("κόσμος")).toBe(normalize("κοσμοσ"));
  });
  it("counts Greek words with punctuation and apostrophes without counting punctuation", () => {
    expect(wordCount("Γεια σου, Ζαχάρ! Είμαι 37 χρονών.")).toBe(6);
    expect(wordCount("Απ’ όλα — και\nλίγο-λίγο.")).toBe(4);
    expect(wordCount("  … ; ! ")).toBe(0);
  });
  it("accepts meaningful audio-answer variants but rejects a negated or wrong answer", () => {
    const t = listeningTasks[0];
    const answers = Object.fromEntries(t.fields.map((f) => [f.id, f.display]));
    expect(
      checkListening(t.fields, {
        ...answers,
        date: "06/12",
        city: "ΣΤΗΝ ΑΘΗΝΑ",
        price: "εβδομηντα ευρω",
      }).every((r) => r.correct),
    ).toBe(true);
    expect(
      checkListening(t.fields, {
        ...answers,
        price: "700 ευρώ",
        city: "Δεν είναι Αθήνα",
      })
        .filter((r) => !r.correct)
        .map((r) => r.id),
    ).toEqual(["city", "price"]);
  });
});
describe("FSRS history and truthful progress", () => {
  it("does not count introductions or an answer not yet revealed as a review", () => {
    let p = emptyProgress();
    p.session = createSession(p, now);
    expect(p.session.items[0].phase).toBe("learn");
    const unchanged = rateSession(p, p.session.id, 0, 3, now);
    expect(unchanged).toBe(p);
    p = advanceLearning(p, p.session.id, 0, now);
    expect(p.reviews).toHaveLength(0);
    expect(getStats(p, now).introduced).toBe(0);
  });
  it("uses the FSRS library to schedule dates and preserves states in a JSON round trip", () => {
    const failed = attempt("a2-001", "speaking", 1),
      good = attempt("a2-001");
    const key = memoryKey("a2-001", "speaking");
    expect(Date.parse(failed.memory[key].dueAt)).toBeGreaterThan(now.getTime());
    expect(Date.parse(good.memory[key].dueAt)).toBeGreaterThan(
      Date.parse(failed.memory[key].dueAt),
    );
    expect(parseProgress(exportProgress(good))).toEqual(good);
  });
  it("keeps the three skill memories independent", () => {
    let p = attempt("a2-001", "speaking");
    const speaking = { ...p.memory[memoryKey("a2-001", "speaking")] };
    p = attempt("a2-001", "writing", 1, p);
    expect(p.memory[memoryKey("a2-001", "speaking")]).toEqual(speaking);
    expect(p.memory[memoryKey("a2-001", "writing")].reps).toBe(1);
    expect(p.memory[memoryKey("a2-001", "understanding")]).toBeUndefined();
  });
  it("makes a double-click idempotent and keeps a hint from becoming a passing grade", () => {
    let p = emptyProgress();
    p.session = createSession(p, now, { cardId: "a2-001", skill: "speaking" });
    p = advanceLearning(p, p.session.id, 0, now);
    const { id, index } = p.session!;
    p = revealAnswer(p, true);
    p = rateSession(p, id, index, 4, now);
    const once = p;
    p = rateSession(p, id, index, 4, now);
    expect(p).toBe(once);
    expect(p.reviews).toHaveLength(1);
    expect(p.reviews[0].rating).toBe(1);
    expect(p.reviews[0].assisted).toBe(true);
    expect(getStats(p, now).correctToday).toBe(0);
  });
  it("does not call a first or immediate repeat delayed recall", () => {
    let p = attempt("a2-001");
    p = attempt("a2-001", "speaking", 3, p, new Date(now.getTime() + 600000));
    expect(getStats(p, now).delayedCount).toBe(0);
    p = attempt(
      "a2-001",
      "speaking",
      3,
      p,
      new Date(now.getTime() + 2 * 86400000),
    );
    expect(getStats(p, now).delayedCount).toBe(1);
  });
});
describe("Daily queue and recovery", () => {
  it("gives three new families and respects the daily limit on restart", () => {
    let p = emptyProgress();
    p.session = createSession(p, now);
    const recalls = p.session.items.filter((i) => i.phase === "recall");
    expect(recalls).toHaveLength(3);
    expect(new Set(recalls.map((i) => family(i.cardId))).size).toBe(3);
    p = complete(p);
    expect(dailyCandidates(p, now).remaining).toBe(0);
    expect(createSession(p, now).items).toHaveLength(0);
  });
  it("buries close new phrases from a family already reviewed today", () => {
    const p = attempt("a2-003");
    const ids = dailyCandidates(p, now).newCards.map((c) => c.id);
    expect(ids).not.toContain("a2-004");
    expect(ids).not.toContain("a2-005");
  });
  it("spends a short session on due items before adding new ones", () => {
    let p = emptyProgress();
    const selected = phrases
      .filter(
        (c, i, all) =>
          all.findIndex((p1) => family(p1.id) === family(c.id)) === i,
      )
      .slice(0, 10);
    for (const c of selected) p = attempt(c.id, defaultSkill(c), 1, p);
    p.settings.minutes = 5;
    const tomorrow = new Date(now.getTime() + 86400000);
    expect(dueItems(p, tomorrow)).toHaveLength(10);
    const s = createSession(p, tomorrow);
    expect(s.items.length).toBeGreaterThan(0);
    expect(s.items.every((i) => !i.isNew && i.phase === "recall")).toBe(true);
  });
  it("uses the client day, including a timezone boundary", () => {
    expect(dayKey("2026-11-03T21:01:00Z", "Europe/Moscow")).toBe("2026-11-04");
    expect(dayKey("2026-11-03T21:01:00Z", "UTC")).toBe("2026-11-03");
  });
  it("rejects malformed imports without modifying the existing progress", () => {
    const p = attempt("a2-001"),
      before = JSON.stringify(p),
      bad = JSON.parse(exportProgress(p));
    bad.progress.session.items[0].cardId = "not-a-card";
    expect(() => parseProgress(JSON.stringify(bad))).toThrow();
    expect(JSON.stringify(p)).toBe(before);
    const badDate = JSON.parse(exportProgress(p));
    badDate.progress.memory["a2-001:speaking"].dueAt = "not-a-date";
    expect(() => parseProgress(JSON.stringify(badDate))).toThrow();
  });
  it("retains a recovery copy of corrupted saved data and handles blocked storage", () => {
    const map = new Map([[STORAGE_KEY, "broken json"]]);
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const loaded = loadProgress(storage);
    expect(loaded.warning).toContain("копия");
    expect(
      [...map.keys()].some((k) => k.startsWith(STORAGE_KEY + ".recovery.")),
    ).toBe(true);
    expect(map.get(STORAGE_KEY)).toBe("broken json");
    expect(
      loadProgress({
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {},
      }).warning,
    ).toContain("недоступно");
  });
});
