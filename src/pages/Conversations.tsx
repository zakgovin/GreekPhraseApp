import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { conversations, type Conversation } from "../data/curriculum";
import { useApp } from "../state";
import { newDraft, type Draft } from "../lib/progress";
import { matchesPhrase } from "../lib/lesson";
import { Answer } from "../components/Answer";
import { Pill, SourceButton, Speak } from "../components/common";

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
          <p>Потренируй короткие ответы: собери фразу, а мы проверим её.</p>
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
                  <span>{c.turns.length} вопроса · короткие ответы</span>
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
  const { progress: p, update, source } = useApp();
  const d = p.drafts[task.id] ?? newDraft(),
    turn = task.turns[d.turn];
  function patch(next: Draft) {
    update((prev) => ({
      ...prev,
      drafts: { ...prev.drafts, [task.id]: next },
    }));
  }
  function answer(value: string, helped = false) {
    const correct = !helped && matchesPhrase(turn.answer, value);
    update((prev) => {
      const current = prev.drafts[task.id] ?? newDraft();
      if (current.turn !== d.turn || current.shown) return prev;
      return {
        ...prev,
        drafts: {
          ...prev.drafts,
          [task.id]: {
            ...current,
            shown: true,
            helped: current.helped || helped,
            text: value,
            answers: {
              ...current.answers,
              result: correct ? "yes" : "no",
              turnHelp: helped ? "yes" : "no",
            },
          },
        },
      };
    });
  }
  function next() {
    update((prev) => {
      const current = prev.drafts[task.id] ?? newDraft();
      if (current.turn !== d.turn || !current.shown) return prev;
      const ratings = [
        ...current.ratings,
        current.answers.result === "yes" ? 3 : 1,
      ];
      const value = {
        ...newDraft(),
        turn: current.turn + 1,
        helped: current.helped,
        ratings,
        answers: { legacy: current.answers.legacy ?? "no" },
      };
      const finished = value.turn >= task.turns.length;
      return {
        ...prev,
        drafts: { ...prev.drafts, [task.id]: value },
        practice: finished
          ? [
              ...prev.practice,
              {
                id: crypto.randomUUID(),
                taskId: task.id,
                skill: "phrase",
                at: new Date().toISOString(),
                assisted: true,
                checked: current.answers.legacy !== "yes",
                correct: ratings.filter((rating) => rating > 1).length,
                total: task.turns.length,
              },
            ]
          : prev.practice,
      };
    });
  }
  if (!turn)
    return (
      <div className="session-summary">
        <div className="summary-icon">
          <CheckCheck size={40} />
        </div>
        <Pill>Практика сохранена</Pill>
        <h1>Разговор состоялся.</h1>
        <p>
          Ты потренировал ответы по теме «{task.title}». Вопросы можно послушать
          ещё раз.
        </p>
        <div className="summary-stats">
          <div>
            <strong>
              {d.ratings.filter((rating) => rating > 1).length} из{" "}
              {task.turns.length}
            </strong>
            <span>
              {d.answers.legacy === "yes"
                ? "включая раннюю самооценку"
                : "ответов по образцу"}
            </span>
          </div>
        </div>
        <div className="dialog-actions">
          <button
            className="button button-primary"
            data-native-back
            onClick={onBack}
          >
            К другим темам <ArrowRight size={17} />
          </button>
          <button
            className="button button-outline"
            onClick={() => patch(newDraft())}
          >
            <RotateCcw size={16} />
            Ещё раз
          </button>
        </div>
      </div>
    );
  return (
    <>
      <button className="back-link" data-native-back onClick={onBack}>
        <ArrowLeft size={17} />
        Все темы
      </button>
      <div className="practice-heading">
        <div>
          <p className="eyebrow">
            {task.kind === "role" ? "УЧЕБНАЯ РОЛЬ" : "О ТВОЕЙ ЖИЗНИ"}
          </p>
          <h1>{task.title}</h1>
        </div>
        <Pill tone="outline">
          {d.turn + 1} из {task.turns.length}
        </Pill>
      </div>
      <div className="practice-guide">
        <p>{task.context}</p>
        <SourceButton ids={task.sources} onClick={source} />
      </div>
      <section className="panel conversation-practice">
        <p className="eyebrow">ВОПРОС СОБЕСЕДНИКА</p>
        <h2 className="greek-display" lang="el">
          {turn.el}
        </h2>
        <Speak text={turn.el} label="Послушать вопрос" />
        <p>{turn.ru}</p>
        {!d.shown ? (
          <Answer
            key={task.id + ":" + d.turn}
            expected={turn.answer}
            kind="assemble"
            seed={task.id + ":" + d.turn}
            draft={d}
            onDraft={patch}
            onSubmit={(value) => answer(value)}
            onHelp={() => answer("", true)}
          />
        ) : (
          <div
            className={
              "automatic-feedback " +
              (d.answers.result === "yes" ? "correct" : "review")
            }
            role="status"
          >
            <strong>
              {d.answers.result === "yes"
                ? "Ответ получился!"
                : "Посмотри на пример ответа"}
            </strong>
            <p className="answer-greek" lang="el">
              {turn.answer}
            </p>
            <Speak text={turn.answer} />
            <p>
              Здесь тренируем ответ по образцу. Свободный разговор может звучать
              иначе.
            </p>
            <button className="button button-primary" onClick={next}>
              Продолжить <ArrowRight size={17} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
