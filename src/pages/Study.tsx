import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Pause,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { useApp } from "../state";
import { phraseById } from "../lib/content";
import {
  advanceLearning,
  continueLesson,
  helpLesson,
  newDraft,
  submitLessonAnswer,
  type Draft,
} from "../lib/progress";
import { PhraseContext, Pill, SourceButton, Speak } from "../components/common";
import { Answer } from "../components/Answer";

export function Study() {
  const { progress: p, update, navigate, study, source } = useApp();
  const s = p.session;
  if (!s)
    return (
      <div className="empty-state">
        <h1>Потренируем греческий?</h1>
        <button className="button button-primary" onClick={() => study()}>
          Начать занятие
        </button>
      </div>
    );
  if (s.completedAt || s.index >= s.items.length) {
    const reviews = p.reviews.filter((r) => r.id.startsWith(s.id + ":"));
    const first = reviews.filter((r) => !r.retry);
    const correct = first.filter((r) => r.rating > 1 && !r.assisted).length;
    return (
      <div className="session-summary">
        <div className="summary-icon">
          <CheckCheck size={42} />
        </div>
        <Pill>Занятие завершено</Pill>
        <h1>Ещё немного греческого с тобой.</h1>
        <p>
          {first.length
            ? "Ответы сохранены. Когда вернуться к фразам и сколько нового добавить, мы подберём сами."
            : "Сейчас можно немного повторить знакомые фразы или перейти к практике."}
        </p>
        {!!first.length && (
          <div className="summary-stats">
            <div>
              <strong>
                {correct} из {first.length}
              </strong>
              <span>заданий с первого раза</span>
            </div>
            <div>
              <strong>
                {
                  new Set(first.filter((r) => r.isNew).map((r) => r.cardId))
                    .size
                }
              </strong>
              <span>новых фраз</span>
            </div>
          </div>
        )}
        <div className="summary-next">
          <Sparkles size={21} />
          <div>
            <strong>
              {correct < first.length / 2
                ? "В следующем занятии будет больше закрепления"
                : "Следующее занятие подстроится под твои ответы"}
            </strong>
            <p>Можно продолжить небольшим блоком или отдохнуть.</p>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="button button-primary" onClick={() => study()}>
            Ещё немного <ArrowRight size={18} />
          </button>
          <button
            className="button button-outline"
            onClick={() => navigate("today")}
          >
            На сегодня достаточно
          </button>
        </div>
      </div>
    );
  }
  const item = s.items[s.index],
    card = phraseById[item.cardId],
    learn = item.phase === "learn";
  const draftKey = "study:" + s.id + ":" + s.index;
  const draft = p.drafts[draftKey] ?? newDraft();
  const feedback = s.feedback;
  function patch(next: Draft) {
    update((prev) => ({
      ...prev,
      drafts: { ...prev.drafts, [draftKey]: next },
    }));
  }
  const remaining = s.items
    .slice(s.index)
    .filter((entry) => entry.phase === "recall").length;
  const total = s.items.filter((entry) => entry.phase === "recall").length;
  return (
    <>
      <div className="study-top">
        <button
          className="back-link"
          data-native-back
          onClick={() => navigate("today")}
        >
          <ArrowLeft size={17} />
          На главную
        </button>
        <div>
          <span>
            {learn
              ? "Знакомимся с фразой"
              : item.retry
                ? "Закрепим ещё раз"
                : "Тренируем фразу"}
          </span>
          <button
            className="button button-quiet"
            onClick={() => navigate("today")}
          >
            <Pause size={16} />
            Перерыв
          </button>
        </div>
      </div>
      <div className="study-progress">
        <div className="progress-track">
          <i
            style={{
              width: ((total - remaining) / Math.max(1, total)) * 100 + "%",
            }}
          />
        </div>
        <span>Осталось {remaining}</span>
      </div>
      <section className="study-card" key={s.id + ":" + s.index}>
        <div className="study-card-top">
          <Pill tone={learn ? "sand" : "green"}>
            {learn
              ? "Новая фраза"
              : item.retry
                ? "Ещё одна попытка"
                : "Попробуй сам"}
          </Pill>
          <span>{card.topic}</span>
        </div>
        {learn ? (
          <>
            <p className="eyebrow study-instruction">ПОСЛУШАЙ И ПОВТОРИ</p>
            <h1 lang="el" className="greek-display">
              {card.el}
            </h1>
            <p className="translation">{card.ru}</p>
            <Speak text={card.el} />
            <PhraseContext phrase={card} />
            <div className="learning-note">
              <Sparkles size={18} />
              <span>Скоро потренируем эту фразу в коротком задании.</span>
            </div>
            <button
              className="button button-primary button-large"
              onClick={() =>
                update((prev) => advanceLearning(prev, s.id, s.index))
              }
            >
              Дальше <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <h1 className="recall-prompt">{card.ru}</h1>
            <PhraseContext phrase={card} />
            {!feedback ? (
              <Answer
                expected={card.el}
                kind={item.exercise ?? "assemble"}
                seed={s.id + ":" + s.index}
                draft={draft}
                onDraft={patch}
                onSubmit={(answer, method) =>
                  update((prev) => submitLessonAnswer(prev, answer, method))
                }
                onHelp={() => update((prev) => helpLesson(prev))}
                onRecognitionFailure={() =>
                  update((prev) =>
                    prev.session && !prev.session.feedback
                      ? {
                          ...prev,
                          session: {
                            ...prev.session,
                            stepStartedAt: new Date().toISOString(),
                            stepElapsedMs: 0,
                          },
                        }
                      : prev,
                  )
                }
              />
            ) : (
              <div
                className={
                  "automatic-feedback " +
                  (feedback.correct && !s.assisted ? "correct" : "review")
                }
                role="status"
              >
                <div className="feedback-title">
                  {feedback.correct && !s.assisted ? (
                    <Check size={21} />
                  ) : (
                    <Repeat2 size={21} />
                  )}
                  <strong>
                    {s.assisted
                      ? "Запомним эту фразу"
                      : feedback.correct
                        ? "Верно!"
                        : "Давай закрепим эту формулировку"}
                  </strong>
                </div>
                {feedback.answer && !feedback.correct && (
                  <p className="submitted-answer">
                    Твой ответ: <span lang="el">{feedback.answer}</span>
                  </p>
                )}
                <p className="answer-greek" lang="el">
                  {card.el}
                </p>
                <Speak text={card.el} />
                <p>
                  {s.assisted
                    ? "Посмотри на образец и повтори. Мы вернёмся к фразе позже."
                    : feedback.correct
                      ? item.exercise !== "recall"
                        ? "Фраза получилась. Позже попробуем вспомнить её с меньшей опорой."
                        : "Ответ совпадает с изученной фразой. Следующее повторение назначено автоматически."
                      : "В этом упражнении тренируем фразу из урока. Посмотри на порядок слов и повтори её."}
                </p>
                <button
                  className="button button-primary button-large"
                  onClick={() => update((prev) => continueLesson(prev))}
                >
                  Продолжить <ArrowRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
        <div className="study-card-footer">
          {(learn || feedback) && (
            <SourceButton ids={card.sources} onClick={source} />
          )}
          <span>Сохраняем твой прогресс</span>
        </div>
      </section>
    </>
  );
}
