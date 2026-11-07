import {
  DefaultScheduler,
  Rating,
  type DefaultSchedulerCard,
  type Grade,
} from "ts-fsrs";
import { z } from "zod";
import { family, initialOrder, phraseById, type Skill } from "./content";
import { conversations } from "../data/curriculum";
import {
  checkLessonAnswer,
  lessonExercise,
  type ExerciseKind,
  type AnswerMethod,
} from "./lesson";

const scheduler = await DefaultScheduler({
  version: "FSRS-6",
  desiredRetention: 0.9,
  enableFuzz: false,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
});
export type Memory = Omit<
  DefaultSchedulerCard<"FSRS-6">,
  "dueAt" | "lastReviewAt"
> & {
  dueAt: string;
  lastReviewAt: string | null;
  origin?: "legacy" | "automatic";
};
export interface Review {
  id: string;
  cardId: string;
  skill: Skill;
  at: string;
  rating: number;
  assisted: boolean;
  isNew: boolean;
  previousAt: string | null;
  nextAt: string;
  engineLog: Record<string, unknown>;
  method?: AnswerMethod;
  evidence?: "guided" | "independent";
  responseMs?: number;
  task?: ExerciseKind;
  scheduled?: boolean;
  retry?: boolean;
}
export interface SessionItem {
  cardId: string;
  skill: Skill;
  phase: "learn" | "recall";
  isNew: boolean;
  exercise?: ExerciseKind;
  retry?: boolean;
  practiceOnly?: boolean;
}
export interface LessonFeedback {
  answer: string;
  method: AnswerMethod;
  correct: boolean;
  at: string;
  responseMs: number;
}
export interface Session {
  id: string;
  type: "daily" | "practice";
  items: SessionItem[];
  index: number;
  startedAt: string;
  lastResumedAt: string | null;
  spentMs: number;
  completedAt: string | null;
  revealed: boolean;
  assisted: boolean;
  feedback?: LessonFeedback | null;
  stepStartedAt?: string | null;
  stepElapsedMs?: number;
  planReason?: string;
}
export interface Practice {
  id: string;
  taskId: string;
  skill: Skill;
  at: string;
  assisted: boolean;
  correct: number;
  total: number;
  checked?: boolean;
}
export interface Draft {
  text: string;
  checks: boolean[];
  answers: Record<string, string>;
  turn: number;
  helped: boolean;
  shown: boolean;
  ratings: number[];
}
export interface Settings {
  /** Kept only when reading legacy backups; automatic lessons ignore these values. */
  dailyNew?: number;
  minutes?: number;
  speechRate: number;
}
export interface Progress {
  version: 1;
  settings: Settings;
  memory: Record<string, Memory>;
  reviews: Review[];
  session: Session | null;
  savedSession?: Session | null;
  drafts: Record<string, Draft>;
  practice: Practice[];
  adaptiveVersion?: 1;
}
export const STORAGE_KEY = "frasi.progress.v1";
export function emptyProgress(): Progress {
  return {
    version: 1,
    settings: { speechRate: 0.85 },
    memory: {},
    reviews: [],
    session: null,
    drafts: {},
    practice: [],
    adaptiveVersion: 1,
  };
}
export const newDraft = (): Draft => ({
  text: "",
  checks: [],
  answers: {},
  turn: 0,
  helped: false,
  shown: false,
  ratings: [],
});
export const memoryKey = (id: string, skill: Skill) => id + ":" + skill;
export function dayKey(
  value: Date | string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join("-");
}

const date = z.string().datetime({ offset: true });
const id = z
  .string()
  .refine((x) => Object.hasOwn(phraseById, x), "Неизвестная карточка");
