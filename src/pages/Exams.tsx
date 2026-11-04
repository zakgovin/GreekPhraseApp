import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  Headphones,
  Image as ImageIcon,
  PenLine,
  Play,
  RotateCcw,
  MessageCircle,
} from "lucide-react";
import {
  writingTasks,
  imageTasks,
  listeningTasks,
  conversations,
  type WritingTask,
  type ImageTask,
  type ListeningTask,
} from "../data/curriculum";
import { useApp } from "../state";
import { newDraft } from "../lib/progress";
import { phrases, wordCount, type Skill } from "../lib/content";
import { checkListening } from "../lib/exercises";
import { Pill, Recorder, SourceButton, Speak } from "../components/common";

type Selection = { kind: "writing" | "image" | "listening"; id: string };
export function Exams() {
  const { navigate } = useApp(),
    [tab, setTab] = useState("writing"),
    [selected, setSelected] = useState<Selection | null>(null),
    [control, setControl] = useState(false);
  const back = () => setSelected(null);
  if (selected) {
    const props = { control, onBack: back };
    if (selected.kind === "writing") {
      const task = writingTasks.find((t) => t.id === selected.id);
      if (task) return <Writing task={task} {...props} />;
    }
    if (selected.kind === "image") {
      const task = imageTasks.find((t) => t.id === selected.id);
      if (task) return <Picture task={task} {...props} />;
    }
    if (selected.kind === "listening") {
      const task = listeningTasks.find((t) => t.id === selected.id);
      if (task) return <Listening task={task} {...props} />;
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПРИМЕНЯЕМ ВЫУЧЕННОЕ</p>
          <h1>
            Ближе к экзамену<span className="heading-dot">.</span>
          </h1>
          <p>
            Настоящие темы 2015–2018 годов. Отдельные задания в вашем темпе.
          </p>
        </div>
        <Pill tone="outline">Κέντρο Ελληνικής Γλώσσας · A2</Pill>
      </div>
      <div className="exam-toolbar">
        <div className="segmented">
          {[
            { id: "writing", label: "Письмо", icon: PenLine },
            { id: "image", label: "Картинки", icon: ImageIcon },
            { id: "listening", label: "Аудирование", icon: Headphones },
            { id: "role", label: "Роли", icon: MessageCircle },
          ].map((t) => (
            <button
              className={tab === t.id ? "selected" : ""}
              key={t.id}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={control}
            onChange={(e) => setControl(e.target.checked)}
          />
          <span className="toggle-track" />
          Без подсказок
        </label>
      </div>
      <p className="exam-intro">
        {control
          ? "Сначала выполните задание целиком. Образцы и помощь откроются после сохранения попытки."
          : "Можно посмотреть языковую опору или расшифровку. Такая попытка будет отмечена как работа с помощью."}
      </p>
      {tab === "writing" ? (
        <div className="exercise-grid">
          {writingTasks.map((t, i) => (
            <button
              className="exercise-tile"
              onClick={() => setSelected({ kind: "writing", id: t.id })}
              key={t.id}
            >
              <div className="exercise-tile-top">
                <span className="stat-icon peach">
                  <PenLine size={21} />
                </span>
                <span className="exercise-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <Pill tone="sand">{t.subtitle}</Pill>
              <h2>{t.title}</h2>
              <p>{t.points.slice(0, 3).join(" · ")}</p>
              <footer>
                <span>80–100 слов</span>
                <ArrowRight size={17} />
              </footer>
            </button>
          ))}
        </div>
      ) : tab === "image" ? (
        <div className="exercise-grid image-grid">
          {imageTasks.map((t) => (
            <button
              className="image-tile"
              key={t.id}
              onClick={() => setSelected({ kind: "image", id: t.id })}
            >
              <img
                src={"/images/" + t.image + ".png"}
                alt={"Фотография к заданию «" + t.title + "»"}
                loading="lazy"
              />
              <div>
                <Pill tone="outline">Описание картинки</Pill>
                <h2>{t.title}</h2>
                <span>
                  {t.questions.length} вопроса
                  <ArrowRight size={17} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : tab === "listening" ? (
        <>
          <div className="audio-intro">
            <Headphones size={26} />
            <div>
              <h2>Диалоги из экзамена</h2>
              <p>
                Короткая беседа для каждого упражнения. Слушайте, находите
                детали и повторяйте в своём темпе.
              </p>
            </div>
          </div>
          <div className="exercise-grid two-columns">
            {listeningTasks.map((t) => (
              <button
                className="exercise-tile audio-tile"
                key={t.id}
                onClick={() => setSelected({ kind: "listening", id: t.id })}
              >
                <div className="audio-wave" aria-hidden="true">
                  {Array.from({ length: 23 }, (_, i) => (
                    <i
                      style={{ height: 12 + ((i * 17) % 39) + "px" }}
                      key={i}
                    />
                  ))}
                </div>
                <Pill tone="blue">{t.year} · аудиофрагмент</Pill>
                <h2>{t.title}</h2>
                <p>
                  {audioDuration(t.audio.durationSeconds)} · Семь вопросов по
                  сюжету.
                </p>
                <footer>
                  <span>Задание 4 · аудирование</span>
                  <Play size={19} />
                </footer>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="exercise-grid">
          {conversations
            .filter((c) => c.kind === "role")
            .map((c) => (
              <button
                className="exercise-tile"
                key={c.id}
                onClick={() => {
                  sessionStorage.setItem("frasi.openConversation", c.id);
                  navigate("conversation");
                }}
              >
                <span className="stat-icon mint">
                  <MessageCircle size={22} />
                </span>
                <Pill tone="sand">Учебная роль</Pill>
                <h2>{c.title}</h2>
                <p>{c.subtitle}</p>
                <footer>
                  <span>{c.turns.length} реплики</span>
                  <ArrowRight size={17} />
                </footer>
              </button>
            ))}
        </div>
      )}
      <p className="bottom-note">
        <CheckCheck size={17} />
        Это тренировка отдельных навыков, а не официальный пробный экзамен.
      </p>
    </>
  );
}

function useExercise(id: string) {
  const { progress: p, update } = useApp(),
    draft = p.drafts[id] ?? newDraft();
  function patch(value: Partial<typeof draft>) {
    update((prev) => ({
      ...prev,
      drafts: {
        ...prev.drafts,
        [id]: { ...(prev.drafts[id] ?? newDraft()), ...value },
      },
    }));
  }
  function finish(skill: Skill, correct: number, total: number) {
    const at = new Date().toISOString();
    update((prev) => {
      const d = prev.drafts[id] ?? newDraft();
      if (d.shown) return prev;
      return {
        ...prev,
        drafts: { ...prev.drafts, [id]: { ...d, shown: true } },
        practice: [
          ...prev.practice,
          {
            id: crypto.randomUUID(),
            taskId: id,
            skill,
            at,
            assisted: d.helped,
            correct,
            total,
          },
        ],
      };
    });
  }
  return { draft, patch, finish };
}
function Header({
  title,
  subtitle,
  onBack,
  source,
  onSource,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  source: string;
  onSource?: () => void;
}) {
  const { source: showSource } = useApp();
  return (
    <>
      <button className="back-link" data-native-back onClick={onBack}>
        <ArrowLeft size={17} />
        Все экзаменационные задания
      </button>
      <div className="practice-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h1>{title}</h1>
        </div>
        <SourceButton
          ids={[source]}
          onClick={(ids) => {
            onSource?.();
            showSource(ids);
          }}
        />
      </div>
    </>
  );
}
function Writing({
  task,
  control,
  onBack,
}: {
  task: WritingTask;
  control: boolean;
  onBack: () => void;
}) {
  const { draft: d, patch, finish } = useExercise(task.id),
    words = wordCount(d.text),
    within = words >= 80 && words <= 100;
  const cardNumbers =
    task.id === "write-2015-1"
      ? [61, 62, 63, 64, 65]
      : task.id === "write-2015-2"
        ? [71, 72, 73, 74]
        : task.id === "write-2016-1"
          ? [66, 67, 68]
          : task.id === "write-2016-2"
            ? [2, 13, 14, 19, 21, 22]
            : task.id === "write-2017-2"
              ? [69, 70]
              : task.id === "write-2018-1"
                ? [19, 20, 23]
                : task.id === "write-2018-2"
                  ? [75]
                  : [];
  const helpful = phrases.filter((c) =>
    cardNumbers.includes(Number(c.id.slice(3))),
  );
  return (
    <>
      <Header
        title={task.title}
        subtitle={task.subtitle + " · 80–100 слов"}
        source={task.source}
        onBack={onBack}
      />
      <div className="writing-layout">
        <section className="panel writing-editor">
          <div className="editor-toolbar">
            <span>
              <PenLine size={17} />
              Ваш текст
            </span>
            <Pill tone={within ? "green" : "sand"}>{words} / 80–100 слов</Pill>
          </div>
          <textarea
            aria-label="Текст письма на греческом"
            lang="el"
            value={d.text}
            onChange={(e) => patch({ text: e.target.value, shown: false })}
            placeholder="Начните письмо на греческом…"
            maxLength={12000}
          />
          <div className="editor-footer">
            <span className="microcopy">
              Черновик сохраняется автоматически
            </span>
            <button
              className="button button-primary"
              disabled={!d.text.trim() || d.shown}
              onClick={() =>
                finish(
                  "writing",
                  d.checks.filter(Boolean).length + (within ? 1 : 0),
                  task.points.length + 1,
                )
              }
            >
              {d.shown ? (
                <>
                  <Check size={17} />
                  Попытка сохранена
                </>
              ) : (
                <>
                  Сохранить попытку
                  <CheckCheck size={17} />
                </>
              )}
            </button>
          </div>
          {d.shown && (
            <div className="exercise-result" role="status">
              <strong>
                Сохранено: {d.checks.filter(Boolean).length} из{" "}
                {task.points.length} содержательных пунктов.
              </strong>
              <p>
                {within
                  ? "Объём соответствует 80–100 словам."
                  : "Объём пока не соответствует 80–100 словам. Можно дополнить текст и сохранить новую попытку."}{" "}
                Орфографию, грамматику и связность оцените отдельно: приложение
                не выставляет официальный балл.
              </p>
              {d.helped && <Pill tone="sand">Использовалась помощь</Pill>}
            </div>
          )}
        </section>
        <aside className="panel writing-prompt">
          <span className="eyebrow">УСЛОВИЕ ЗАДАНИЯ</span>
          <p>{task.prompt}</p>
          <div className="signature-note">
            {task.signature === "fictional"
              ? "В конце подпишитесь вымышленным именем: так требует исходное задание."
              : "Не пишите имя в конце публичного текста: так требует исходное задание."}
          </div>
          <h3>Проверьте содержание</h3>
          <div className="checklist">
            {task.points.map((point, i) => (
              <label key={point}>
                <input
                  type="checkbox"
                  checked={d.checks[i] ?? false}
                  onChange={(e) => {
                    const checks = [...d.checks];
                    checks[i] = e.target.checked;
                    patch({ checks, shown: false });
                  }}
                />
                <span>{point}</span>
              </label>
            ))}
          </div>
          {helpful.length > 0 && (!control || d.shown) && (
            <details
              className="language-support"
              onToggle={(e) => {
                if (e.currentTarget.open && !d.shown) patch({ helped: true });
              }}
            >
              <summary>Фразы, которые могут пригодиться</summary>
              <p className="microcopy">
                Это отдельные реплики, а не готовое письмо.
              </p>
              {helpful.map((c) => (
                <div key={c.id}>
                  <p lang="el">{c.el}</p>
                  <span>{c.ru}</span>
                </div>
              ))}
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
function Picture({
  task,
  control,
  onBack,
}: {
  task: ImageTask;
  control: boolean;
  onBack: () => void;
}) {
  const { draft: d, patch, finish } = useExercise(task.id),
    [answered, setAnswered] = useState(false),
    [show, setShow] = useState(false);
  return (
    <>
      <Header
        title={task.title}
        subtitle="Устная часть · описание картинки"
        source={task.source}
        onBack={onBack}
      />
      <div className="picture-layout">
        <figure className="exam-photo">
          <img
            src={"/images/" + task.image + ".png"}
            alt={"Исходная фотография к заданию «" + task.title + "»"}
          />
          <figcaption>
            Фотография из присланного экзаменационного материала
          </figcaption>
        </figure>
        <section className="panel picture-answer">
          <span className="eyebrow">РАССКАЖИТЕ, ЧТО ВЫ ВИДИТЕ</span>
          {task.questions.map((q) => (
            <div className="picture-question" key={q}>
              <p lang="el">{q}</p>
              <Speak text={q} compact />
            </div>
          ))}
          <Recorder
            recordingKey={task.id}
            onRecorded={() => setAnswered(true)}
          />
          <textarea
            aria-label="Описание картинки"
            lang="el"
            rows={4}
            value={d.text}
            onChange={(e) => patch({ text: e.target.value, shown: false })}
            placeholder="Или напишите описание…"
          />
          {!answered && !d.text.trim() && (
            <button className="text-link" onClick={() => setAnswered(true)}>
              Я описал картинку вслух
            </button>
          )}
          <div className="checklist">
            {task.points.map((point, i) => (
              <label key={point}>
                <input
                  type="checkbox"
                  checked={d.checks[i] ?? false}
                  onChange={(e) => {
                    const checks = [...d.checks];
                    checks[i] = e.target.checked;
                    patch({ checks });
                  }}
                />
                <span>{point}</span>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="button button-primary"
              disabled={d.shown || (!answered && !d.text.trim())}
              onClick={() =>
                finish(
                  "speaking",
                  d.checks.filter(Boolean).length,
                  task.points.length,
                )
              }
            >
              {d.shown ? "Попытка сохранена" : "Сохранить попытку"}
              <Check size={17} />
            </button>
            {(!control || d.shown) && (
              <button
                className="button button-quiet"
                onClick={() => {
                  setShow(!show);
                  if (!d.shown) patch({ helped: true });
                }}
              >
                <Eye size={17} />
                Образец
              </button>
            )}
          </div>
          {show && (
            <div className="answer-panel">
              <span className="eyebrow">ПРИМЕР ОПИСАНИЯ</span>
              <p className="answer-greek" lang="el">
                {task.answer}
              </p>
              <Speak text={task.answer} />
            </div>
          )}
          {d.shown && (
            <p className="inline-notice" role="status">
              Попытка сохранена по вашей самооценке. Это не автоматическая
              оценка речи.{d.helped ? " Вы использовали помощь." : ""}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
function audioDuration(seconds: number) {
  const rounded = Math.round(seconds);
  return Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0");
}
function Listening({
  task,
  control,
  onBack,
}: {
  task: ListeningTask;
  control: boolean;
  onBack: () => void;
}) {
  const { draft: d, patch, finish } = useExercise(task.id),
    lastTime = useRef(0),
    heardSeconds = useRef(0),
    [transcript, setTranscript] = useState(false);
  const results = checkListening(task.fields, d.answers),
    correct = results.filter((r) => r.correct).length,
    heard = d.answers._heard === "yes";
  function playback(time: number) {
    const delta = time - lastTime.current;
    lastTime.current = time;
    if (delta > 0 && delta < 3) heardSeconds.current += delta;
    if (heardSeconds.current >= 5 && !heard)
      patch({ answers: { ...d.answers, _heard: "yes" } });
  }
  return (
    <>
      <Header
        title={task.title}
        subtitle={task.year + " · аудирование, задание 4"}
        source={task.source}
        onBack={onBack}
        onSource={() => {
          if (!d.shown) patch({ helped: true });
        }}
      />
      <div className="listening-layout">
        <section className="panel listening-player">
          <span className="stat-icon mint">
            <Headphones size={25} />
          </span>
          <h2>Слушайте и находите детали</h2>
          <p>{task.context}</p>
          <Pill tone="blue">
            Аудиофрагмент · {audioDuration(task.audio.durationSeconds)}
          </Pill>
          <audio
            controls
            preload="metadata"
            aria-label={"Аудиофрагмент экзамена " + task.year}
            src={"/audio/" + task.audio.file}
            onTimeUpdate={(e) => playback(e.currentTarget.currentTime)}
            onSeeked={(e) => {
              lastTime.current = e.currentTarget.currentTime;
            }}
          />
          <p className="microcopy">
            Один диалог к этому упражнению. Можно прослушать его ещё раз.
          </p>
          {(!control || d.shown) && (
            <button
              className="button button-outline"
              onClick={() => {
                setTranscript(!transcript);
                if (!d.shown) patch({ helped: true });
              }}
            >
              <Eye size={17} />
              {transcript ? "Скрыть расшифровку" : "Открыть расшифровку"}
            </button>
          )}
          {transcript && (
            <div className="transcript">
              <span className="eyebrow">СОКРАЩЁННАЯ РАСШИФРОВКА ДИАЛОГА</span>
              <p lang="el">{task.transcript}</p>
            </div>
          )}
          {d.helped && (
            <p className="inline-notice">
              Вы открыли источник с ответами или расшифровку. Эта попытка не
              будет отмечена как самостоятельное аудирование.
            </p>
          )}
        </section>
        <section className="panel listening-answers">
          <h2>Запишите короткие ответы</h2>
          <p className="muted">
            По-гречески, словами или цифрами. Ответы относятся к героям записи.
          </p>
          {task.fields.map((field, i) => {
            const result = results[i];
            return (
              <label className="answer-field" key={field.id}>
                <span>
                  <i>{i + 1}</i>
                  {field.question}
                </span>
                <input
                  lang="el"
                  aria-label={field.question}
                  value={d.answers[field.id] ?? ""}
                  onChange={(e) =>
                    patch({
                      answers: { ...d.answers, [field.id]: e.target.value },
                      shown: false,
                      helped: d.helped || d.shown,
                    })
                  }
                  placeholder="Ваш ответ"
                  className={
                    d.shown
                      ? result.correct
                        ? "field-correct"
                        : "field-incorrect"
                      : ""
                  }
                />
                {d.shown && (
                  <small
                    className={
                      result.correct ? "correct-text" : "incorrect-text"
                    }
                  >
                    {result.correct
                      ? "Верно"
                      : "Ответ по ключу: " + field.display}
                  </small>
                )}
              </label>
            );
          })}
          <button
            className="button button-primary"
            disabled={
              d.shown ||
              (!heard && !d.helped) ||
              task.fields.some((f) => !d.answers[f.id]?.trim())
            }
            onClick={() => finish("understanding", correct, task.fields.length)}
          >
            Проверить ответы
            <ArrowRight size={17} />
          </button>
          {!heard && !d.helped && !d.shown && (
            <p className="microcopy">
              Сначала включите запись или откройте расшифровку для тренировки с
              помощью.
            </p>
          )}
          {d.shown && (
            <div className="exercise-result" role="status">
              <strong>
                {correct} из {task.fields.length} ответов совпали с ключом.
              </strong>
              <p>
                {d.helped
                  ? "Результат сохранён как работа с текстовой помощью."
                  : "Результат сохранён. Проверьте, какие детали было труднее расслышать."}
              </p>
              <button
                className="text-link"
                onClick={() => {
                  patch(newDraft());
                  setTranscript(false);
                  heardSeconds.current = 0;
                  lastTime.current = 0;
                }}
              >
                <RotateCcw size={15} />
                Новая попытка
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
