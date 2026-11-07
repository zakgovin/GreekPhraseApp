import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Volume2, VolumeX, X, Info, ArrowRight } from "lucide-react";
import { sources, type Phrase } from "../lib/content";
import { isAndroid, native } from "../lib/platform";

interface Speech {
  available: boolean;
  active: string;
  speak: (text: string) => void;
  stop: () => void;
  reason?: string;
}
const SpeechContext = createContext<Speech>({
  available: false,
  active: "",
  speak: () => {},
  stop: () => {},
});
export function SpeechProvider({
  rate,
  children,
}: {
  rate: number;
  children: ReactNode;
}) {
  return isAndroid ? (
    <AndroidSpeechProvider rate={rate}>{children}</AndroidSpeechProvider>
  ) : (
    <BrowserSpeechProvider rate={rate}>{children}</BrowserSpeechProvider>
  );
}
function AndroidSpeechProvider({
  rate,
  children,
}: {
  rate: number;
  children: ReactNode;
}) {
  const [available, setAvailable] = useState(false),
    [active, setActive] = useState(""),
    [reason, setReason] = useState("Проверяем греческий голос на устройстве…");
  const activeId = useRef("");
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (document.hidden) return;
      void native
        .speechStatus()
        .then((status) => {
          if (!mounted) return;
          setAvailable(status.available);
          setReason(
            status.available
              ? ""
              : "Установите греческий голос для работы без интернета в настройках синтеза речи Android.",
          );
        })
        .catch(() => {
          if (mounted) setReason("Не удалось подключить синтез речи Android.");
        });
    };
    const listener = native.addListener("speechFinished", (event) => {
      if (mounted && event.id === activeId.current) setActive("");
    });
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", refresh);
      void listener.then((handle) => handle.remove());
      void native.stopSpeech();
    };
  }, []);
  function stop() {
    activeId.current = "";
    setActive("");
    void native.stopSpeech();
  }
  function speak(text: string) {
    const id = crypto.randomUUID();
    activeId.current = id;
    setActive(text);
    void native.speak({ text, rate, id }).catch(() => {
      if (activeId.current !== id) return;
      setActive("");
      setAvailable(false);
      setReason(
        "Греческая озвучка недоступна. Проверьте установленный голос в настройках Android.",
      );
    });
  }
  return (
    <SpeechContext.Provider value={{ available, active, speak, stop, reason }}>
      {children}
    </SpeechContext.Provider>
  );
}
function BrowserSpeechProvider({
  rate,
  children,
}: {
  rate: number;
  children: ReactNode;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [active, setActive] = useState("");
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.speechSynthesis.cancel();
    };
  }, []);
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith("el"));
  function stop() {
    window.speechSynthesis?.cancel();
    setActive("");
  }
  function speak(text: string) {
    if (!voice) return;
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = "el-GR";
    utterance.rate = rate;
    utterance.onend = () => setActive("");
    utterance.onerror = () => setActive("");
    setActive(text);
    window.speechSynthesis.speak(utterance);
  }
  return (
    <SpeechContext.Provider
      value={{ available: Boolean(voice), active, speak, stop }}
    >
      {children}
    </SpeechContext.Provider>
  );
}
export function Speak({
  text,
  label = "Послушать",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const speech = useContext(SpeechContext),
    playing = speech.active === text;
  return (
    <span className="speech-control">
      <button
        type="button"
        className={compact ? "icon-button speak" : "button button-quiet"}
        disabled={!speech.available && !isAndroid}
        aria-label={
          !speech.available
            ? isAndroid
              ? "Установить греческую озвучку"
              : "В браузере нет греческого голоса"
            : playing
              ? "Остановить озвучку"
              : label
        }
        title={
          speech.available
            ? isAndroid
              ? "Греческий голос Android, без интернета"
              : "Греческий голос браузера"
            : speech.reason ||
              "В этом браузере нет греческого голоса. Текст и аудиофрагменты упражнений доступны."
        }
        onClick={() =>
          !speech.available && isAndroid
            ? void native.openSpeechSettings().catch(() => {})
            : playing
              ? speech.stop()
              : speech.speak(text)
        }
      >
        {speech.available ? <Volume2 size={18} /> : <VolumeX size={18} />}{" "}
        {!compact &&
          (!speech.available
            ? isAndroid
              ? "Установить озвучку"
              : "Озвучка недоступна"
            : playing
              ? "Остановить"
              : label)}
      </button>
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const close = () => closeRef.current();
    d?.addEventListener("cancel", close);
    return () => {
      d?.removeEventListener("cancel", close);
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={"modal " + (wide ? "modal-wide" : "")}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть">
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Sources({
  ids,
  onClose,
}: {
  ids: string[];
  onClose: () => void;
}) {
  return (
    <Modal title="Откуда это задание" onClose={onClose}>
      <p className="muted">
        Карточки составлены по темам присланных экзаменов. Авторский ответ может
        отличаться от формулировки в источнике.
      </p>
      <div className="source-list">
        {ids.map((id) => {
          const s = sources[id];
          return s ? (
            <article className="source-entry" key={id}>
              <span className="eyebrow">{s.year} · A2</span>
              <h3>{s.description}</h3>
              <p>Κέντρο Ελληνικής Γλώσσας · ελληνομάθεια</p>
              {s.printed_page && <p>Страница сборника: {s.printed_page}</p>}
            </article>
          ) : null;
        })}
      </div>
    </Modal>
  );
}
export function SourceButton({
  ids,
  onClick,
}: {
  ids: string[];
  onClick: (ids: string[]) => void;
}) {
  return (
    <button className="source-button" onClick={() => onClick(ids)}>
      <Info size={14} /> Источник ·{" "}
      {Array.from(new Set(ids.map((id) => sources[id]?.year))).join(", ")}
    </button>
  );
}
export function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill pill-" + tone}>{children}</span>;
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">φ</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function SmallArrow({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
export function PhraseContext({ phrase }: { phrase: Phrase }) {
  return phrase.context ? (
    <p className="context-note">{phrase.context}</p>
  ) : null;
}
