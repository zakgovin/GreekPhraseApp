import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, HelpCircle, Keyboard, Mic, Square, X } from "lucide-react";
import {
  lessonExercise,
  type AnswerMethod,
  type ExerciseKind,
} from "../lib/lesson";
import { newDraft, type Draft } from "../lib/progress";
import {
  speechInput,
  speechInputStatus,
  type SpeechInputStatus,
} from "../lib/speech-input";

const VoiceContext = createContext<SpeechInputStatus>({
  available: false,
  reason: "",
});
export function SpeechAnswerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SpeechInputStatus>({
    available: false,
    reason: "",
  });
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!document.hidden)
        void speechInputStatus().then((value) => {
          if (mounted) setStatus(value);
        });
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return (
    <VoiceContext.Provider value={status}>{children}</VoiceContext.Provider>
  );
}
export const useSpeechAnswer = () => useContext(VoiceContext);

export function Answer({
  expected,
  kind,
  seed,
  draft = newDraft(),
  onDraft,
  onSubmit,
  onHelp,
  onRecognitionFailure,
}: {
  expected: string;
  kind: ExerciseKind;
  seed: string;
  draft?: Draft;
  onDraft: (draft: Draft) => void;
  onSubmit: (answer: string, method: AnswerMethod) => void;
  onHelp: () => void;
  onRecognitionFailure?: () => void;
}) {
  const voice = useSpeechAnswer();
  const exercise = lessonExercise(expected, kind, seed);
  const mode: AnswerMethod =
    draft.answers.input === "text" || draft.answers.input === "speech"
      ? draft.answers.input
      : kind === "recall"
        ? "text"
        : "words";
  const selected = (draft.answers.order ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(
      (id, index, values) =>
        Number.isInteger(id) &&
        id >= 0 &&
        id < exercise.words.length &&
        values.indexOf(id) === index,
    );
  const [listening, setListening] = useState(false),
    [error, setError] = useState("");
  const request = useRef("");
  const mounted = useRef(true);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (request.current)
        void speechInput.cancel({ id: request.current }).catch(() => {});
    };
  }, []);
  function patch(values: Partial<Draft>, answers?: Record<string, string>) {
    const current = currentDraft.current;
    onDraft({
      ...current,
      ...values,
      answers: { ...current.answers, ...answers },
    });
  }
  async function listen() {
    if (listening) {
      await speechInput.stop({ id: request.current }).catch(() => {});
      return;
    }
    const id = crypto.randomUUID();
    request.current = id;
    setError("");
    setListening(true);
    try {
      const result = await speechInput.listen({ id });
      if (mounted.current && request.current === id)
        patch({ text: result.text }, { input: "speech" });
    } catch (error) {
      if (
        mounted.current &&
        (error as { code?: string }).code !== "CANCELLED"
      ) {
        setError(
          "Не удалось разобрать речь. Можно попробовать ещё раз или ответить на экране — это не считается ошибкой.",
        );
        onRecognitionFailure?.();
      }
    } finally {
      if (mounted.current && request.current === id) setListening(false);
    }
  }
  const answer =
    mode === "words"
      ? selected.map((id) => exercise.words[id]).join(" ")
      : draft.text;
  const completeChoice = kind === "complete" && mode === "words";
  return (
    <div className="checked-answer">
      {mode === "words" && completeChoice ? (
        <>
          <p className="exercise-instruction">Какое слово пропущено?</p>
          <p className="cloze-sentence" lang="el">
            {exercise.words.map((word, index) =>
              index === exercise.missing ? (
                <span className="word-gap" key={index}>
                  …
                </span>
              ) : (
                <span key={index}>{word} </span>
              ),
            )}
          </p>
          <div
            className="word-bank cloze-options"
            role="group"
            aria-label="Варианты слова"
          >
            {exercise.options.map((option) => (
              <button
                className="word-chip"
                key={option.id}
                lang="el"
                onClick={() => onSubmit(option.text, "words")}
              >
                {option.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim() && !listening) onSubmit(answer, mode);
          }}
        >
          {mode === "words" ? (
            <>
              <p className="exercise-instruction">Собери фразу из урока</p>
              <div
                className="sentence-answer"
                aria-label="Твой ответ"
                aria-live="polite"
                lang="el"
              >
                {!selected.length && (
                  <span className="answer-placeholder">
                    Нажимай на слова в нужном порядке
                  </span>
                )}
                {selected.map((id) => (
                  <button
                    type="button"
                    className="word-chip selected"
                    key={id}
                    aria-label={"Убрать слово " + exercise.words[id]}
                    onClick={() =>
                      patch(
                        {},
                        {
                          order: selected
                            .filter((value) => value !== id)
                            .join(","),
                        },
                      )
                    }
                  >
                    {exercise.words[id]}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div
                className="word-bank"
                role="group"
                aria-label="Слова для ответа"
              >
                {exercise.options.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className="word-chip"
                    data-word-id={option.id}
                    disabled={selected.includes(option.id)}
                    lang="el"
                    onClick={() =>
                      patch({}, { order: [...selected, option.id].join(",") })
                    }
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <label className="answer-input-label">
              <span>
                {mode === "speech"
                  ? "Распознанные слова — можно исправить"
                  : "Напиши изученную фразу по-гречески"}
              </span>
              <textarea
                aria-label="Ответ по-гречески"
                lang="el"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={draft.text}
                onChange={(event) =>
                  patch({ text: event.target.value }, { input: "text" })
                }
                placeholder="Твой ответ…"
                rows={3}
                maxLength={3000}
              />
            </label>
          )}
          <button
            type="submit"
            className="button button-primary button-large check-answer"
            disabled={!answer.trim() || listening}
          >
            Проверить <ArrowRight size={18} />
          </button>
        </form>
      )}
      <div className="answer-tools">
        {voice.available && (
          <button
            type="button"
            className={"button button-quiet " + (listening ? "listening" : "")}
            onClick={() => void listen()}
          >
            {listening ? <Square size={17} /> : <Mic size={17} />}
            {listening ? "Закончить ответ" : "Ответить голосом"}
          </button>
        )}
        {mode === "words" ? (
          <button
            type="button"
            className="text-link"
            onClick={() => patch({}, { input: "text" })}
          >
            <Keyboard size={16} />
            Написать самому
          </button>
        ) : kind !== "recall" ? (
          <button
            type="button"
            className="text-link"
            onClick={() => patch({}, { input: "words" })}
          >
            Ответить словами на экране
          </button>
        ) : null}
        <button type="button" className="text-link" onClick={onHelp}>
          <HelpCircle size={16} />
          Не помню
        </button>
      </div>
      {(listening || mode === "speech") && (
        <p className="microcopy" role="status">
          {listening
            ? "Слушаю… Скажи фразу по-гречески."
            : "Проверим распознанные слова. Точность акцента не оценивается."}
        </p>
      )}
      {error && (
        <p className="inline-notice" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
