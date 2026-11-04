import { normalize } from "./content";
import type { ListeningField } from "../data/curriculum";
export function normalizeResponse(value: string) {
  return normalize(value)
    .replace(/[^\p{L}\p{N}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function checkListening(
  fields: ListeningField[],
  answers: Record<string, string>,
) {
  return fields.map((f) => ({
    id: f.id,
    correct: f.accepted.some(
      (a) => normalizeResponse(a) === normalizeResponse(answers[f.id] ?? ""),
    ),
  }));
}
