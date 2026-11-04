import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Volume2,
  VolumeX,
  X,
  Mic,
  Square,
  ExternalLink,
  Info,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { sources, type Phrase } from "../lib/content";
import { getRecording, saveRecording } from "../lib/media";
import { isAndroid, native, nativeFileUrl } from "../lib/platform";

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
        disabled={!speech.available}
        aria-label={
          !speech.available
            ? isAndroid
              ? "На устройстве нет греческого голоса"
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
              "В этом браузере нет греческого голоса. Текст и оригинальные записи доступны."
        }
        onClick={() => (playing ? speech.stop() : speech.speak(text))}
      >
        {speech.available ? <Volume2 size={18} /> : <VolumeX size={18} />}{" "}
        {!compact && (playing ? "Остановить" : label)}
      </button>
      {!speech.available && !compact && (
        <small className="speech-unavailable">
          {speech.reason ||
            "В браузере нет греческого голоса. Оригинальное аудио доступно в разделе «Экзамен»."}
          {isAndroid && (
            <button
              className="text-link"
              onClick={() => {
                void native.openSpeechSettings().catch(() => {});
              }}
            >
              Настройки голоса Android <ExternalLink size={14} />
            </button>
          )}
        </small>
      )}
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

export function Recorder({
  recordingKey,
  onRecorded,
}: {
  recordingKey: string;
  onRecorded?: () => void;
}) {
  return isAndroid ? (
    <AndroidRecorder
      key={recordingKey}
      recordingKey={recordingKey}
      onRecorded={onRecorded}
    />
  ) : (
    <BrowserRecorder recordingKey={recordingKey} onRecorded={onRecorded} />
  );
}
function AndroidRecorder({
  recordingKey,
  onRecorded,
}: {
  recordingKey: string;
  onRecorded?: () => void;
}) {
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const callback = useRef(onRecorded);
  callback.current = onRecorded;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void native
      .getRecording({ key: recordingKey })
      .then((result) => {
        if (mounted.current && result.exists && result.path)
          setUrl(nativeFileUrl(result.path));
      })
      .catch(() => {
        if (mounted.current) setError("Не удалось прочитать запись.");
      });
    const listener = native.addListener("recordingStopped", (result) => {
      if (!mounted.current || result.key !== recordingKey) return;
      setRecording(false);
      if (result.exists && result.path) {
        setUrl(nativeFileUrl(result.path) + "?t=" + Date.now());
        callback.current?.();
      } else
        setError(
          "Запись слишком короткая или не сохранилась. Попробуйте ещё раз.",
        );
    });
    return () => {
      mounted.current = false;
      void listener.then((handle) => handle.remove());
      void native.stopRecording({ key: recordingKey }).catch(() => {});
    };
  }, [recordingKey]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (recording) await native.stopRecording({ key: recordingKey });
      else {
        await native.startRecording({ key: recordingKey });
        if (mounted.current) setRecording(true);
        else await native.stopRecording({ key: recordingKey });
      }
    } catch {
      if (mounted.current) {
        setRecording(false);
        setError(
          "Микрофон недоступен. Разрешите запись звука в настройках приложения или ответьте текстом.",
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="recorder">
      <div className="recorder-controls">
        <button
          className={
            "button " + (recording ? "button-recording" : "button-outline")
          }
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : recording ? (
            <Square size={16} />
          ) : (
            <Mic size={17} />
          )}
          {recording
            ? "Остановить запись"
            : url
              ? "Записать заново"
              : "Записать ответ"}
        </button>
        <span className="microcopy">
          {recording
            ? "Идёт запись… До 3 минут"
            : "Запись остаётся на устройстве"}
        </span>
      </div>
      {url && <audio controls src={url} aria-label="Ваша запись ответа" />}
      {error && (
        <p role="status" className="inline-notice">
          {error}
        </p>
      )}
    </div>
  );
}
function BrowserRecorder({
  recordingKey,
  onRecorded,
}: {
  recordingKey: string;
  onRecorded?: () => void;
}) {
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    mounted = useRef(true),
    urlRef = useRef(""),
    callback = useRef(onRecorded);
  callback.current = onRecorded;
  function assign(blob: Blob) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    setUrl(urlRef.current);
  }
  useEffect(() => {
    mounted.current = true;
    getRecording(recordingKey)
      .then((blob) => {
        if (blob && mounted.current) {
          assign(blob);
        }
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [recordingKey]);
  async function start() {
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Запись недоступна в этом браузере. Можно ответить вслух или написать ответ.",
      );
      return;
    }
    setBusy(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        if (mounted.current) {
          setRecording(false);
          assign(blob);
          callback.current?.();
        }
        try {
          await saveRecording(recordingKey, blob);
        } catch {
          if (mounted.current)
            setError(
              "Запись можно прослушать сейчас, но сохранить её не удалось.",
            );
        }
      };
      r.start();
      setRecording(true);
    } catch {
      setError(
        "Микрофон недоступен или доступ не разрешён. Вы можете ответить вслух или текстом.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="recorder">
      <div className="recorder-controls">
        <button
          className={
            "button " + (recording ? "button-recording" : "button-outline")
          }
          disabled={busy}
          onClick={() => (recording ? recorder.current?.stop() : void start())}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : recording ? (
            <Square size={16} />
          ) : (
            <Mic size={17} />
          )}{" "}
          {recording
            ? "Остановить запись"
            : url
              ? "Записать заново"
              : "Записать ответ"}
        </button>
        <span className="microcopy">
          {recording ? "Идёт запись…" : "Запись остаётся в этом браузере"}
        </span>
      </div>
      {url && <audio controls src={url} aria-label="Ваша запись ответа" />}
      {error && (
        <p role="status" className="inline-notice">
          {error}
        </p>
      )}
    </div>
  );
}
