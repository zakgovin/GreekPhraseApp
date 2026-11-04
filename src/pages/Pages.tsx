import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Download,
  Headphones,
  Leaf,
  MessageCircle,
  Play,
  Repeat2,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "../state";
import {
  phrases,
  sources,
  kindLabels,
  skillLabels,
  normalize,
  family,
  type Skill,
  formatDate,
} from "../lib/content";
import {
  dailyCandidates,
  dayKey,
  dueItems,
  emptyProgress,
  exportProgress,
  getStats,
  parseProgress,
  type Progress,
} from "../lib/progress";
import { clearRecordings } from "../lib/media";
import { isAndroid, native } from "../lib/platform";
import { conversations } from "../data/curriculum";
import {
  Empty,
  Modal,
  PhraseContext,
  Pill,
  SectionTitle,
  SmallArrow,
  SourceButton,
  Speak,
} from "../components/common";

export function Today() {
  const { progress: p, study, navigate, about } = useApp(),
    stats = getStats(p),
    due = dueItems(p),
    candidates = dailyCandidates(p);
  const active = Boolean(
    (p.session && !p.session.completedAt) ||
    (p.savedSession && !p.savedSession.completedAt),
  );
  const availableNew = Math.min(
    candidates.remaining,
    new Set(candidates.newCards.map((card) => family(card.id))).size,
  );
  const finished = availableNew === 0 && !due.length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return { date: d, key: dayKey(d) };
  });
  const worked = new Set([
    ...p.reviews.map((r) => dayKey(r.at)),
    ...p.practice.map((r) => dayKey(r.at)),
  ]);
  const next =
    conversations.find((c) => !p.practice.some((a) => a.taskId === c.id)) ??
    conversations[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">МАЛЕНЬКИЕ ШАГИ, БОЛЬШАЯ ЦЕЛЬ</p>
          <h1>
            Γεια σου, Захар<span className="heading-dot">.</span>
          </h1>
          <p>Немного греческого — и ещё на шаг ближе к A2.</p>
        </div>
        <Pill tone="outline">
          <span className="status-dot" /> Ваш персональный курс
        </Pill>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">ВАШЕ ЗАНЯТИЕ НА СЕГОДНЯ</span>
          <h2>
            {finished
              ? "Хорошая работа.\nДайте знаниям время."
              : active
                ? "Продолжим\nс того же места."
                : "Греческий, который\nостаётся с вами."}
          </h2>
          <p>
            {finished
              ? "Сегодняшние новые фразы уже пройдены. Можно немного поговорить или вернуться к повторениям позже."
              : due.length
                ? due.length +
                  " упражнений готовы к повторению. Начнём с них, а затем перейдём к новому."
                : "Учитесь говорить о своей жизни: сначала вспомните сами, затем сравните с образцом."}
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary button-large"
              onClick={() => study()}
            >
              <Play size={18} fill="currentColor" />
              {active
                ? "Продолжить занятие"
                : finished
                  ? "Проверить повторы"
                  : "Начать занятие"}
              <ArrowRight size={18} />
            </button>
            <button className="hero-help" onClick={about}>
              Как это работает?
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <Clock3 size={15} />
              {p.settings.minutes} минут
            </span>
            <span>
              <Sparkles size={15} />
              {availableNew} новых фраз сегодня
            </span>
            <span>
              <CheckCheck size={16} />В вашем темпе
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
            <span className="stat-label">На повторение</span>
            <strong>
              {due.length}
              <small> упражнений</small>
            </strong>
          </div>
          <span className="stat-detail">в нужный момент</span>
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
          <span className="stat-detail">ваша личная база</span>
        </div>
        <div className="stat-tile">
          <span className="stat-icon lavender">
            <TrendingUp size={21} />
          </span>
          <div>
            <span className="stat-label">Сегодня вспомнили</span>
            <strong>
              {stats.correctToday}
              <small> самостоятельно</small>
            </strong>
          </div>
          <span className="stat-detail">
            {stats.today
              ? "из " + stats.today + " попыток"
              : "всё начинается с первой фразы"}
          </span>
        </div>
      </div>
      <div className="dashboard-grid">
        <section>
          <SectionTitle
            eyebrow="ОТ ФРАЗЫ К РАЗГОВОРУ"
            title="Попробуйте сказать сами"
          >
            <SmallArrow onClick={() => navigate("conversation")}>
              Все темы
            </SmallArrow>
          </SectionTitle>
          <button
            className="conversation-feature"
            onClick={() => {
              sessionStorage.setItem("frasi.openConversation", next.id);
              navigate("conversation");
            }}
          >
            <div className="feature-illustration">
              <MessageCircle size={47} strokeWidth={1.3} />
              <span className="mini-bubble">Γεια σου!</span>
            </div>
            <div className="feature-copy">
              <Pill tone="white">Личная беседа</Pill>
              <h3>{next.title}</h3>
              <p>{next.subtitle}</p>
              <span>
                {next.turns.length} вопроса · образец после вашей попытки
              </span>
            </div>
            <ArrowUpRight size={24} />
          </button>
          <div className="method-strip">
            <span className="small-circle">
              <Check size={17} />
            </span>
            <div>
              <strong>Вспомнить. Повторить. Применить.</strong>
              <p>Каждая попытка помогает сделать греческий своим.</p>
            </div>
            <button
              className="icon-button"
              onClick={about}
              aria-label="О методике"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
        <section className="week-panel">
          <SectionTitle eyebrow="ВАША ПРАКТИКА" title="Понемногу каждый день" />
          <div className="week-days">
            {days.map(({ date, key }, i) => (
              <div
                className={"week-day " + (i === 6 ? "current" : "")}
                key={key}
              >
                <span>
                  {date
                    .toLocaleDateString("ru-RU", { weekday: "short" })
                    .slice(0, 2)}
                </span>
                <div>
                  {worked.has(key) ? <Check size={17} /> : date.getDate()}
                </div>
              </div>
            ))}
          </div>
          <p className="week-caption">
            {stats.streak
              ? "Практика " +
                stats.streak +
                " дн. подряд. Продолжайте в удобном темпе."
              : "Первое занятие появится здесь. Можно начать с нескольких минут."}
          </p>
          <div className="daily-phrase">
            <div>
              <span className="eyebrow">ФРАЗА ИЗ ВАШЕЙ ЖИЗНИ</span>
              <Speak text="Μου αρέσει το φθινόπωρο στην Κύπρο." compact />
            </div>
            <p lang="el">Μου αρέσει το φθινόπωρο στην Κύπρο.</p>
            <span>Мне нравится осень на Кипре.</span>
          </div>
        </section>
      </div>
      <div className="bottom-note">
        <ShieldCheck size={16} />
        <span>
          {isAndroid
            ? "Ваш прогресс сохраняется на устройстве."
            : "Ваш прогресс сохраняется в этом браузере."}
        </span>
        <button className="text-link" onClick={() => navigate("settings")}>
          Сделать резервную копию <ArrowRight size={14} />
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
            <h3>Как потренируемся?</h3>
            <p className="muted">
              Навыки сохраняются отдельно. Выберите, что хотите проверить.
            </p>
            <div className="skill-options">
              {(Object.entries(skillLabels) as [Skill, string][]).map(
                ([skill, label]) => (
                  <button
                    className="button button-outline"
                    key={skill}
                    onClick={() => {
                      setSelected(null);
                      study(card.id, skill);
                    }}
                  >
                    {label}
                    <ArrowRight size={16} />
                  </button>
                ),
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ProgressPage() {
  const { progress: p, navigate } = useApp(),
    stats = getStats(p);
  const delayed = stats.delayedCount
    ? Math.round((stats.delayedCorrect / stats.delayedCount) * 100)
    : null;
  const next = Object.entries(p.memory)
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .slice(0, 5);
  const history = [
    ...p.reviews.map((r) => ({
      id: r.id,
      at: r.at,
      title: phrases.find((c) => c.id === r.cardId)?.ru ?? "",
      label: skillLabels[r.skill],
      correct: r.rating > 1 && !r.assisted,
      assisted: r.assisted,
    })),
    ...p.practice.map((r) => ({
      id: r.id,
      at: r.at,
      title:
        conversations.find((c) => c.id === r.taskId)?.title ??
        "Экзаменационная практика",
      label: skillLabels[r.skill],
      correct: r.correct === r.total && !r.assisted,
      assisted: r.assisted,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 15);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">РЕЗУЛЬТАТЫ ВАШИХ УСИЛИЙ</p>
          <h1>
            Как идёт обучение<span className="heading-dot">.</span>
          </h1>
          <p>
            Самостоятельные ответы важнее количества просмотренных карточек.
          </p>
        </div>
      </div>
      <div className="progress-overview">
        <div className="big-stat">
          <span>Фраз в работе</span>
          <strong>
            {stats.introduced}
            <small>/{phrases.length}</small>
          </strong>
          <div className="progress-track">
            <i
              style={{ width: (stats.introduced / phrases.length) * 100 + "%" }}
            />
          </div>
          <p>Хотя бы одна проверка памяти</p>
        </div>
        <div className="big-stat">
          <span>Отложенное припоминание</span>
          <strong>{delayed === null ? "—" : delayed + "%"}</strong>
          <p>
            {delayed === null
              ? "Появится после проверок с паузой не менее суток."
              : stats.delayedCorrect +
                " из " +
                stats.delayedCount +
                " ответов после паузы не менее суток."}
          </p>
        </div>
        <div className="big-stat">
          <span>Практических заданий</span>
          <strong>{stats.practice}</strong>
          <p>Беседы, письма, картинки и аудирование</p>
        </div>
      </div>
      <SectionTitle title="У каждого навыка свой путь" />
      <div className="skill-stats">
        {(["understanding", "speaking", "writing"] as Skill[]).map((s) => {
          const reviews = p.reviews.filter((r) => r.skill === s),
            practices = p.practice.filter((r) => r.skill === s);
          return (
            <article key={s}>
              <span
                className={
                  "stat-icon " +
                  (s === "speaking"
                    ? "peach"
                    : s === "writing"
                      ? "lavender"
                      : "mint")
                }
              >
                {s === "speaking" ? (
                  <MessageCircle size={22} />
                ) : s === "writing" ? (
                  <BookOpen size={22} />
                ) : (
                  <Headphones size={22} />
                )}
              </span>
              <h3>{skillLabels[s]}</h3>
              <strong>
                {reviews.length}
                <small> проверок фраз</small>
              </strong>
              <p>{practices.length} практических заданий</p>
              <span className="microcopy">
                {s === "understanding"
                  ? "Чтение карточек и аудиозадания учитываются как разные действия."
                  : "Оценки этого навыка не переносятся на другие."}
              </span>
            </article>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section>
          <SectionTitle title="История занятий" />
          {history.length ? (
            <div className="history-list">
              {history.map((r) => (
                <article key={r.id}>
                  <span
                    className={
                      "history-mark " + (r.correct ? "successful" : "")
                    }
                  >
                    {r.correct ? <Check size={17} /> : <Repeat2 size={17} />}
                  </span>
                  <div>
                    <strong>{r.title}</strong>
                    <span>
                      {r.label} ·{" "}
                      {formatDate(r.at, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Pill
                    tone={r.assisted ? "sand" : r.correct ? "green" : "outline"}
                  >
                    {r.assisted
                      ? "С помощью"
                      : r.correct
                        ? "Самостоятельно"
                        : "Повторим"}
                  </Pill>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="История начинается с вас"
              text="После первого занятия здесь появятся ваши попытки и результаты."
            >
              <button
                className="button button-primary"
                onClick={() => navigate("today")}
              >
                К первому занятию
                <ArrowRight size={17} />
              </button>
            </Empty>
          )}
        </section>
        <section className="panel">
          <SectionTitle title="Ближайшие повторы" />
          {next.length ? (
            next.map(([key, m]) => {
              const [id, skill] = key.split(":");
              return (
                <div className="next-review" key={key}>
                  <strong>{phrases.find((c) => c.id === id)?.ru}</strong>
                  <span>
                    {skillLabels[skill as Skill]} ·{" "}
                    {formatDate(m.dueAt, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="muted">
              Расписание появится после первых ответов. Приложение само подберёт
              момент повторения.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export function SettingsPage() {
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
            Ваш темп<span className="heading-dot">.</span>
          </h1>
          <p>
            План можно менять. Регулярность начинается с посильной нагрузки.
          </p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="panel settings-panel">
          <SectionTitle title="Ежедневное занятие" />
          <label className="setting-row">
            <div>
              <strong>Продолжительность</strong>
              <p>
                Ориентир для размера занятия, без спешки и жёсткого таймера.
              </p>
            </div>
            <select
              aria-label="Продолжительность занятия"
              value={p.settings.minutes}
              onChange={(e) =>
                update((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    minutes: Number(e.target.value),
                  },
                }))
              }
            >
              {[5, 10, 15, 20, 30, 45].map((n) => (
                <option key={n} value={n}>
                  {n} минут
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <div>
              <strong>Новых фраз в день</strong>
              <p>При большой очереди сначала будут назначенные повторы.</p>
            </div>
            <select
              aria-label="Новых фраз в день"
              value={p.settings.dailyNew}
              onChange={(e) =>
                update((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    dailyNew: Number(e.target.value),
                  },
                }))
              }
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
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
              ? "Записи голоса хранятся в приложении и не входят в JSON-копию. Удаление приложения удалит его данные."
              : "Записи голоса хранятся отдельно в браузере и не входят в JSON-копию."}
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
