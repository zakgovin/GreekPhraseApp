import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  GraduationCap,
  Layers,
  Leaf,
  MessageCircle,
  Settings2,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { AppContext, type Page } from "./state";
import { Today, Library, ProgressPage, SettingsPage } from "./pages/Pages";
import { Study } from "./pages/Study";
import { Conversations } from "./pages/Conversations";
import { ExamQuestions } from "./pages/ExamQuestions";
import { Exams } from "./pages/Exams";
import { Modal, Sources, SpeechProvider } from "./components/common";
import {
  createSession,
  pauseSession,
  resumeSession,
  type LessonOptions,
} from "./lib/progress";
import { SpeechAnswerProvider } from "./components/Answer";
import "./styles.css";
import { initialProgress, saveProgress } from "./lib/storage";
import { phrases } from "./lib/content";
import { isAndroid } from "./lib/platform";
import { App as AndroidApp } from "@capacitor/app";

const navigation = [
  { id: "today", label: "Сегодня", icon: Sun },
  { id: "conversation", label: "Разговор", icon: MessageCircle },
  { id: "exam", label: "Экзамен", icon: GraduationCap },
  { id: "phrases", label: "Все фразы", icon: Layers },
  { id: "progress", label: "Прогресс", icon: ChartNoAxesCombined },
] as const;
const pages: Page[] = [
  "today",
  "conversation",
  "questions",
  "exam",
  "phrases",
  "progress",
  "settings",
  "study",
];
function readPage(): Page {
  const hash = location.hash.slice(1) as Page;
  return pages.includes(hash) ? hash : "today";
}
export default function App() {
  const [loaded] = useState(initialProgress),
    [progress, update] = useState(loaded.progress),
    [warning, setWarning] = useState(loaded.warning),
    [page, setPage] = useState<Page>(readPage),
    [sourceIds, setSourceIds] = useState<string[] | null>(null),
    [about, setAbout] = useState(false),
    [toast, setToast] = useState("");
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    void saveProgress(progress).catch(() => {
      setWarning(
        "Не удалось сохранить прогресс. Экспортируйте резервную копию перед закрытием приложения.",
      );
    });
  }, [progress]);
  useEffect(() => {
    if (!isAndroid) return;
    const back = AndroidApp.addListener("backButton", ({ canGoBack }) => {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      const dialog = dialogs[dialogs.length - 1];
      const back = document.querySelector<HTMLButtonElement>(
        "main button[data-native-back]",
      );
      if (dialog)
        dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      else if (back) back.click();
      else if (canGoBack) history.back();
      else if (pageRef.current !== "today") location.hash = "today";
      else void AndroidApp.minimizeApp();
    });
    return () => {
      void back.then((listener) => listener.remove());
    };
  }, []);
  useEffect(() => {
    const change = () => {
      const next = readPage();
      if (pageRef.current === "study" && next !== "study")
        update((p) =>
          p.session && !p.session.completedAt
            ? { ...p, session: pauseSession(p.session) }
            : p,
        );
      setPage(next);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const hide = () => {
      if (document.hidden)
        update((p) =>
          p.session?.lastResumedAt && !p.session.completedAt
            ? { ...p, session: pauseSession(p.session) }
            : p,
        );
      else if (pageRef.current === "study")
        update((p) =>
          p.session && !p.session.completedAt && !p.session.lastResumedAt
            ? { ...p, session: resumeSession(p.session) }
            : p,
        );
    };
    window.addEventListener("hashchange", change);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("hashchange", change);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(next: Page) {
    location.hash = next;
    if (next === page) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function study(id?: string, options?: LessonOptions) {
    const now = new Date();
    update((p) => {
      if (id) {
        const session = createSession(p, now, {
          cardId: id,
          skill: "phrase",
        });
        return {
          ...p,
          session,
          savedSession:
            p.session?.type === "daily" && !p.session.completedAt
              ? pauseSession(p.session, now)
              : p.savedSession,
        };
      }
      if (p.session && !p.session.completedAt)
        return { ...p, session: resumeSession(p.session, now) };
      if (p.savedSession && !p.savedSession.completedAt && !options?.short)
        return {
          ...p,
          session: resumeSession(p.savedSession, now),
          savedSession: null,
        };
      return { ...p, session: createSession(p, now, undefined, options) };
    });
    navigate("study");
  }
  const screen =
    page === "today" ? (
      <Today />
    ) : page === "conversation" ? (
      <Conversations />
    ) : page === "questions" ? (
      <ExamQuestions />
    ) : page === "exam" ? (
      <Exams />
    ) : page === "phrases" ? (
      <Library />
    ) : page === "progress" ? (
      <ProgressPage />
    ) : page === "settings" ? (
      <SettingsPage />
    ) : (
      <Study />
    );
  return (
    <AppContext.Provider
      value={{
        progress,
        update,
        navigate,
        source: setSourceIds,
        notify: setToast,
        study,
        about: () => setAbout(true),
      }}
    >
      <SpeechAnswerProvider>
        <SpeechProvider rate={progress.settings.speechRate}>
          <div className="app-shell">
            <a
              className="skip-link"
              href="#main-content"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("main-content")?.focus();
              }}
            >
              К содержимому
            </a>
            <aside className="sidebar">
              <a
                className="brand"
                href="#today"
                aria-label="Φράση — на главную"
              >
                <span className="brand-icon">φ</span>
                <div>
                  <strong lang="el">Φράση</strong>
                  <span>Греческий для вашей жизни</span>
                </div>
              </a>
              <div className="sidebar-caption">ВАШЕ ОБУЧЕНИЕ</div>
              <nav className="main-navigation" aria-label="Основная навигация">
                {navigation.map((n) => (
                  <a
                    href={"#" + n.id}
                    key={n.id}
                    className={
                      page === n.id ||
                      (page === "study" && n.id === "today") ||
                      (page === "questions" && n.id === "conversation")
                        ? "active"
                        : ""
                    }
                    aria-current={page === n.id ? "page" : undefined}
                  >
                    <n.icon size={20} />
                    <span>{n.label}</span>
                    {n.id === "phrases" && <small>{phrases.length}</small>}
                  </a>
                ))}
              </nav>
              <div className="sidebar-course">
                <div className="course-symbol">
                  <Leaf size={26} strokeWidth={1.5} />
                </div>
                <span className="eyebrow">СВОБОДНЕЕ С КАЖДЫМ ДНЁМ</span>
                <h3>Ваш путь к A2</h3>
                <p>Фразы, которые пригодятся на экзамене и в Ларнаке.</p>
                <button onClick={() => setAbout(true)}>
                  О методике
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="sidebar-bottom">
                <a
                  href="#settings"
                  className={page === "settings" ? "active" : ""}
                >
                  <Settings2 size={19} />
                  <span>Настройки</span>
                </a>
                <div className="profile">
                  <span className="avatar">З</span>
                  <div>
                    <strong>Захар</strong>
                    <span>Личный курс · A2</span>
                  </div>
                  <span className="profile-dot" />
                </div>
              </div>
            </aside>
            <div className="app-content">
              <header className="topbar">
                <div>
                  <span className="topbar-mark">ΕΛ</span>
                  <span>Греческий язык</span>
                  <i>/</i>
                  <strong>
                    {navigation.find((n) => n.id === page)?.label ??
                      (page === "settings"
                        ? "Настройки"
                        : page === "questions"
                          ? "Вопросы экзаменатора"
                          : "Занятие")}
                  </strong>
                </div>
                <div className="topbar-right">
                  <span className="topbar-date">
                    {new Date().toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })}
                  </span>
                  <span className="level-badge">A2</span>
                  <button
                    className="icon-button mobile-settings"
                    onClick={() => navigate("settings")}
                    aria-label="Настройки"
                  >
                    <Settings2 size={20} />
                  </button>
                </div>
              </header>
              <main id="main-content" className="main-content" tabIndex={-1}>
                {warning && (
                  <div className="storage-warning" role="alert">
                    <span>{warning}</span>
                    <button
                      className="icon-button"
                      aria-label="Закрыть сообщение"
                      onClick={() => setWarning("")}
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}
                {screen}
                <footer className="page-footer">
                  <span lang="el">λίγο λίγο, κάθε μέρα</span>
                  <span>Понемногу. Каждый день.</span>
                </footer>
              </main>
            </div>
            <nav className="mobile-navigation" aria-label="Мобильная навигация">
              {navigation.map((n) => (
                <a
                  key={n.id}
                  href={"#" + n.id}
                  className={
                    page === n.id ||
                    (page === "study" && n.id === "today") ||
                    (page === "questions" && n.id === "conversation")
                      ? "active"
                      : ""
                  }
                >
                  <n.icon size={20} />
                  <span>{n.label}</span>
                </a>
              ))}
            </nav>
          </div>
          {sourceIds && (
            <Sources ids={sourceIds} onClose={() => setSourceIds(null)} />
          )}
          <div className="toast-container" role="status" aria-live="polite">
            {toast && (
              <div className="toast">
                <Check size={18} />
                <span>{toast}</span>
                <button
                  className="icon-button"
                  onClick={() => setToast("")}
                  aria-label="Закрыть уведомление"
                >
                  <X size={17} />
                </button>
              </div>
            )}
          </div>
          {about && (
            <Modal
              title="Маленькие шаги, настоящие знания"
              onClose={() => setAbout(false)}
            >
              <div className="method-modal">
                <span className="stat-icon mint">
                  <Sparkles size={24} />
                </span>
                <p>
                  Одно короткое занятие: фраза, языковое задание и понятный
                  результат.
                </p>
                <ol>
                  <li>
                    <strong>Познакомиться.</strong> Послушай фразу и повтори её.
                  </li>
                  <li>
                    <strong>Попробовать.</strong> Собери фразу или дополни её.
                    Мы проверим ответ.
                  </li>
                  <li>
                    <strong>Закрепить.</strong> Подберём следующее повторение и
                    объём нового по твоим ответам.
                  </li>
                </ol>
                <p className="muted">
                  Не нужно выставлять себе оценки или выбирать дневной лимит.
                  Слова-подсказки и самостоятельные ответы учитываются
                  раздельно. Голосовой ввод проверяет распознанные слова, а не
                  точность акцента.
                </p>
                <button
                  className="button button-primary"
                  onClick={() => setAbout(false)}
                >
                  Понятно
                  <ArrowRight size={17} />
                </button>
              </div>
            </Modal>
          )}
        </SpeechProvider>
      </SpeechAnswerProvider>
    </AppContext.Provider>
  );
}