const skill = z.enum(["understanding", "speaking", "writing", "phrase"]);
const exerciseKind = z.enum(["assemble", "complete", "recall"]);
const answerMethod = z.enum(["words", "text", "speech"]);
const memorySchema = z.object({
  stability: z.number().finite().nonnegative(),
  difficulty: z.number().finite().min(0).max(10),
  state: z.number().int().min(0).max(3),
  scheduleStatus: z.enum(["new", "learning", "review"]),
  dueAt: date,
  lastReviewAt: date.nullable(),
  cardId: z.string().min(1).max(200),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  scheduledDays: z.number().finite().nonnegative(),
  learningStep: z.number().int().nonnegative(),
  origin: z.enum(["legacy", "automatic"]).optional(),
});
const itemSchema = z.object({
  cardId: id,
  skill,
  phase: z.enum(["learn", "recall"]),
  isNew: z.boolean(),
  exercise: exerciseKind.optional(),
  retry: z.boolean().optional(),
  practiceOnly: z.boolean().optional(),
});
const sessionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["daily", "practice"]),
    items: z.array(itemSchema).max(500),
    index: z.number().int().nonnegative(),
    startedAt: date,
    lastResumedAt: date.nullable(),
    spentMs: z.number().finite().nonnegative(),
    completedAt: date.nullable(),
    revealed: z.boolean(),
    assisted: z.boolean(),
    feedback: z
      .object({
        answer: z.string().max(3000),
        method: answerMethod,
        correct: z.boolean(),
        at: date,
        responseMs: z.number().finite().min(0).max(3600000),
      })
      .nullable()
      .optional(),
    stepStartedAt: date.nullable().optional(),
    stepElapsedMs: z.number().finite().min(0).optional(),
    planReason: z.string().max(500).optional(),
  })
  .refine((x) => x.index <= x.items.length, "Некорректный шаг занятия");
const draftSchema = z.object({
  text: z.string().max(50000),
  checks: z.array(z.boolean()).max(100),
  answers: z.record(z.string(), z.string().max(50000)),
  turn: z.number().int().nonnegative().max(100),
  helped: z.boolean(),
  shown: z.boolean(),
  ratings: z.array(z.number().int().min(0).max(4)).max(100),
});
const progressSchema = z
  .object({
    version: z.literal(1),
    settings: z.object({
      dailyNew: z.number().int().min(1).max(10).optional(),
      minutes: z.number().int().min(5).max(45).optional(),
      speechRate: z.number().min(0.5).max(1.2),
    }),
    memory: z.record(z.string(), memorySchema),
    reviews: z
      .array(
        z.object({
          id: z.string().min(1),
          cardId: id,
          skill,
          at: date,
          rating: z.number().int().min(1).max(4),
          assisted: z.boolean(),
          isNew: z.boolean(),
          previousAt: date.nullable(),
          nextAt: date,
          engineLog: z.record(z.string(), z.unknown()),
          method: answerMethod.optional(),
          evidence: z.enum(["guided", "independent"]).optional(),
          responseMs: z.number().finite().min(0).max(3600000).optional(),
          task: exerciseKind.optional(),
          scheduled: z.boolean().optional(),
          retry: z.boolean().optional(),
        }),
      )
      .max(100000),
    session: sessionSchema.nullable(),
    savedSession: sessionSchema.nullable().optional(),
    drafts: z.record(z.string(), draftSchema),
    practice: z
      .array(
        z.object({
          id: z.string().min(1),
          taskId: z.string().min(1),
          skill,
          at: date,
          assisted: z.boolean(),
          correct: z.number().int().nonnegative(),
          total: z.number().int().positive(),
          checked: z.boolean().optional(),
        }),
      )
      .max(100000),
    adaptiveVersion: z.literal(1).optional(),
  })
  .superRefine((p, ctx) => {
    for (const key of Object.keys(p.memory)) {
      const [cid, s] = key.split(":");
      if (
        !Object.hasOwn(phraseById, cid) ||
        !["understanding", "speaking", "writing", "phrase"].includes(s) ||
        key !== memoryKey(cid, s as Skill)
      )
        ctx.addIssue({
          code: "custom",
          message: "Неизвестное упражнение",
          path: ["memory", key],
        });
    }
    if (new Set(p.reviews.map((r) => r.id)).size !== p.reviews.length)
      ctx.addIssue({ code: "custom", message: "Повторяющиеся записи истории" });
    for (const r of p.reviews) {
      if (r.assisted && r.rating !== 1)
        ctx.addIssue({
          code: "custom",
          message: "Подсказка не является самостоятельным ответом",
        });
    }
    for (const p1 of p.practice) {
      if (p1.correct > p1.total)
        ctx.addIssue({
          code: "custom",
          message: "Некорректный результат практики",
        });
    }
  });
