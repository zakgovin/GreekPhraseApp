import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  HelpCircle,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { conversations, type Conversation } from "../data/curriculum";
import { useApp } from "../state";
import { newDraft } from "../lib/progress";
import { Pill, Recorder, SourceButton, Speak } from "../components/common";

export function Conversations() {
  const { progress: p } = useApp();
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("frasi.openConversation");
    } catch {
      return null;
    }
  });
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    try {
      sessionStorage.removeItem("frasi.openConversation");
    } catch {}
  }, []);
  const active = conversations.find((c) => c.id === selected);
  if (active)
    return (
      <ConversationPractice
        key={active.id}
        task={active}
        onBack={() => setSelected(null)}
      />
    );
  const visible = conversations.filter(
    (c) => filter === "all" || c.kind === filter,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ЖИВОЙ ЯЗЫК НАЧИНАЕТСЯ С ОТВЕТА</p>
          <h1>
            Давайте поговорим<span className="heading-dot">.</span>
          </h1>
          <p>
            Знакомые темы, новые вопросы. Сначала ваш ответ — затем образец.
          </p>
        </div>
        <Pill tone="outline">{conversations.length} бесед и ситуаций</Pill>
      </div>
      <div className="segmented" aria-label="Тип беседы">
        {[
          { id: "all", label: "Все темы" },
          { id: "personal", label: "О моей жизни" },
          { id: "role", label: "Ролевые ситуации" },
        ].map((f) => (
          <button
            className={filter === f.id ? "selected" : ""}
            onClick={() => setFilter(f.id)}
            key={f.id}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="conversation-grid">
        {visible.map((c, i) => {
          const completed = p.practice.some((r) => r.taskId === c.id),
            draft = p.drafts[c.id],
            continuing = draft && draft.turn > 0 && draft.turn < c.turns.length;
          return (
            <button
              className={"conversation-tile tone-" + c.color}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <div className="tile-visual">
                <span className="conversation-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <MessageCircle size={40} strokeWidth={1.1} />
                <span className="conversation-status">
                  {completed ? (
                    <>
                      <Check size={14} />
                      Пройдено
                    </>
                  ) : continuing ? (
                    "Продолжить"
                  ) : (
                    "Начать"
                  )}
                </span>
              </div>
              <div className="tile-content">
                <Pill tone={c.kind === "personal" ? "green" : "sand"}>
                  {c.kind === "personal" ? "Обо мне" : "Учебная роль"}
                </Pill>
                <h2>{c.title}</h2>
                <p>{c.subtitle}</p>
                <footer>
                  <span>{c.turns.length} вопроса · свой ответ</span>
                  <ArrowRight size={18} />
                </footer>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
function ConversationPractice({
  task,
  onBack,
}: {
  task: Conversation;
  onBack: () => void;
}) {
  const { progress: p, update, source } = useApp(),
    d = p.drafts[task.id] ?? newDraft(),
    [answered, setAnswered] = useState(false);
  const count = p.practice.filter((r) => r.taskId === task.id).length,
    turn = task.turns[d.turn],
    complete = d.turn >= task.turns.length;
  function patch(value: Partial<typeof d>) {
    update((prev) => ({
      ...prev,
      drafts: {
        ...prev.drafts,
        [task.id]: { ...(prev.drafts[task.id] ?? newDraft()), ...value },
      },
    }));
  }
  function rate(value: number) {
    const now = new Date().toISOString(),
      expected = d.turn;
    update((prev) => {
      const current = prev.drafts[task.id] ?? newDraft();
      if (current.turn !== expected || !current.shown) return prev;
      const ratings = [...current.ratings, value],
        next = {
          ...current,
          turn: current.turn + 1,
          shown: false,
          text: "",
          ratings,
          answers: {
            ...current.answers,
            ["turn-" + current.turn]: current.text,
          },
        };
      const finished = next.turn >= task.turns.length;
      return {
        ...prev,
        drafts: { ...prev.drafts, [task.id]: next },
        practice: finished
          ? [
              ...prev.practice,
              {
                id: crypto.randomUUID(),
                taskId: task.id,
                skill: "speaking",
                at: now,
                assisted: current.helped,
                correct: ratings.filter((r) => r > 1).length,
                total: task.turns.length,
              },
            ]
          : prev.practice,
      };
    });
    setAnswered(false);
  }
  if (complete)
    return (
      <div className="session-summary">
        <div className="summary-icon">
          <CheckCheck size={40} />
        </div>
        <Pill>Практика сохранена</Pill>
        <h1>Разговор состоялся.</h1>
        <p>
          Вы потренировали тему «{task.title}». В следующий раз вопросы могут
          звучать немного иначе.
        </p>
        <div className="summary-stats">
          <div>
            <strong>{d.ratings.filter((r) => r > 1).length}</strong>
            <span>ответов удалось</span>
          </div>
          <div>
            <strong>{task.turns.length}</strong>
            <span>вопросов всего</span>
          </div>
        </div>
        {d.helped && (
          <p className="inline-notice">
            В этой беседе использовалась помощь. Позже попробуйте без неё.
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-primary"
            data-native-back
            onClick={onBack}
          >
            К другим темам
            <ArrowRight size={17} />
          </button>
          <button
            className="button button-outline"
            onClick={() => {
              patch(newDraft());
              setAnswered(false);
            }}
          >
            <RotateCcw size={16} />
            Ещё раз
          </button>
        </div>
      </div>
    );
  const question = count % 2 && turn.alternative ? turn.alternative : turn.el;
  return (
    <>
      <button className="back-link" data-native-back onClick={onBack}>
        <ArrowLeft size={17} />
        Все разговорные темы
      </button>
      <div className="practice-heading">
        <div>
          <p className="eyebrow">
            {task.kind === "personal" ? "О МОЕЙ ЖИЗНИ" : "УЧЕБНАЯ РОЛЕВАЯ ИГРА"}
          </p>
          <h1>{task.title}</h1>
        </div>
        <Pill tone="outline">
          Вопрос {d.turn + 1} из {task.turns.length}
        </Pill>
      </div>
      <div className="practice-layout">
        <aside className="practice-guide">
          <MessageCircle size={28} />
          <h3>{task.kind === "personal" ? "Будьте собой" : "Ваша роль"}</h3>
          <p>{task.context}</p>
          <ol>
            {task.turns.map((t, i) => (
              <li
                key={i}
                className={i === d.turn ? "current" : i < d.turn ? "done" : ""}
              >
                <span>{i < d.turn ? <Check size={13} /> : i + 1}</span>
                {t.ru}
              </li>
            ))}
          </ol>
          <SourceButton ids={task.sources} onClick={source} />
        </aside>
        <section className="panel conversation-stage" key={d.turn}>
          <span className="eyebrow">ВАС СПРАШИВАЮТ</span>
          <div className="question-bubble">
            <p lang="el">{question}</p>
            <Speak text={question} compact />
          </div>
          <button
            className="text-link help-link"
            onClick={() =>
              patch({
                helped: true,
                answers: { ...d.answers, translation: question },
              })
            }
          >
            <HelpCircle size={15} />
            Показать перевод вопроса
          </button>
          {d.answers.translation === question && (
            <p className="translation">{turn.ru}</p>
          )}
          <p className="muted">
            Ответьте вслух или напишите. Точная формулировка образца не
            обязательна.
          </p>
          <Recorder
            key={task.id + ":" + d.turn}
            recordingKey={task.id + ":" + d.turn}
            onRecorded={() => setAnswered(true)}
          />
          <label className="input-label" htmlFor="conversation-answer">
            Или ответьте текстом
          </label>
          <textarea
            id="conversation-answer"
            lang="el"
            rows={3}
            value={d.text}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="Ваш ответ на греческом…"
          />
          {!d.shown ? (
            <div className="recall-actions">
              <button
                className="button button-primary"
                disabled={!answered && !d.text.trim()}
                onClick={() => patch({ shown: true })}
              >
                <Eye size={17} />
                Сравнить с образцом
              </button>
              {!answered && !d.text.trim() && (
                <button
                  className="button button-quiet"
                  onClick={() => setAnswered(true)}
                >
                  Я ответил вслух
                </button>
              )}
              <button
                className="text-link"
                onClick={() => patch({ helped: true, shown: true })}
              >
                Нужна помощь
              </button>
            </div>
          ) : (
            <div className="answer-panel">
              <div>
                <span className="eyebrow">ОДИН ИЗ ПОДХОДЯЩИХ ОТВЕТОВ</span>
                <Speak text={turn.answer} compact />
              </div>
              <p lang="el" className="answer-greek">
                {turn.answer}
              </p>
              <ul className="criteria">
                {turn.points.map((point) => (
                  <li key={point}>
                    <Check size={15} />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="microcopy">
                Оцените смысл своего ответа. Приложение не выставляет
                автоматический балл за произношение.
              </p>
              <div className="dialog-actions">
                <button
                  className="button button-outline"
                  onClick={() => rate(1)}
                >
                  Нужно потренировать
                </button>
                <button
                  className="button button-primary"
                  onClick={() => rate(3)}
                >
                  Мне удалось
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
