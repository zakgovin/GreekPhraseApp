import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Eye,
  HelpCircle,
  Pause,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { useApp } from "../state";
import { phrases, phraseById, skillLabels } from "../lib/content";
import {
  advanceLearning,
  newDraft,
  rateSession,
  revealAnswer,
} from "../lib/progress";
import {
  PhraseContext,
  Pill,
  Recorder,
  SourceButton,
  Speak,
} from "../components/common";

export function Study() {
  const { progress: p, update, navigate, study, source } = useApp(),
    s = p.session;
  if (!s)
    return (
      <div className="empty-state">
        <h1>Начнём с нескольких фраз</h1>
        <p>Приложение подготовит посильную очередь.</p>
        <button className="button button-primary" onClick={() => study()}>
          Подготовить занятие
        </button>
      </div>
    );
  if (s.completedAt || s.index >= s.items.length) {
    const reviews = p.reviews.filter((r) => r.id.startsWith(s.id + ":")),
      correct = reviews.filter((r) => r.rating > 1 && !r.assisted).length;
    return (
      <div className="session-summary">
        <div className="summary-icon">
          <CheckCheck size={42} />
        </div>
        <Pill>Маленький шаг сделан</Pill>
        <h1>
          {reviews.length ? "Отлично. Теперь — пауза." : "Всё в своём темпе."}
        </h1>
        <p>
          {reviews.length
            ? "Мы сохранили ваши ответы и назначили следующие повторения. Дайте фразам немного времени."
            : "Сейчас нет упражнений, готовых к повторению, или дневной лимит новых уже выполнен. Можно попрактиковаться в разговоре."}
        </p>
        {reviews.length > 0 && (
          <div className="summary-stats">
            <div>
              <strong>{reviews.length}</strong>
              <span>проверок</span>
            </div>
            <div>
              <strong>{correct}</strong>
              <span>без подсказок</span>
            </div>
            <div>
              <strong>{reviews.filter((r) => r.isNew).length}</strong>
              <span>новых фраз</span>
            </div>
          </div>
        )}
        <div className="summary-next">
          <Sparkles size={21} />
          <div>
            <strong>Теперь используйте фразы</strong>
            <p>Короткая беседа поможет перейти от карточек к общению.</p>
          </div>
        </div>
        <div className="dialog-actions">
          <button
            className="button button-primary"
            onClick={() => navigate("conversation")}
          >
            Попробовать разговор
            <ArrowRight size={18} />
          </button>
          {p.savedSession && !p.savedSession.completedAt ? (
            <button className="button button-outline" onClick={() => study()}>
              Вернуться к дневному плану
            </button>
          ) : (
            <button
              className="button button-outline"
              onClick={() => navigate("today")}
            >
              На сегодня всё
            </button>
          )}
        </div>
      </div>
    );
  }
  const item = s.items[s.index],
    card = phraseById[item.cardId],
    learn = item.phase === "learn";
  const draftKey = "study:" + s.id + ":" + s.index,
    draft = p.drafts[draftKey] ?? newDraft();
  const count = s.items.filter((i) => i.phase === "recall").length,
    current = s.items
      .slice(0, s.index)
      .filter((i) => i.phase === "recall").length;
  function text(value: string) {
    update((prev) => ({
      ...prev,
      drafts: {
        ...prev.drafts,
        [draftKey]: { ...(prev.drafts[draftKey] ?? newDraft()), text: value },
      },
    }));
  }
  function rate(grade: number) {
    const now = new Date();
    update((prev) => rateSession(prev, s!.id, s!.index, grade, now));
  }
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
            {skillLabels[item.skill]} · {learn ? "знакомство" : "припоминание"}
          </span>
          <button
            className="button button-quiet"
            onClick={() => navigate("today")}
          >
            <Pause size={16} />
            Пауза
          </button>
        </div>
      </div>
      <div className="study-progress">
        <div className="progress-track">
          <i style={{ width: (current / Math.max(1, count)) * 100 + "%" }} />
        </div>
        <span>
          {current} из {count} проверено
        </span>
      </div>
      <section className="study-card" key={s.id + ":" + s.index}>
        <div className="study-card-top">
          <Pill tone={learn ? "sand" : "green"}>
            {learn
              ? "Новая фраза"
              : item.isNew
                ? "Первая попытка"
                : "Повторение"}
          </Pill>
          <span>{card.topic}</span>
        </div>
        {learn ? (
          <>
            <p className="eyebrow study-instruction">
              ПРОЧИТАЙТЕ, ПОСЛУШАЙТЕ И ПОВТОРИТЕ
            </p>
            <h1 lang="el" className="greek-display">
              {card.el}
            </h1>
            <p className="translation">{card.ru}</p>
            <Speak text={card.el} />
            <PhraseContext phrase={card} />
            <div className="learning-note">
              <Sparkles size={18} />
              <span>
                Скоро попробуем вспомнить без образца. Знакомство не считается
                проверкой памяти.
              </span>
            </div>
            <button
              className="button button-primary button-large"
              onClick={() =>
                update((prev) => advanceLearning(prev, s.id, s.index))
              }
            >
              Понятно, продолжить
              <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow study-instruction">
              {item.skill === "understanding"
                ? "КАК ВЫ ПОНИМАЕТЕ ЭТУ ФРАЗУ?"
                : item.skill === "writing"
                  ? "НАПИШИТЕ ПО-ГРЕЧЕСКИ"
                  : "СКАЖИТЕ ПО-ГРЕЧЕСКИ СВОИМИ СЛОВАМИ"}
            </p>
            <h1
              className={
                item.skill === "understanding"
                  ? "greek-display"
                  : "recall-prompt"
              }
              lang={item.skill === "understanding" ? "el" : "ru"}
            >
              {item.skill === "understanding" ? card.el : card.ru}
            </h1>
            {item.skill === "understanding" && <Speak text={card.el} />}
            <PhraseContext phrase={card} />
            {!s.revealed ? (
              <>
                <p className="muted">
                  {item.skill === "understanding"
                    ? "Сначала сформулируйте смысл, затем откройте перевод."
                    : "Подойдёт и другой правильный вариант с тем же смыслом."}
                </p>
                {item.skill === "writing" ? (
                  <textarea
                    aria-label="Ваш письменный ответ"
                    lang="el"
                    rows={4}
                    value={draft.text}
                    onChange={(e) => text(e.target.value)}
                    placeholder="Напишите ответ на греческом…"
                  />
                ) : item.skill === "speaking" ? (
                  <Recorder recordingKey={draftKey} />
                ) : null}
                <div className="recall-actions">
                  <button
                    className="button button-primary"
                    disabled={item.skill === "writing" && !draft.text.trim()}
                    onClick={() => update((prev) => revealAnswer(prev))}
                  >
                    <Eye size={18} />
                    {item.skill === "understanding"
                      ? "Я ответил — показать перевод"
                      : "Я ответил — сравнить"}
                  </button>
                  <button
                    className="button button-quiet"
                    onClick={() => update((prev) => revealAnswer(prev, true))}
                  >
                    <HelpCircle size={17} />
                    Не помню, нужна помощь
                  </button>
                </div>
              </>
            ) : (
              <div className="answer-panel">
                <div>
                  <span className="eyebrow">ОБРАЗЕЦ ОТВЕТА</span>
                  <Speak text={card.el} compact />
                </div>
                <p lang="el" className="answer-greek">
                  {card.el}
                </p>
                <p>{card.ru}</p>
                {draft.text && (
                  <div className="your-answer">
                    <span>Ваш ответ</span>
                    <p lang="el">{draft.text}</p>
                  </div>
                )}
                <p className="microcopy">
                  {s.assisted
                    ? "Вы открыли подсказку. Сохраним это как попытку с помощью и повторим позже."
                    : "Сравните смысл. Другой правильный вариант тоже подходит."}
                </p>
                <div className="rating-label">Как удалось вспомнить?</div>
                <div className="rating-buttons">
                  {[
                    {
                      n: 1,
                      title: s.assisted ? "Повторим позже" : "Не вспомнил",
                      sub: "вернёмся к фразе",
                    },
                    { n: 2, title: "С трудом", sub: "сам, но с усилием" },
                    { n: 3, title: "Вспомнил", sub: "самостоятельно" },
                    { n: 4, title: "Легко", sub: "быстро и уверенно" },
                  ].map((g) => (
                    <button
                      key={g.n}
                      className={"rating rating-" + g.n}
                      disabled={s.assisted && g.n !== 1}
                      onClick={() => rate(g.n)}
                    >
                      <strong>{g.title}</strong>
                      <span>{g.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="study-card-footer">
          {(learn || s.revealed) && (
            <SourceButton ids={card.sources} onClick={source} />
          )}
          <span>
            Фраза {phrases.findIndex((c) => c.id === card.id) + 1} из 122
          </span>
        </div>
      </section>
      <p className="study-bottom">
        <Repeat2 size={15} />
        Спокойный темп и честная самооценка помогают подобрать нужный интервал.
      </p>
    </>
  );
}