export function parseProgress(text: string): Progress {
  const raw = JSON.parse(text);
  const obj = raw?.app === "frasi" ? raw.progress : raw;
  return migrateProgress(progressSchema.parse(obj) as unknown as Progress);
}
export function exportProgress(progress: Progress) {
  return JSON.stringify(
    {
      app: "frasi",
      exportedAt: new Date().toISOString(),
      version: 1,
      recordingsIncluded: false,
      progress,
    },
    null,
    2,
  );
}
export function loadProgress(storage: Pick<Storage, "getItem" | "setItem">): {
  progress: Progress;
  warning: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { progress: emptyProgress(), warning: "" };
    try {
      const progress = parseProgress(raw);
      if (progress.session && !progress.session.completedAt)
        progress.session = {
          ...progress.session,
          lastResumedAt: null,
          stepStartedAt: null,
        };
      return { progress, warning: "" };
    } catch {
      storage.setItem(STORAGE_KEY + ".recovery." + Date.now(), raw);
      return {
        progress: emptyProgress(),
        warning:
          "Сохранённые данные повреждены. Их копия оставлена в браузере для восстановления.",
      };
    }
  } catch {
    return {
      progress: emptyProgress(),
      warning:
        "Хранилище браузера недоступно. Экспортируйте прогресс перед закрытием приложения.",
    };
  }
}
export function dueItems(p: Progress, now = new Date()) {
  return Object.entries(p.memory)
    .filter(([, m]) => new Date(m.dueAt).getTime() <= now.getTime())
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .map(([key]) => {
      const [cardId, skill] = key.split(":");
      return {
        cardId,
        skill: skill as Skill,
        phase: "recall" as const,
        isNew: false,
      };
    });
}
function freshCandidates(p: Progress, now: Date) {
  const today = dayKey(now);
  const usedFamilies = new Set(
    p.reviews
      .filter((r) => dayKey(r.at) === today)
      .map((r) => family(r.cardId)),
  );
  return initialOrder.filter(
    (card) =>
      !Object.keys(p.memory).some((key) => key.startsWith(card.id + ":")) &&
      !usedFamilies.has(family(card.id)),
  );
}
export function exerciseFor(p: Progress, cardId: string): ExerciseKind {
  const attempts = p.reviews.filter(
    (r) =>
      r.cardId === cardId &&
      r.skill === "phrase" &&
      !r.retry &&
      r.scheduled !== false,
  );
  let lastFailure = -1;
  attempts.forEach((attempt, index) => {
    if (attempt.rating === 1 || attempt.assisted) lastFailure = index;
  });
  const successes = attempts
    .slice(lastFailure + 1)
    .filter((r) => r.rating > 1 && !r.assisted);
  if (
    successes.length >= 3 &&
    new Set(successes.map((r) => dayKey(r.at))).size >= 2
  )
    return "recall";
  return successes.length >= 1 ? "complete" : "assemble";
}
export function migrateProgress(p: Progress): Progress {
  if (p.adaptiveVersion === 1) return p;
  const memory = { ...p.memory };
  const drafts = { ...p.drafts };
  for (const task of conversations) {
    const draft = drafts[task.id];
    if (draft)
      drafts[task.id] = {
        ...draft,
        shown: false,
        answers: { ...draft.answers, legacy: draft.turn > 0 ? "yes" : "no" },
      };
  }
  for (const card of initialOrder) {
    const key = memoryKey(card.id, "phrase");
    if (memory[key]) continue;
    const candidates = Object.entries(p.memory)
      .filter(([key]) => key.startsWith(card.id + ":"))
      .map(([, value]) => value)
      .sort(
        (a, b) =>
          Date.parse(b.lastReviewAt ?? "1970-01-01") -
          Date.parse(a.lastReviewAt ?? "1970-01-01"),
      );
    if (candidates[0]) memory[key] = { ...candidates[0], origin: "legacy" };
  }
  const upgrade = (session: Session | null | undefined) =>
    session
      ? {
          ...session,
          items: session.items.map((item) => ({
            ...item,
            skill: "phrase" as Skill,
            exercise: item.exercise ?? ("assemble" as ExerciseKind),
          })),
          // Old self-assessment screens become an unchecked exercise rather than a claimed result.
          revealed: false,
          assisted: false,
          feedback: null,
          stepStartedAt: null,
          stepElapsedMs: 0,
        }
      : session;
  return {
    ...p,
    memory,
    drafts,
    adaptiveVersion: 1,
    session: upgrade(p.session) ?? null,
    savedSession: upgrade(p.savedSession),
  };
}
export function adaptivePlan(p: Progress, now = new Date()) {
  const recent = p.reviews
    .filter((r) => r.method && !r.retry && r.scheduled !== false)
    .slice(-24);
  const accuracy = recent.length
    ? recent.filter((r) => r.rating > 1 && !r.assisted).length / recent.length
    : null;
  const times = recent
    .filter((r) => r.method !== "speech")
    .map((r) => (r.responseMs ?? 35000) / 1000)
    .filter((value) => value >= 3 && value <= 180)
    .sort((a, b) => a - b);
  const pace = Math.max(
    12,
    Math.min(90, times.length ? times[Math.floor(times.length / 2)] : 35),
  );
  const due = dueItems(p, now).filter((item) => item.skill === "phrase");
  const delayedIndependent = recent.filter(
    (r) =>
      r.evidence === "independent" &&
      r.previousAt &&
      Date.parse(r.at) - Date.parse(r.previousAt) >= 86400000 &&
      r.rating > 1,
  ).length;
  const recentTrouble =
    recent.length >= 2 &&
    recent.slice(-2).every((r) => r.rating === 1 || r.assisted);
  let targetNew = 5;
  if (recentTrouble || (recent.length >= 4 && accuracy! < 0.6)) targetNew = 2;
  else if (recent.length >= 4 && accuracy! < 0.8) targetNew = 3;
  else if (recent.length >= 4 && accuracy! >= 0.9)
    targetNew = delayedIndependent >= 3 ? 9 : 7;
  const seen = new Set<string>();
  const dueForRound = due
    .filter((item) => {
      const group = family(item.cardId);
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    })
    .slice(0, Math.max(4, Math.min(10, Math.floor(300 / pace))));
  const roomForNew = Math.max(
    0,
    Math.floor((300 - dueForRound.length * pace) / (pace + 20)),
  );
  const fresh = freshCandidates(p, now)
    .filter((card) => {
      const group = family(card.id);
      if (seen.has(group)) return false;
      seen.add(group);
      return true;
    })
    .slice(0, Math.min(targetNew, roomForNew));
  const reason =
    due.length >= 8
      ? "Сначала закрепим фразы, которым уже пора на повторение."
      : recentTrouble || (recent.length >= 4 && accuracy! < 0.8)
        ? "Возьмём меньше нового и спокойно закрепим трудные места."
        : recent.length >= 4 && accuracy! >= 0.9
          ? "Ответы становятся увереннее — можно добавить немного нового."
          : "Начнём с небольшого занятия и подстроим темп по ответам.";
  return {
    due: dueForRound,
    fresh,
    targetNew,
    accuracy,
    pace,
    reason,
    minutes: Math.max(
      1,
      Math.ceil((dueForRound.length * pace + fresh.length * (pace + 20)) / 60),
    ),
    dueTotal: due.length,
  };
}
export function dailyCandidates(p: Progress, now = new Date()) {
  const plan = adaptivePlan(p, now);
  return { remaining: plan.targetNew, newCards: freshCandidates(p, now) };
}
export function createSession(
  p: Progress,
  now = new Date(),
  practice?: { cardId: string; skill: Skill },
): Session {
  const plan = adaptivePlan(p, now);
  let recall: SessionItem[];
  if (practice) {
    const skill = practice.skill === "phrase" ? "phrase" : practice.skill;
    recall = [
      {
        cardId: practice.cardId,
        skill,
        phase: "recall",
        isNew: !p.memory[memoryKey(practice.cardId, skill)],
        exercise: exerciseFor(p, practice.cardId),
        ...(skill === "phrase" &&
        p.memory[memoryKey(practice.cardId, skill)] &&
        Date.parse(p.memory[memoryKey(practice.cardId, skill)].dueAt) >
          now.getTime()
          ? { practiceOnly: true }
          : {}),
      },
    ];
  } else {
    recall = [
      ...plan.due.map((item) => ({
        ...item,
        exercise: exerciseFor(p, item.cardId),
      })),
      ...plan.fresh.map((card) => ({
        cardId: card.id,
        skill: "phrase" as Skill,
        phase: "recall" as const,
        isNew: true,
        exercise: "assemble" as ExerciseKind,
      })),
    ];
    // Optional extra practice remains possible even when scheduled reviews are not due yet.
    if (!recall.length)
      recall = Object.entries(p.memory)
        .filter(([key]) => key.endsWith(":phrase"))
        .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
        .slice(0, 4)
        .map(([key]) => ({
          cardId: key.split(":")[0],
          skill: "phrase",
          phase: "recall",
          isNew: false,
          exercise: exerciseFor(p, key.split(":")[0]),
          practiceOnly: true,
        }));
  }
  const items: SessionItem[] = [
    ...recall
      .filter((item) => item.isNew)
      .map((item) => ({ ...item, phase: "learn" as const })),
    ...recall,
  ];
  return {
    id: crypto.randomUUID(),
    type: practice ? "practice" : "daily",
    items,
    index: 0,
    startedAt: now.toISOString(),
    lastResumedAt: now.toISOString(),
    spentMs: 0,
    completedAt: items.length ? null : now.toISOString(),
    revealed: false,
    assisted: false,
    feedback: null,
    stepStartedAt: now.toISOString(),
    stepElapsedMs: 0,
    planReason: plan.reason,
  };
}
export function pauseSession(s: Session, now = new Date()): Session {
  return {
    ...s,
    spentMs:
      s.spentMs +
      (s.lastResumedAt
        ? Math.max(0, now.getTime() - Date.parse(s.lastResumedAt))
        : 0),
    lastResumedAt: null,
    stepElapsedMs:
      (s.stepElapsedMs ?? 0) +
      (s.stepStartedAt && !s.feedback
        ? Math.max(0, now.getTime() - Date.parse(s.stepStartedAt))
        : 0),
    stepStartedAt: null,
  };
}
export function resumeSession(s: Session, now = new Date()): Session {
  return s.completedAt
    ? s
    : {
        ...s,
        lastResumedAt: now.toISOString(),
        stepStartedAt: s.feedback ? null : now.toISOString(),
      };
}
export function advanceLearning(
  p: Progress,
  sessionId: string,
  index: number,
  now = new Date(),
): Progress {
  const s = p.session;
  if (
    !s ||
    s.id !== sessionId ||
    s.index !== index ||
    s.items[index]?.phase !== "learn"
  )
    return p;
  const next = index + 1;
  return {
    ...p,
    session: {
      ...s,
      index: next,
      revealed: false,
      assisted: false,
      feedback: null,
      stepStartedAt: now.toISOString(),
      stepElapsedMs: 0,
      completedAt: next >= s.items.length ? now.toISOString() : null,
    },
  };
}
export function revealAnswer(p: Progress, helped = false): Progress {
  if (!p.session) return p;
  return {
    ...p,
    session: {
      ...p.session,
      revealed: true,
      assisted: p.session.assisted || helped,
    },
  };
}
export function rateSession(
  p: Progress,
  sessionId: string,
  index: number,
  grade: number,
  now = new Date(),
  details?: Pick<
    Review,
    "method" | "evidence" | "responseMs" | "task" | "scheduled" | "retry"
  >,
): Progress {
  const s = p.session;
  if (
    !s ||
    s.id !== sessionId ||
    s.index !== index ||
    !s.revealed ||
    s.items[index]?.phase !== "recall" ||
    ![1, 2, 3, 4].includes(grade)
  )
    return p;
  const item = s.items[index],
    key = memoryKey(item.cardId, item.skill),
    existing = p.memory[key],
    rating = (s.assisted ? Rating.Again : grade) as Grade;
  const card = existing
    ? {
        ...existing,
        dueAt: new Date(existing.dueAt),
        lastReviewAt: existing.lastReviewAt
          ? new Date(existing.lastReviewAt)
          : null,
      }
    : scheduler.newCard({ now });
  const { card: updated, revlog } = scheduler.review({
    card,
    grade: rating,
    now,
  });
  const memory = {
    ...updated,
    dueAt: updated.dueAt.toISOString(),
    lastReviewAt: updated.lastReviewAt?.toISOString() ?? null,
    ...(details?.method ? { origin: "automatic" as const } : {}),
  } as Memory;
  const review: Review = {
    id: s.id + ":" + index,
    cardId: item.cardId,
    skill: item.skill,
    at: now.toISOString(),
    rating,
    assisted: s.assisted,
    isNew: !existing,
    previousAt: existing?.lastReviewAt ?? null,
    nextAt:
      details?.scheduled === false && existing ? existing.dueAt : memory.dueAt,
    engineLog: JSON.parse(JSON.stringify(revlog)),
    ...details,
  };
  const next = index + 1,
    completed = next >= s.items.length;
  const session = {
    ...s,
    index: next,
    revealed: false,
    assisted: false,
    feedback: null,
    stepStartedAt: now.toISOString(),
    stepElapsedMs: 0,
    completedAt: completed ? now.toISOString() : null,
  };
  return {
    ...p,
    memory:
      details?.scheduled === false ? p.memory : { ...p.memory, [key]: memory },
    reviews: [...p.reviews, review],
    session: completed ? pauseSession(session, now) : session,
  };
}
export function submitLessonAnswer(
  p: Progress,
  answer: string,
  method: AnswerMethod,
  now = new Date(),
): Progress {
  const s = p.session;
  if (
    !s ||
    s.completedAt ||
    s.feedback ||
    s.items[s.index]?.phase !== "recall" ||
    !answer.trim() ||
    answer.length > 3000
  )
    return p;
  const item = s.items[s.index];
  const exercise = lessonExercise(
    phraseById[item.cardId].el,
    item.exercise ?? "assemble",
    s.id + ":" + s.index,
  );
  const correct = checkLessonAnswer(
    phraseById[item.cardId].el,
    exercise,
    answer,
    method,
    item.cardId,
  );
  const responseMs = Math.min(
    3600000,
    (s.stepElapsedMs ?? 0) +
      (s.stepStartedAt
        ? Math.max(0, now.getTime() - Date.parse(s.stepStartedAt))
        : 0),
  );
  return {
    ...p,
    session: {
      ...s,
      revealed: true,
      stepStartedAt: null,
      feedback: { answer, method, correct, at: now.toISOString(), responseMs },
    },
  };
}
export function helpLesson(p: Progress, now = new Date()): Progress {
  const s = p.session;
  if (!s || s.completedAt || s.feedback || s.items[s.index]?.phase !== "recall")
    return p;
  return {
    ...p,
    session: {
      ...s,
      revealed: true,
      assisted: true,
      stepStartedAt: null,
      feedback: {
        answer: "",
        method: "words",
        correct: false,
        at: now.toISOString(),
        responseMs: Math.min(
          3600000,
          (s.stepElapsedMs ?? 0) +
            (s.stepStartedAt
              ? Math.max(0, now.getTime() - Date.parse(s.stepStartedAt))
              : 0),
        ),
      },
    },
  };
}
export function continueLesson(p: Progress, now = new Date()): Progress {
  const s = p.session,
    feedback = s?.feedback;
  if (!s || !feedback || s.completedAt) return p;
  const item = s.items[s.index];
  const evidence =
    item.exercise !== "recall" ||
    feedback.method === "words" ||
    s.assisted ||
    item.retry
      ? "guided"
      : "independent";
  const next = rateSession(
    p,
    s.id,
    s.index,
    feedback.correct && !s.assisted ? 3 : 1,
    new Date(feedback.at),
    {
      method: feedback.method,
      evidence,
      responseMs: feedback.responseMs,
      task: item.exercise ?? "assemble",
      retry: Boolean(item.retry),
      scheduled: !item.practiceOnly,
    },
  );
  if (next === p || !next.session) return next;
  const current = {
    ...next.session,
    stepStartedAt: now.toISOString(),
    lastResumedAt: next.session.completedAt
      ? null
      : (next.session.lastResumedAt ?? now.toISOString()),
  };
  if (!feedback.correct && !item.retry) {
    const unrelated = new Set<string>();
    let insertAt = -1;
    for (let i = current.index; i < current.items.length; i++) {
      if (
        family(current.items[i].cardId) !== family(item.cardId) &&
        current.items[i].phase === "recall"
      )
        unrelated.add(family(current.items[i].cardId));
      if (unrelated.size >= 2) {
        insertAt = i + 1;
        break;
      }
    }
    if (insertAt >= 0) {
      const items = [...current.items];
      items.splice(insertAt, 0, {
        ...item,
        isNew: false,
        retry: true,
        practiceOnly: true,
      });
      return { ...next, session: { ...current, items, completedAt: null } };
    }
  }
  return { ...next, session: current };
}
export function getStats(p: Progress, now = new Date()) {
  const today = dayKey(now),
    todays = p.reviews.filter((r) => dayKey(r.at) === today);
  const delayed = p.reviews.filter(
    (r) =>
      r.previousAt && Date.parse(r.at) - Date.parse(r.previousAt) >= 86400000,
  );
  const days = new Set([
    ...p.reviews.map((r) => dayKey(r.at)),
    ...p.practice.map((r) => dayKey(r.at)),
  ]);
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    introduced: new Set(Object.keys(p.memory).map((k) => k.split(":")[0])).size,
    today: todays.length,
    newToday: new Set(todays.filter((r) => r.isNew).map((r) => r.cardId)).size,
    correctToday: todays.filter((r) => r.rating > 1 && !r.assisted).length,
    delayedCount: delayed.length,
    delayedCorrect: delayed.filter((r) => r.rating > 1 && !r.assisted).length,
    streak,
    practice: p.practice.length,
  };
}
