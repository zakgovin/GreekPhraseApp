import data from "../data/exam-questions.json";
import { phraseById } from "./content";
import { matchesPhrase } from "./lesson";
import type { Progress } from "./progress";

export interface ExamQuestion {
  id: string;
  number: number;
  el: string;
  ru: string;
  topic: string;
  cardIds: string[];
}
export const examQuestions: ExamQuestion[] = data.questions;
export const examQuestionById = Object.fromEntries(
  examQuestions.map((question) => [question.id, question]),
) as Record<string, ExamQuestion>;
export const examQuestionSource = data.source.id;
export function questionAnswer(question: ExamQuestion) {
  return question.cardIds.map((id) => phraseById[id].el).join(" ");
}
export function checkQuestionAnswer(question: ExamQuestion, value: string) {
  return matchesPhrase(
    questionAnswer(question),
    value,
    question.cardIds.length === 1 ? question.cardIds[0] : undefined,
  );
}
export function questionBlock(p: Progress, count = 3) {
  const last = new Map<string, number>();
  for (const practice of p.practice)
    if (examQuestionById[practice.taskId])
      last.set(practice.taskId, Date.parse(practice.at));
  return examQuestions
    .filter((question) => question.cardIds.length)
    .sort(
      (a, b) =>
        (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0) || a.number - b.number,
    )
    .slice(0, count)
    .map((question) => question.id);
}
