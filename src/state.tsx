import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Progress } from "./lib/progress";
import type { Skill } from "./lib/content";
export type Page =
  | "today"
  | "conversation"
  | "exam"
  | "phrases"
  | "progress"
  | "settings"
  | "study";
export interface AppState {
  progress: Progress;
  update: Dispatch<SetStateAction<Progress>>;
  navigate: (page: Page) => void;
  source: (ids: string[]) => void;
  notify: (message: string) => void;
  study: (id?: string, skill?: Skill) => void;
  about: () => void;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const state = useContext(AppContext);
  if (!state) throw new Error("AppContext missing");
  return state;
}
