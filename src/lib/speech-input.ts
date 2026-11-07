import { registerPlugin } from "@capacitor/core";
import { isAndroid } from "./platform";

export interface SpeechInputStatus {
  available: boolean;
  reason: string;
}
interface SpeechInputPlugin {
  status(): Promise<SpeechInputStatus>;
  listen(options: {
    id: string;
  }): Promise<{ text: string; alternatives: string[] }>;
  stop(options: { id: string }): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}
export const speechInput = registerPlugin<SpeechInputPlugin>("FrasiSpeech");
export async function speechInputStatus(): Promise<SpeechInputStatus> {
  if (!isAndroid)
    return {
      available: false,
      reason:
        "Голосовой ответ доступен в Android-приложении при установленном распознавании греческого.",
    };
  try {
    return await speechInput.status();
  } catch {
    return {
      available: false,
      reason: "Распознавание греческого на устройстве недоступно.",
    };
  }
}
