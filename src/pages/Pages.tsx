import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Download,
  Leaf,
  MessageCircle,
  Play,
  Repeat2,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "../state";
import {
  phrases,
  sources,
  kindLabels,
  normalize,
  formatDate,
} from "../lib/content";
import {
  adaptivePlan,
  dayKey,
  emptyProgress,
  exportProgress,
  getStats,
  parseProgress,
  type Progress,
} from "../lib/progress";
import { clearRecordings } from "../lib/media";
import { isAndroid, native } from "../lib/platform";
import { useSpeechAnswer } from "../components/Answer";
import { speechInput } from "../lib/speech-input";
import {
  Empty,
  Modal,
  PhraseContext,
  Pill,
  SectionTitle,
  SourceButton,
  Speak,
} from "../components/common";

export function Today() {
  const { progress: p, study, navigate } = useApp();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(new Date());
    };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const plan = adaptivePlan(p, now),
    stats = getStats(p, now);
  const active = Boolean(
    (p.session && !p.session.completedAt) ||
    (p.savedSession && !p.savedSession.completedAt),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ГРЕЧЕСКИЙ ДЛЯ ТВОЕЙ ЖИЗНИ</p>
          <h1>
            Γεια σου, Захар<span className="heading-dot">.</span>
          </h1>
          <p>Небольшое занятие. Понятный следующий шаг.</p>
        </div>
        <Pill tone="outline">Личный курс · A2</Pill>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">ТВОЁ СЛЕДУЮЩЕЕ ЗАНЯТИЕ</span>
          <h2>
            {active
              ? "Продолжим\nс того же места."
              : "Чуть увереннее\nс каждой фразой."}
          </h2>
          <p>
            {active
              ? "Ответы и место в занятии сохранены. Можно продолжить, когда удобно."
              : plan.reason}
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary button-large"
              onClick={() => study()}
            >
              <Play size={18} fill="currentColor" />
              {active ? "Продолжить занятие" : "Начать занятие"}
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <Clock3 size={15} />
              Около {plan.minutes} минут
            </span>
            <span>
              <Sparkles size={15} />
              Темп подбирается по ответам
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-arch">
            <div />
            <div />
            <div />
            <span>φ</span>
          </div>
          <div className="art-sprig">
            <Leaf size={66} strokeWidth={1} />
          </div>
          <div className="art-word">
            σιγά σιγά<span>шаг за шагом</span>
          </div>
          <div className="art-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
      <div className="stats-row">
        <div className="stat-tile">
          <span className="stat-icon mint">
            <Repeat2 size={21} />
          </span>
          <div>
            <span className="stat-label">Пора повторить</span>
            <strong>
              {plan.dueTotal}
              <small> фраз</small>
            </strong>
          </div>
          <span className="stat-detail">подберём в занятие</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon peach">
            <BookOpen size={21} />
          </span>
          <div>
            <span className="stat-label">Фразы в работе</span>
            <strong>
              {stats.introduced}
              <small> / {phrases.length}</small>
            </strong>
          </div>
          <span className="stat-detail">твой личный курс</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon lavender">
            <CheckCheck size={21} />
          </span>
          <div>
            <span className="stat-label">Попыток сегодня</span>
            <strong>{stats.today}</strong>
          </div>
          <span className="stat-detail">каждая помогает учиться</span>
        </div>
      </div>
      <section className="practice-shortcuts">
        <SectionTitle title="Хочется другой практики?" />
        <div>
          <button
            className="conversation-feature"
            onClick={() => navigate("conversation")}
          >
            <MessageCircle size={30} />
            <span>
              <strong>Потренировать беседу</strong>
              <small>Вопросы о тебе и жизненные ситуации</small>
            </span>
            <ArrowRight size={19} />
          </button>
          <button
            className="conversation-feature"
            onClick={() => navigate("exam")}
          >
            <BookOpen size={30} />
            <span>
              <strong>Подготовиться к экзамену</strong>
              <small>Аудио, картинки и письмо</small>
            </span>
            <ArrowRight size={19} />
          </button>
        </div>
      </section>
      <div className="bottom-note">
        <ShieldCheck size={16} />
        <span>
          Прогресс сохраняется {isAndroid ? "на устройстве" : "в этом браузере"}
          .
        </span>
        <button className="text-link" onClick={() => navigate("settings")}>
          Резервная копия <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

export function Library() {
  const { progress: p, study, source } = useApp(),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [year, setYear] = useState("all"),
    [topic, setTopic] = useState("all"),
    [selected, setSelected] = useState<string | null>(null);
  const matches = phrases.filter(
    (c) =>
      (kind === "all" || c.kind === kind) &&
      (topic === "all" || c.topic === topic) &&
      (year === "all" ||
        c.sources.some((id) => String(sources[id]?.year) === year)) &&
      normalize(c.el + " " + c.ru + " " + c.topic).includes(normalize(query)),
  );
  const card = selected ? phrases.find((c) => c.id === selected) : undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАШИ СЛОВА ДЛЯ ЖИЗНИ</p>
          <h1>
            Все фразы<span className="heading-dot">.</span>
          </h1>
          <p>122 законченные фразы. В каждой — смысл, контекст и источник.</p>
        </div>
        <Pill tone="outline">45 фраз о вас</Pill>
      </div>
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={20} />
          <input
            aria-label="Поиск фраз"
            placeholder="Найти по-русски или по-гречески…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
            >
              <X size={17} />
            </button>
          )}
        </label>
        <div className="filters">
          <label>
            <span>Тип фразы</span>
            <select
              aria-label="Тип фразы"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="all">Все типы</option>
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Тема</span>
            <select
              aria-label="Тема"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="all">Все темы</option>
              {[...new Set(phrases.map((c) => c.topic))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Материалы</span>
            <select
              aria-label="Год экзамена"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="all">Все годы</option>
              {[2015, 2016, 2017, 2018].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="results-line">
        <span>
          Найдено: <strong>{matches.length}</strong>
        </span>
        <span>Нажмите на фразу, чтобы потренироваться</span>
      </div>
      {!matches.length ? (
        <Empty
          title="Такой фразы пока нет"
          text="Попробуйте другое слово или сбросьте фильтры."
        >
          <button
            className="button button-outline"
            onClick={() => {
              setQuery("");
              setKind("all");
              setTopic("all");
              setYear("all");
            }}
          >
            Сбросить фильтры
          </button>
        </Empty>
      ) : (
        <div className="phrase-grid">
          {matches.map((c) => {
            const introduced = Object.keys(p.memory).some((k) =>
              k.startsWith(c.id + ":"),
            );
            return (
              <button
                className="phrase-tile"
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                <div>
                  <Pill
                    tone={
                      c.kind === "personal"
                        ? "green"
                        : c.kind === "recognition"
                          ? "blue"
                          : "sand"
                    }
                  >
                    {kindLabels[c.kind]}
                  </Pill>
                  <span
                    className={
                      "phrase-state " + (introduced ? "is-started" : "")
                    }
                  >
                    {introduced ? "В работе" : "Новая"}
                  </span>
                </div>
                <h3 lang="el">{c.el}</h3>
                <p>{c.ru}</p>
                <footer>
                  <span>{c.topic}</span>
                  <ArrowUpRight size={17} />
                </footer>
              </button>
            );
          })}
        </div>
      )}
      {card && (
        <Modal title={card.topic} onClose={() => setSelected(null)}>
          <Pill>{kindLabels[card.kind]}</Pill>
          <p lang="el" className="greek-display">
            {card.el}
          </p>
          <p className="translation">{card.ru}</p>
          <Speak text={card.el} />
          <PhraseContext phrase={card} />
          <SourceButton ids={card.sources} onClick={source} />
          <div className="modal-section">
            <button
              className="button button-primary"
              onClick={() => {
                setSelected(null);
                study(card.id);
              }}
            >
              Потренировать фразу <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ProgressPage() {
  const { progress: p, navigate } = useApp(),
    stats = getStats(p);
  const next = Object.entries(p.memory)
    .filter(([key]) => key.endsWith(":phrase"))
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .slice(0, 5);
  const history = [...p.reviews]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 20);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ТВОЙ ГРЕЧЕСКИЙ РАСТЁТ</p>
          <h1>
            Как идёт обучение<span className="heading-dot">.</span>
          </h1>
          <p>Здесь сохранены реальные попытки и следующие повторения.</p>
        </div>
      </div>
      <div className="progress-overview">
        <div className="big-stat">
          <span>Фраз в работе</span>
          <strong>
            {stats.introduced}
            <small> / 122</small>
          </strong>
          <p>В курсе есть и новые, и знакомые фразы.</p>
        </div>
        <div className="big-stat">
          <span>Дней с практикой подряд</span>
          <strong>{stats.streak}</strong>
          <p>Пропуск не обнуляет изученное.</p>
        </div>
        <div className="big-stat">
          <span>Практических заданий</span>
          <strong>{stats.practice}</strong>
          <p>Беседы, письмо, картинки и аудио.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <section>
          <SectionTitle title="Последние попытки" />
          {history.length ? (
            <div className="history-list">
              {history.map((review) => (
                <article key={review.id}>
                  <span
                    className={
                      "history-mark " +
                      (review.rating > 1 && !review.assisted
                        ? "successful"
                        : "")
                    }
                  >
                    <Check size={17} />
                  </span>
                  <div>
                    <strong>
                      {phrases.find((card) => card.id === review.cardId)?.ru}
                    </strong>
                    <span>
                      {formatDate(review.at, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Pill tone={review.rating > 1 ? "green" : "sand"}>
                    {!review.method
                      ? "Ранняя самооценка"
                      : review.rating === 1 || review.assisted
                        ? "Вернёмся к фразе"
                        : review.evidence === "guided"
                          ? "С опорой на слова"
                          : "Без подсказки"}
                  </Pill>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="История начинается с первого занятия"
              text="Ответы появятся здесь после короткого задания."
            >
              <button
                className="button button-primary"
                onClick={() => navigate("today")}
              >
                Начать учиться <ArrowRight size={17} />
              </button>
            </Empty>
          )}
        </section>
        <section className="panel">
          <SectionTitle title="Следующие повторения" />
          {next.length ? (
            next.map(([key, memory]) => (
              <div className="next-review" key={key}>
                <strong>
                  {phrases.find((card) => card.id === key.split(":")[0])?.ru}
                </strong>
                <span>
                  {formatDate(memory.dueAt, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              Расписание появится после первых заданий. Вручную управлять им не
              нужно.
            </p>
          )}
          <p className="microcopy">
            Успех со словами-подсказками отличается от самостоятельного ответа и
            не означает готовность к экзамену.
          </p>
        </section>
      </div>
    </>
  );
}

export function SettingsPage() {
  const voice = useSpeechAnswer();
  const { progress: p, update, notify, about } = useApp(),
    fileRef = useRef<HTMLInputElement>(null),
    [incoming, setIncoming] = useState<Progress | null>(null),
    [reset, setReset] = useState(false);
  async function download() {
    if (isAndroid) {
      try {
        const result = await native.exportJson({
          filename: "frasi-progress-" + dayKey(new Date()) + ".json",
          content: exportProgress(p),
        });
        if (result.saved) notify("Резервная копия сохранена.");
      } catch {
        notify(
          "Не удалось сохранить файл. Ваш прогресс остаётся в приложении.",
        );
      }
      return;
    }
    const url = URL.createObjectURL(
      new Blob([exportProgress(p)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "frasi-progress-" + dayKey(new Date()) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importNative() {
    try {
      const result = await native.importJson();
      if (!result.cancelled && result.content)
        setIncoming(parseProgress(result.content));
    } catch {
      notify(
        "Этот файл не является корректной резервной копией. Ваш прогресс сохранён.",
      );
    }
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error();
      setIncoming(parseProgress(await file.text()));
    } catch {
      notify(
        "Этот файл не является корректной резервной копией. Ваш прогресс сохранён.",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">УЧИТЬСЯ ТАК, КАК УДОБНО ВАМ</p>
          <h1>
            Настройки<span className="heading-dot">.</span>
          </h1>
          <p>Озвучка и резервная копия. Темп занятий мы подберём сами.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="panel settings-panel">
          <SectionTitle title="Озвучка и голосовой ответ" />
          <div className="settings-info">
            <Leaf size={19} />
            <p>
              Число новых фраз и повторений подбирается автоматически по твоим
              ответам. Настраивать нагрузку не нужно.
            </p>
          </div>
          <label className="setting-row">
            <div>
              <strong>Скорость учебной озвучки</strong>
              <p>
                {isAndroid
                  ? "При наличии установленного греческого голоса Android."
                  : "При наличии греческого голоса в вашем браузере."}
              </p>
            </div>
            <select
              aria-label="Скорость озвучки"
              value={p.settings.speechRate}
              onChange={(e) =>
                update((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    speechRate: Number(e.target.value),
                  },
                }))
              }
            >
              <option value={0.65}>Медленнее</option>
              <option value={0.85}>Спокойно</option>
              <option value={1}>Обычная</option>
            </select>
          </label>
          <Speak
            text="Σιγά σιγά. Μαθαίνω ελληνικά."
            label="Проверить греческий голос"
          />
          <p className="voice-status">
            {voice.available
              ? "Голосовой ответ готов: греческие слова распознаются на устройстве."
              : voice.reason || "Проверяем доступность голосового ответа…"}
          </p>
          {isAndroid && (
            <button
              className="text-link"
              onClick={() => {
                void speechInput
                  .openSettings()
                  .catch(() =>
                    notify("Откройте настройки голосового ввода Android."),
                  );
              }}
            >
              Настройки голосового ввода Android
            </button>
          )}
          <div className="settings-info">
            <Leaf size={19} />
            <p>
              После пропуска знания не обнуляются. Продолжайте с того места, где
              остановились.
            </p>
          </div>
        </section>
        <section className="panel settings-panel">
          <SectionTitle title="Ваши данные" />
          <p className="muted">
            {isAndroid
              ? "Прогресс и черновики хранятся на устройстве. Сохраните копию перед удалением приложения или для переноса на другой телефон."
              : "Прогресс и черновики остаются в этом браузере. Сохраните копию, чтобы перенести их на другое устройство."}
          </p>
          <div className="backup-actions">
            <button className="button button-primary" onClick={download}>
              <Download size={17} />
              Экспортировать прогресс
            </button>
            <button
              className="button button-outline"
              onClick={() =>
                isAndroid ? void importNative() : fileRef.current?.click()
              }
            >
              <Upload size={17} />
              Восстановить из файла
            </button>
            <input
              type="file"
              accept=".json,application/json"
              ref={fileRef}
              className="sr-only"
              aria-label="Файл резервной копии"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </div>
          <p className="microcopy">
            {isAndroid
              ? "JSON-копия включает историю, настройки и черновики. Старые аудиозаписи из предыдущих версий в неё не входят."
              : "JSON-копия включает историю, настройки и черновики. Старые аудиозаписи из предыдущих версий в неё не входят."}
          </p>
          <hr />
          <button className="text-link" onClick={about}>
            <BookOpen size={17} />
            Как устроена методика
          </button>
          <div className="danger-zone">
            <strong>Начать с чистого листа</strong>
            <p>Удалить историю, черновики и записи голоса этого приложения.</p>
            <button
              className="button button-danger"
              onClick={() => setReset(true)}
            >
              Сбросить прогресс
            </button>
          </div>
        </section>
      </div>
      {incoming && (
        <Modal title="Восстановить прогресс?" onClose={() => setIncoming(null)}>
          <p>
            В резервной копии: {incoming.reviews.length} проверок фраз,{" "}
            {incoming.practice.length} практических заданий. Текущий прогресс
            будет заменён.
          </p>
          <p className="muted">
            Сначала можно экспортировать текущие данные, если хотите сохранить
            обе версии.
          </p>
          <div className="dialog-actions">
            <button className="button button-outline" onClick={download}>
              Сохранить текущий
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                const next = {
                  ...incoming,
                  session: incoming.session
                    ? { ...incoming.session, lastResumedAt: null }
                    : null,
                };
                update(next);
                setIncoming(null);
                notify("Прогресс восстановлен.");
              }}
            >
              Восстановить этот файл
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Удалить весь прогресс?" onClose={() => setReset(false)}>
          <p>
            Будут удалены результаты, текущая сессия, черновики и записи голоса.
            Набор фраз и материалы останутся.
          </p>
          <div className="dialog-actions">
            <button
              className="button button-outline"
              onClick={() => setReset(false)}
            >
              Оставить прогресс
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                void clearRecordings()
                  .then(() => {
                    update(emptyProgress());
                    setReset(false);
                    notify("Прогресс сброшен.");
                  })
                  .catch(() =>
                    notify(
                      "Не удалось очистить записи. Прогресс пока не изменён.",
                    ),
                  );
              }}
            >
              Удалить данные приложения
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
