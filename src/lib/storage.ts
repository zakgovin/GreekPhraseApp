import {
  emptyProgress,
  loadProgress,
  parseProgress,
  STORAGE_KEY,
  type Progress,
} from "./progress";
import { isAndroid, native } from "./platform";

let initial: { progress: Progress; warning: string } | undefined;
let nativeWritesAllowed = true;
let pendingWrite: Promise<void> = Promise.resolve();

export async function prepareStorage() {
  if (!isAndroid) return;
  try {
    const { content } = await native.readProgress();
    if (content) {
      try {
        const progress = parseProgress(content);
        if (progress.session && !progress.session.completedAt)
          progress.session = {
            ...progress.session,
            lastResumedAt: null,
            stepStartedAt: null,
          };
        initial = { progress, warning: "" };
      } catch {
        await native.preserveRecovery({ content });
        initial = {
          progress: emptyProgress(),
          warning:
            "Сохранённые данные повреждены. В приложении оставлена копия для восстановления.",
        };
      }
    } else {
      initial = loadProgress(window.localStorage);
    }
  } catch {
    nativeWritesAllowed = false;
    initial = {
      progress: emptyProgress(),
      warning:
        "Не удалось прочитать сохранённый прогресс. Закройте и снова откройте приложение. Данные на устройстве сохранены; новые изменения пока не записываются.",
    };
  }
}

export function initialProgress() {
  if (initial) return initial;
  try {
    return loadProgress(window.localStorage);
  } catch {
    return {
      progress: emptyProgress(),
      warning:
        "Хранилище недоступно. Экспортируйте прогресс перед закрытием приложения.",
    };
  }
}

export async function saveProgress(progress: Progress) {
  const content = JSON.stringify(progress);
  if (isAndroid) {
    if (!nativeWritesAllowed) return;
    // Serialize writes so an earlier response can never replace newer progress.
    const write = pendingWrite
      .catch(() => {})
      .then(() => native.saveProgress({ content }));
    pendingWrite = write;
    await write;
    // This is a recoverable mirror. Native storage remains authoritative.
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch {
      /* Native save succeeded. */
    }
  } else {
    localStorage.setItem(STORAGE_KEY, content);
  }
}
