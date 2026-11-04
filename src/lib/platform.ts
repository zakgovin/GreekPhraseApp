import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export const isAndroid = Capacitor.getPlatform() === "android";
export interface NativeRecording {
  exists: boolean;
  path?: string;
  key?: string;
  durationMs?: number;
}
export interface SpeechStatus {
  available: boolean;
  engineAvailable: boolean;
  voice?: string;
  reason?: string;
}
interface FrasiPlugin {
  readProgress(): Promise<{ content?: string | null }>;
  saveProgress(options: { content: string }): Promise<void>;
  preserveRecovery(options: { content: string }): Promise<void>;
  speechStatus(): Promise<SpeechStatus>;
  speak(options: {
    text: string;
    id: string;
    rate: number;
  }): Promise<{ id: string }>;
  stopSpeech(): Promise<void>;
  openSpeechSettings(): Promise<void>;
  startRecording(options: { key: string }): Promise<void>;
  stopRecording(options: { key: string }): Promise<NativeRecording>;
  getRecording(options: { key: string }): Promise<NativeRecording>;
  clearRecordings(): Promise<void>;
  exportJson(options: {
    filename: string;
    content: string;
  }): Promise<{ saved?: boolean; cancelled?: boolean }>;
  importJson(): Promise<{
    content?: string;
    filename?: string;
    cancelled?: boolean;
  }>;
  addListener(
    event: "speechFinished",
    callback: (event: { id: string; failed: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "recordingStopped",
    callback: (event: NativeRecording) => void,
  ): Promise<PluginListenerHandle>;
}
export const native = registerPlugin<FrasiPlugin>("FrasiNative");
export const nativeFileUrl = (path: string) => Capacitor.convertFileSrc(path);
