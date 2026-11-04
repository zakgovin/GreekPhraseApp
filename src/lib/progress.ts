import {
  DefaultScheduler,
  Rating,
  type DefaultSchedulerCard,
  type Grade,
} from "ts-fsrs";
import { z } from "zod";
import {
  defaultSkill,
  family,
  initialOrder,
  phraseById,
  type Skill,
} from "./content";

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
> & { dueAt: string; lastReviewAt: string | null };
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
}
export interface SessionItem {
  cardId: string;
  skill: Skill;
  phase: "learn" | "recall";
  isNew: boolean;
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
}
export interface Practice {
  id: string;
  taskId: string;
  skill: Skill;
  at: string;
  assisted: boolean;
  correct: number;
  total: number;
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
  dailyNew: number;
  minutes: number;
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
}
export const STORAGE_KEY = "frasi.progress.v1";
export function emptyProgress(): Progress {
  return {
    version: 1,
    settings: { dailyNew: 3, minutes: 15, speechRate: 0.85 },
    memory: {},
    reviews: [],
    session: null,
    drafts: {},
    practice: [],
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
const skill = z.enum(["understanding", "speaking", "writing"]);
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
});
const itemSchema = z.object({
  cardId: id,
  skill,
  phase: z.enum(["learn", "recall"]),
  isNew: z.boolean(),
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
      dailyNew: z.number().int().min(1).max(10),
      minutes: z.number().int().min(5).max(45),
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
        }),
      )
      .max(100000),
  })
  .superRefine((p, ctx) => {
    for (const key of Object.keys(p.memory)) {
      const [cid, s] = key.split(":");
      if (
        !Object.hasOwn(phraseById, cid) ||
        !["understanding", "speaking", "writing"].includes(s) ||
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
  return progressSchema.parse(obj) as unknown as Progress;
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
        progress.session = { ...progress.session, lastResumedAt: null };
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
export function dailyCandidates(p: Progress, now = new Date()) {
  const today = dayKey(now),
    todayReviews = p.reviews.filter((r) => dayKey(r.at) === today);
  const introduced = new Set(
    todayReviews.filter((r) => r.isNew).map((r) => r.cardId),
  );
  const usedFamilies = new Set(todayReviews.map((r) => family(r.cardId)));
  return {
    remaining: Math.max(0, p.settings.dailyNew - introduced.size),
    newCards: initialOrder.filter(
      (c) =>
        !Object.keys(p.memory).some((k) => k.startsWith(c.id + ":")) &&
        !usedFamilies.has(family(c.id)),
    ),
  };
}
export function createSession(
  p: Progress,
  now = new Date(),
  practice?: { cardId: string; skill: Skill },
): Session {
  let items: SessionItem[];
  if (practice) {
    const isNew = !p.memory[memoryKey(practice.cardId, practice.skill)];
    items = [
      ...(isNew ? [{ ...practice, phase: "learn" as const, isNew }] : []),
      { ...practice, phase: "recall", isNew },
    ];
  } else {
    const cap = Math.max(1, Math.floor((p.settings.minutes * 60) / 35)),
      seen = new Set<string>();
    const due = dueItems(p, now)
      .filter((i) => {
        const f = family(i.cardId);
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      })
      .slice(0, cap);
    const { remaining, newCards } = dailyCandidates(p, now);
    const newCount = Math.min(
      remaining,
      Math.max(0, Math.floor((p.settings.minutes * 60 - due.length * 35) / 80)),
    );
    const selected = newCards
      .filter((c) => {
        const f = family(c.id);
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      })
      .slice(0, newCount);
    const fresh = selected.map((c) => ({
      cardId: c.id,
      skill: defaultSkill(c),
      isNew: true,
    }));
    items = [
      ...due,
      ...fresh.map((c) => ({ ...c, phase: "learn" as const })),
      ...fresh.map((c) => ({ ...c, phase: "recall" as const })),
    ];
  }
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
  };
}
export function resumeSession(s: Session, now = new Date()): Session {
  return s.completedAt ? s : { ...s, lastResumedAt: now.toISOString() };
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
    nextAt: memory.dueAt,
    engineLog: JSON.parse(JSON.stringify(revlog)),
  };
  const next = index + 1,
    completed = next >= s.items.length;
  const session = {
    ...s,
    index: next,
    revealed: false,
    assisted: false,
    completedAt: completed ? now.toISOString() : null,
  };
  return {
    ...p,
    memory: { ...p.memory, [key]: memory },
    reviews: [...p.reviews, review],
    session: completed ? pauseSession(session, now) : session,
  };
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
