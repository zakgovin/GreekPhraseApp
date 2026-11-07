import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Play,
  Repeat2,
} from "lucide-react";
import { useApp } from "../state";
import { Answer } from "../components/Answer";
import { Pill, SourceButton, Speak } from "../components/common";
import { normalize } from "../lib/content";
import { newDraft, type Draft } from "../lib/progress";
import {
  checkQuestionAnswer,
  examQuestionById,
  examQuestions,
  examQuestionSource,
  questionAnswer,
  questionBlock,
} from "../lib/exam-questions";

const blockKey = "exam-questions:block";
export function ExamQuestions() {
  const { progress: p, update, navigate, source } = useApp();
  const [query, setQuery] = useState(""),
    [topic, setTopic] = useState("all");
  const d = p.drafts[blockKey] ?? newDraft();
  const ids = (d.answers.ids ?? "")
    .split(",")
    .filter((id) => examQuestionById[id]?.cardIds.length);
  const ready = examQuestions.filter((question) => question.cardIds.length);
  const active = d.answers.active === "yes" && ids.length > 0;
  function patch(next: Draft) {
    update((prev) => ({
      ...prev,
      drafts: { ...prev.drafts, [blockKey]: next },
    }));
  }
  function start(nextIds: string[]) {
    if (nextIds.length)
      patch({
        ...newDraft(),
        answers: { ids: nextIds.join(","), active: "yes" },
      });
  }
  function list() {
    update((prev) => {
      const current = prev.drafts[blockKey] ?? newDraft();
      return {
        ...prev,
        drafts: {
          ...prev.drafts,
          [blockKey]: {
            ...current,
            answers: { ...current.answers, active: "no" },
          },
        },
      };
    });
  }
  function check(value: string, helped = false) {
    const question = examQuestionById[ids[d.turn]];
    update((prev) => {
      const current = prev.drafts[blockKey] ?? newDraft();
      if (
        current.turn !== d.turn ||
        current.shown ||
        current.answers.ids !== d.answers.ids
      )
        return prev;
      return {
        ...prev,
        drafts: {
          ...prev.drafts,
          [blockKey]: {
            ...current,
            text: value,
            shown: true,
            helped,
            answers: {
              ...current.answers,
              result:
                !helped && checkQuestionAnswer(question, value) ? "yes" : "no",
            },
          },
        },
      };
    });
  }
  function next() {
    update((prev) => {
      const current = prev.drafts[blockKey] ?? newDraft();
      if (
        current.turn !== d.turn ||
        !current.shown ||
        current.answers.ids !== d.answers.ids
      )
        return prev;
      const correct = current.answers.result === "yes";
      const draft = {
        ...newDraft(),
        turn: current.turn + 1,
        ratings: [...current.ratings, correct ? 3 : 1],
        answers: { ids: current.answers.ids, active: "yes" },
      };
      return {
        ...prev,
        drafts: { ...prev.drafts, [blockKey]: draft },
        practice: [
          ...prev.practice,
          {
            id: crypto.randomUUID(),
            taskId: ids[current.turn],
            skill: "phrase",
            at: new Date().toISOString(),
            assisted: true,
            checked: true,
            correct: correct ? 1 : 0,
            total: 1,
          },
        ],
      };
    });
  }
  if (active && d.turn >= ids.length)
    return (
      <div className="session-summary">
        <div className="summary-icon">
          <CheckCheck size={40} />
        </div>
        <Pill>Блок завершён</Pill>
        <h1>
          {ids.length === 1 ? "Ответ сохранён." : "Три вопроса — готово."}
        </h1>
        <p>
          Ты потренировал {d.ratings.filter((rating) => rating > 1).length} из{" "}
          {ids.length} ответов по образцу.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-primary"
            data-native-back
            onClick={list}
          >
            К списку вопросов
          </button>
          <button
            className="button button-outline"
            onClick={() => start(questionBlock(p))}
          >
            Ещё короткий блок <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  if (active) {
    const question = examQuestionById[ids[d.turn]],
      answer = questionAnswer(question);
    return (
      <>
        <button className="back-link" data-native-back onClick={list}>
          <ArrowLeft size={17} />
          Все вопросы
        </button>
        <div className="practice-heading">
          <div>
            <p className="eyebrow">ВОПРОСЫ ЭКЗАМЕНАТОРА</p>
            <h1>{question.topic}</h1>
          </div>
          <Pill tone="outline">
            Вопрос {d.turn + 1} из {ids.length}
          </Pill>
        </div>
        <div
          className="study-progress"
          role="progressbar"
          aria-label="Прогресс вопросов"
          aria-valuemin={0}
          aria-valuemax={ids.length}
          aria-valuenow={d.turn + (d.shown ? 1 : 0)}
        >
          <div className="progress-track">
            <i
              style={{
                width: ((d.turn + (d.shown ? 1 : 0)) / ids.length) * 100 + "%",
              }}
            />
          </div>
          <span>№ {question.number} из списка</span>
        </div>
        <section className="panel examiner-practice">
          <h2 lang="el" className="greek-display">
            {question.el}
          </h2>
          <Speak text={question.el} label="Послушать вопрос" />
          <p className="question-translation">{question.ru}</p>
          {!d.shown ? (
            <Answer
              key={ids.join(",") + ":" + d.turn}
              expected={answer}
              kind="assemble"
              instruction="Собери ответ из слов"
              seed={question.id}
              draft={d}
              onDraft={patch}
              onSubmit={(value) => check(value)}
              onHelp={() => check("", true)}
            />
          ) : (
            <div
              className={
                "automatic-feedback " +
                (d.answers.result === "yes" ? "correct" : "review")
              }
              role="status"
            >
              <div className="feedback-title">
                {d.answers.result === "yes" ? (
                  <Check size={21} />
                ) : (
                  <Repeat2 size={21} />
                )}
                <strong>
                  {d.answers.result === "yes"
                    ? "Ответ получился!"
                    : "Посмотри на пример ответа"}
                </strong>
              </div>
              {d.text && d.answers.result !== "yes" && (
                <p className="submitted-answer">
                  Твой ответ: <span lang="el">{d.text}</span>
                </p>
              )}
              <p className="answer-greek" lang="el">
                {answer}
              </p>
              <Speak text={answer} />
              <p>
                Здесь тренируем изученный ответ. На экзамене можно выразить ту
                же мысль другими словами.
              </p>
              <button
                className="button button-primary button-large"
                onClick={next}
              >
                {d.turn === ids.length - 1
                  ? "Завершить блок"
                  : "Следующий вопрос"}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
          <SourceButton ids={[examQuestionSource]} onClick={source} />
        </section>
      </>
    );
  }
  const visible = ready.filter(
    (question) =>
      (topic === "all" || question.topic === topic) &&
      normalize(
        question.el + " " + question.ru + " " + questionAnswer(question),
      ).includes(normalize(query)),
  );
  return (
    <>
      <button
        className="back-link"
        data-native-back
        onClick={() => navigate("conversation")}
      >
        <ArrowLeft size={17} />
        Разговор
      </button>
      <div className="page-heading question-page-heading">
        <div>
          <p className="eyebrow">ТВОЙ СПИСОК</p>
          <h1>Вопросы экзаменатора</h1>
          <p>Личные ответы о тебе. Начни с трёх вопросов или выбери свой.</p>
        </div>
        <Pill tone="outline">{ready.length} вопросов</Pill>
      </div>
      <section className="question-block-start">
        <button
          className="button button-primary button-large"
          onClick={() =>
            d.turn < ids.length
              ? patch({ ...d, answers: { ...d.answers, active: "yes" } })
              : start(questionBlock(p))
          }
        >
          <Play size={17} />
          {d.turn < ids.length ? "Продолжить блок" : "Потренировать 3 вопроса"}
          <ArrowRight size={17} />
        </button>
        <SourceButton ids={[examQuestionSource]} onClick={source} />
      </section>
      <div className="question-filters">
        <label>
          <span className="sr-only">Поиск вопросов</span>
          <input
            type="search"
            placeholder="Найти вопрос…"
            aria-label="Поиск вопросов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Тема вопросов"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          <option value="all">Все темы</option>
          {[...new Set(ready.map((question) => question.topic))].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </div>
      <div className="exam-question-list">
        {visible.map((question) => (
          <details className="exam-question" key={question.id}>
            <summary>
              <span className="question-number">{question.number}</span>
              <span>
                <strong lang="el">{question.el}</strong>
                <span>{question.ru}</span>
              </span>
              <ChevronDown size={18} />
            </summary>
            <div className="exam-question-answer">
              <Pill tone="sand">{question.topic}</Pill>
              <p lang="el">{questionAnswer(question)}</p>
              <Speak text={questionAnswer(question)} />
              <button
                className="button button-outline"
                onClick={() => start([question.id])}
              >
                Потренировать ответ
                <ArrowRight size={17} />
              </button>
            </div>
          </details>
        ))}
      </div>
      {!visible.length && (
        <p className="empty-state">По этому запросу вопросов нет.</p>
      )}
    </>
  );
}
