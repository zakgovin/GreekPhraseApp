import raw from "../data/phrases.json";

export type Skill = "understanding" | "speaking" | "writing";
export type Kind =
  | "personal"
  | "roleplay"
  | "situational"
  | "writing_scenario"
  | "recognition"
  | "image_description";
export interface Phrase {
  id: string;
  topic: string;
  kind: Kind;
  basis: string;
  sources: string[];
  el: string;
  ru: string;
  context?: string;
}
export interface Source {
  year: number;
  file: string;
  pdf_page: number;
  printed_page: string | null;
  description: string;
}
export const phrases = raw.cards as Phrase[];
export const phraseById = Object.fromEntries(
  phrases.map((p) => [p.id, p]),
) as Record<string, Phrase>;
export const sources = raw.sources as Record<string, Source>;
export const kindLabels: Record<Kind, string> = {
  personal: "Обо мне",
  roleplay: "Ролевая игра",
  situational: "Ситуация",
  writing_scenario: "Пример письма",
  recognition: "Понимание",
  image_description: "Картинка",
};
export const skillLabels: Record<Skill, string> = {
  understanding: "Понимание",
  speaking: "Речь",
  writing: "Письмо",
};
export const defaultSkill = (phrase: Phrase): Skill =>
  phrase.kind === "recognition" ? "understanding" : "speaking";
const groups: number[][] = [
  [3, 4, 5],
  [6, 7],
  [9, 10],
  [11, 12],
  [13, 14, 15],
  [16, 17, 18],
  [19, 20],
  [21, 22, 23],
  [101, 102, 103],
  [104, 105, 106],
  [107, 108, 109],
  [110, 111],
  [112, 113],
  [114, 115],
  [116, 117],
  [118],
  [119],
  [120],
  [121],
  [122],
  [24, 25, 26, 27, 28, 29],
  [30, 31, 32, 33, 34],
  [35, 36, 37, 38, 39],
  [40, 41, 42, 43, 44],
  [45, 46, 47, 48],
  [49, 50, 51],
  [52, 53, 54],
  [55, 56, 57],
  [58, 59, 60],
  [61, 62, 63, 64, 65],
  [66, 67, 68],
  [69, 70],
  [71, 72, 73, 74],
  [75],
  [76, 77],
  [78, 79],
  [80, 81],
  [82, 83],
  [84],
  [85],
  [86, 87],
  [88, 89],
  [90],
  [91],
  [92],
  [93],
  [94],
  [95, 96],
  [97, 98],
  [99],
  [100],
];
export function family(id: string) {
  const n = Number(id.slice(3));
  const g = groups.find((a) => a.includes(n));
  return g ? "family-" + g[0] : id;
}
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("el")
    .replace(/ς/g, "σ")
    .trim();
}
export function wordCount(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
export const initialOrder = [
  ...phrases.filter((p) => p.kind === "personal"),
  ...phrases.filter((p) => p.kind !== "personal"),
];
export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ru-RU", options).format(new Date(value));
}
