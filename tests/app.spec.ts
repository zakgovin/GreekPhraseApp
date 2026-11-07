import { test, expect, type Page } from "@playwright/test";
async function assemble(page: Page) {
  const ids = await page
    .locator(".word-bank [data-word-id]:enabled")
    .evaluateAll((buttons) =>
      buttons
        .map((button) => Number(button.getAttribute("data-word-id")))
        .sort((a, b) => a - b),
    );
  for (const id of ids)
    await page.locator('.word-bank [data-word-id="' + id + '"]').click();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
}
async function startLesson(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: /^(Дальше|К упражнениям)$/ })
      .click();
}
test("guided lessons check answers, persist feedback and continue beyond three new phrases", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startLesson(page);
  await expect(page.locator('.word-bank [data-word-id="0"]')).toHaveText("με");
  await expect(page.locator('.word-bank [data-word-id="2"]')).toHaveText(
    "Ζαχάρ",
  );
  await expect(
    page.getByRole("heading", { name: "Меня зовут Захар.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Με λένε Ζαχάρ.", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", {
      name: /Записать|Вспомнил самостоятельно|Не вспомнил|С трудом|Легко/,
    }),
  ).toHaveCount(0);
  await page.locator('.word-bank [data-word-id="0"]').click();
  await page.reload();
  await expect(page.locator(".sentence-answer .selected")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("word-bank.png"),
    fullPage: true,
  });
  await assemble(page);
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("checked-answer.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  for (let i = 0; i < 4; i++) {
    await assemble(page);
    await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
      .click();
  }
  await expect(
    page.getByText("Занятие завершено", { exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(5);
  expect(
    data.reviews.every(
      (review: { method: string; evidence: string; rating: number }) =>
        review.method === "words" &&
        review.evidence === "guided" &&
        review.rating === 3,
    ),
  ).toBe(true);
  expect(Object.keys(data.memory).every((key) => key.endsWith(":phrase"))).toBe(
    true,
  );
  await page.getByRole("button", { name: "Ещё немного", exact: true }).click();
  await expect(page.getByText("Новая фраза", { exact: true })).toBeVisible();
  const continued = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(
    continued.session.items.some((item: { isNew: boolean }) => item.isNew),
  ).toBe(true);
  const fixedLength = continued.session.items.length;
  expect(fixedLength).toBeLessThanOrEqual(6);
  expect(continued.session.short).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("short-block.png"),
    fullPage: true,
  });
  for (let index = 0; index < fixedLength; index++) {
    const bar = page.getByRole("progressbar", { name: "Прогресс занятия" });
    await expect(bar).toHaveAttribute("aria-valuemax", String(fixedLength));
    await expect(bar).toHaveAttribute("aria-valuenow", String(index));
    await expect(
      page.getByText(`Шаг ${index + 1} из ${fixedLength}`, { exact: true }),
    ).toBeVisible();
    if (index === 1) {
      await page.reload();
      await expect(bar).toHaveAttribute("aria-valuenow", String(index));
    }
    if (
      await page
        .getByRole("button", { name: /^(Дальше|К упражнениям)$/ })
        .count()
    ) {
      await page
        .getByRole("button", { name: /^(Дальше|К упражнениям)$/ })
        .click();
    } else {
      await page.getByRole("button", { name: "Не помню", exact: true }).click();
      await expect(bar).toHaveAttribute("aria-valuenow", String(index + 1));
      await page
        .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
        .click();
    }
  }
  await expect(
    page.getByRole("heading", {
      name: "Готово. Можно отдохнуть.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".dialog-actions .button-primary")).toHaveText(
    "На сегодня достаточно",
  );
  await page.screenshot({
    path: testInfo.outputPath("finished-block.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("help schedules repetition without extending the current block", async ({
  page,
}) => {
  await startLesson(page);
  await page.getByRole("button", { name: "Не помню", exact: true }).click();
  await expect(
    page.getByText("Запомним эту фразу", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(1);
  expect(data.reviews[0].rating).toBe(1);
  expect(data.reviews[0].assisted).toBe(true);
  expect(data.session.items).toHaveLength(10);
  expect(
    data.session.items.some((item: { retry?: boolean }) => item.retry),
  ).toBe(false);
  expect(data.memory[data.reviews[0].cardId + ":phrase"]).toBeDefined();
  await page.goto("/#settings");
  await expect(
    page.getByLabel("Новых фраз в день", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Продолжительность занятия", { exact: true }),
  ).toHaveCount(0);
});
test("library search ignores Greek accents and shows source attribution", async ({
  page,
}) => {
  await page.goto("/#phrases");
  await expect(page.locator(".phrase-tile")).toHaveCount(157);
  await page.getByLabel("Поиск фраз", { exact: true }).fill("γειτονια");
  await expect(page.locator(".phrase-tile")).toHaveCount(1);
  await page.locator(".phrase-tile").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Мой район" })
      .getByText("Η γειτονιά μου είναι γενικά ήσυχη.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Источник/ }).click();
  const attribution = page.getByRole("dialog", { name: "Откуда это задание" });
  await expect(
    attribution.getByText("Κέντρο Ελληνικής Γλώσσας · ελληνομάθεια"),
  ).toBeVisible();
  await expect(attribution.getByRole("link")).toHaveCount(0);
  await expect(attribution.getByRole("button", { name: /PDF/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("conversation checks actual typed answers without self-grades", async ({
  page,
}) => {
  await page.goto("/#conversation");
  await page
    .locator(".conversation-tile")
    .filter({ hasText: "Давайте познакомимся" })
    .click();
  for (const answer of [
    "Με λένε Ζαχάρ και είμαι τριάντα επτά χρονών.",
    "Είμαι από το Μπλαγκοβέστσενσκ, στη Ρωσία.",
    "Μένω στη Λάρνακα, στην Κύπρο.",
  ]) {
    await page
      .getByRole("button", { name: "Написать самому", exact: true })
      .click();
    await page.getByLabel("Ответ по-гречески", { exact: true }).fill(answer);
    await page.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(
      page.getByText("Ответ получился!", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Разговор состоялся." }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice).toHaveLength(1);
  expect(data.practice[0]).toMatchObject({
    skill: "phrase",
    checked: true,
    correct: 3,
    total: 3,
  });
  expect(data.memory).toEqual({});
});
test("writing draft survives reload and saves a real self-assessed attempt", async ({
  page,
}) => {
  await page.goto("/#exam");
  await page
    .locator(".exercise-tile")
    .filter({ hasText: "Письмо о несчастном случае" })
    .click();
  const text = Array(85).fill("ελληνικά").join(" ");
  await page.getByLabel("Текст письма на греческом").fill(text);
  await expect(
    page.getByText("85 / 80–100 слов", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".exercise-tile")
    .filter({ hasText: "Письмо о несчастном случае" })
    .click();
  await expect(page.getByLabel("Текст письма на греческом")).toHaveValue(text);
  for (const checkbox of await page.locator(".checklist input").all())
    await checkbox.check();
  await page
    .getByRole("button", { name: "Сохранить попытку", exact: true })
    .click();
  await expect(
    page.getByText("Сохранено: 3 из 3 содержательных пунктов.", {
      exact: true,
    }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice[0].skill).toBe("writing");
});
test("exercise clips play with correct duration and transcript assistance stays explicit", async ({
  page,
  request,
}) => {
  for (const file of ["exam-registration-2017.mp3", "food-order-2018.mp3"]) {
    const response = await request.get("/audio/" + file, {
      headers: { Range: "bytes=0-1023" },
    });
    expect(response.status()).toBe(206);
    expect((await response.body()).length).toBe(1024);
  }
  await page.goto("/#exam");
  await page.getByRole("button", { name: "Аудирование", exact: true }).click();
  await page
    .locator(".audio-tile")
    .filter({ hasText: "Запись на экзамен" })
    .click();
  await expect(page.getByLabel("Аудиофрагмент экзамена 2017")).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть расшифровку", exact: true })
    .click();
  const original = page.getByLabel("Аудиофрагмент экзамена 2017");
  await original.evaluate((el: HTMLAudioElement) => el.play());
  await expect
    .poll(() => original.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await original.evaluate((el: HTMLAudioElement) => el.pause());
  const duration = await original.evaluate(
    (el: HTMLAudioElement) => el.duration,
  );
  expect(duration).toBeGreaterThan(87);
  expect(duration).toBeLessThan(88);
  const values = [
    "06/12",
    "Αθήνα",
    "Μακεδονίας 18",
    "ηλεκτρονικά",
    "Δευτέρα",
    "70 ευρώ",
    "ταυτότητα",
  ];
  const inputs = page.locator(".answer-field input");
  for (let i = 0; i < values.length; i++) await inputs.nth(i).fill(values[i]);
  await page
    .getByRole("button", { name: "Проверить ответы", exact: true })
    .click();
  await expect(
    page.getByText("7 из 7 ответов совпали с ключом.", { exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice[0].assisted).toBe(true);
  await page
    .getByRole("button", { name: "Все экзаменационные задания", exact: true })
    .click();
  await page
    .locator(".audio-tile")
    .filter({ hasText: "Заказ еды по телефону" })
    .click();
  const food = page.getByLabel("Аудиофрагмент экзамена 2018");
  await food.evaluate((el: HTMLAudioElement) => el.play());
  await expect
    .poll(() => food.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  const foodDuration = await food.evaluate((el: HTMLAudioElement) => {
    el.pause();
    return el.duration;
  });
  expect(foodDuration).toBeGreaterThan(103);
  expect(foodDuration).toBeLessThan(105);
});
test("unsupported voice has no passive recorder and wrong typed words are checked", async ({
  page,
}) => {
  await startLesson(page);
  await expect(
    page.getByRole("button", {
      name: /Записать|Ответить голосом|Остановить запись/,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Написать самому", exact: true })
    .click();
  await page
    .getByLabel("Ответ по-гречески", { exact: true })
    .fill("Δεν με λένε Ζαχάρ.");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(
    page.getByText("Давай закрепим эту формулировку", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews[0]).toMatchObject({ method: "text", rating: 1 });
});
test("all sections fit the viewport and dashboard is visually reviewable", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const section of [
    "today",
    "phrases",
    "conversation",
    "questions",
    "exam",
    "progress",
    "settings",
  ]) {
    await page.goto("/#" + section);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("dashboard-360.png"),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("picture practice processes the answer and saves one checked result", async ({
  page,
}) => {
  await page.goto("/#exam");
  await page.getByRole("button", { name: "Картинки", exact: true }).click();
  await page.locator(".image-tile").first().click();
  await expect(page.locator(".exam-photo img")).toBeVisible();
  await page
    .getByRole("button", { name: "Написать самому", exact: true })
    .click();
  await page
    .getByLabel("Ответ по-гречески", { exact: true })
    .fill(
      "Στην εικόνα βλέπω ηθοποιούς πάνω στη σκηνή. Μπροστά τους υπάρχουν θεατές.",
    );
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(
    page.getByText("Описание получилось!", { exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice).toHaveLength(1);
  expect(data.practice[0]).toMatchObject({
    checked: true,
    correct: 1,
    total: 1,
    skill: "phrase",
  });
  expect(data.memory).toEqual({});
});

test("backup export restores settings and invalid import leaves them intact", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page
    .getByLabel("Скорость озвучки", { exact: true })
    .selectOption("0.65");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Экспортировать прогресс", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const chunk of stream!) parts.push(Buffer.from(chunk));
  const backup = Buffer.concat(parts);
  expect(JSON.parse(backup.toString()).progress.settings.speechRate).toBe(0.65);
  await page.getByLabel("Скорость озвучки", { exact: true }).selectOption("1");
  await page.getByLabel("Файл резервной копии", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(
    page.getByText(
      "Этот файл не является корректной резервной копией. Ваш прогресс сохранён.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Скорость озвучки", { exact: true }),
  ).toHaveValue("1");
  await page.getByLabel("Файл резервной копии", { exact: true }).setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page
    .getByRole("button", { name: "Восстановить этот файл", exact: true })
    .click();
  await expect(
    page.getByLabel("Скорость озвучки", { exact: true }),
  ).toHaveValue("0.65");
  await page.reload();
  await expect(
    page.getByLabel("Скорость озвучки", { exact: true }),
  ).toHaveValue("0.65");
});

test("importing an old backup keeps all 157 phrases, current counts and personal answers", async ({
  page,
}, testInfo) => {
  await startLesson(page);
  await assemble(page);
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  const legacy = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("frasi.progress.v1")!);
    progress.session = null;
    progress.savedSession = null;
    return { app: "frasi", version: 1, recordingsIncluded: false, progress };
  });
  expect(legacy.progress.reviews).toHaveLength(1);
  expect(
    Object.keys(legacy.progress.memory).every(
      (key) => Number(key.slice(3).split(":")[0]) <= 122,
    ),
  ).toBe(true);
  await page.goto("/#settings");
  await expect(page.getByText("Φράση · версия 0.4.1")).toBeVisible();
  await page.getByLabel("Скорость озвучки", { exact: true }).selectOption("1");
  await page.getByLabel("Файл резервной копии", { exact: true }).setInputFiles({
    name: "frasi-progress-before-new-questions.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page
    .getByRole("button", { name: "Восстановить этот файл", exact: true })
    .click();
  await expect(
    page.getByLabel("Скорость озвучки", { exact: true }),
  ).toHaveValue("0.85");
  await page.goto("/#phrases");
  await expect(page.locator(".phrase-tile")).toHaveCount(157);
  await expect(page.getByText(/^Всего фраз: 157\./)).toBeVisible();
  await expect(page.getByText("Фраз о вас: 80", { exact: true })).toBeVisible();
  await expect(page.locator('.sidebar a[href="#phrases"] small')).toHaveText(
    "157",
  );
  await expect(
    page.locator(".phrase-tile h3").filter({
      hasText: "Χρησιμοποιώ τεχνητή νοημοσύνη.",
    }),
  ).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("correct-course-count.png"),
  });
  await page.getByLabel("Тип фразы", { exact: true }).selectOption("personal");
  await expect(page.locator(".phrase-tile")).toHaveCount(80);
  await page.goto("/#progress");
  await expect(page.locator(".big-stat").first().locator("small")).toHaveText(
    "/ 157",
  );
  await page.reload();
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(restored.reviews).toEqual(legacy.progress.reviews);
  expect(restored.memory).toEqual(legacy.progress.memory);
  await page.goto("/#phrases");
  await expect(page.locator(".phrase-tile")).toHaveCount(157);
  await page.goto("/#questions");
  await expect(page.locator(".exam-question")).toHaveCount(38);
});

test("ASR bridge errors do not grade the learner and recognized words are actually checked", async ({
  page,
}) => {
  // Contract test with a fake Android bridge; this is not a physical microphone test.
  await page.addInitScript(() => {
    let attempts = 0;
    const methods = (names: string[]) =>
      names.map((name) => ({
        name,
        rtype: name === "addListener" ? "callback" : "promise",
      }));
    Object.assign(window, {
      androidBridge: {},
      Capacitor: {
        PluginHeaders: [
          {
            name: "FrasiSpeech",
            methods: methods([
              "status",
              "listen",
              "stop",
              "cancel",
              "openSettings",
            ]),
          },
          {
            name: "FrasiNative",
            methods: methods([
              "readProgress",
              "saveProgress",
              "speechStatus",
              "addListener",
              "removeListener",
              "stopSpeech",
            ]),
          },
          {
            name: "App",
            methods: methods([
              "addListener",
              "removeListener",
              "exitApp",
              "minimizeApp",
            ]),
          },
        ],
        nativeCallback: () => "mock-listener",
        nativePromise: async (
          plugin: string,
          method: string,
          options?: { content?: string },
        ) => {
          if (plugin === "FrasiSpeech") {
            if (method === "status") return { available: true, reason: "" };
            if (method === "listen") {
              attempts++;
              if (attempts === 1)
                throw Object.assign(new Error("recognizer unavailable"), {
                  code: "RECOGNITION_ERROR",
                });
              return {
                text: "Με λένε Ζαχάρ.",
                alternatives: ["Με λένε Ζαχάρ."],
              };
            }
            return {};
          }
          if (method === "readProgress")
            return { content: localStorage.getItem("frasi.progress.v1") };
          if (method === "saveProgress")
            localStorage.setItem("frasi.progress.v1", options!.content!);
          if (method === "speechStatus")
            return {
              available: false,
              engineAvailable: false,
              reason: "Mock TTS",
            };
          return {};
        },
      },
    });
  });
  await startLesson(page);
  await page
    .getByRole("button", { name: "Ответить голосом", exact: true })
    .click();
  await expect(
    page.getByText(/Не удалось разобрать речь. Можно попробовать/),
  ).toBeVisible();
  let data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(0);
  expect(data.session.feedback).toBeNull();
  await page
    .getByRole("button", { name: "Ответить голосом", exact: true })
    .click();
  await expect(
    page.getByLabel("Ответ по-гречески", { exact: true }),
  ).toHaveValue("Με λένε Ζαχάρ.");
  await expect(page.getByText(/Точность акцента не оценивается/)).toBeVisible();
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(1);
  expect(data.reviews[0]).toMatchObject({
    method: "speech",
    evidence: "guided",
    rating: 3,
  });
});

test("upgrading old progress keeps history and due dates with automatic workload", async ({
  page,
}) => {
  await startLesson(page);
  await assemble(page);
  await page
    .getByRole("button", { name: /^(Продолжить|Завершить занятие)$/ })
    .click();
  const legacy = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("frasi.progress.v1")!);
    delete data.adaptiveVersion;
    data.memory["a2-001:speaking"] = { ...data.memory["a2-001:phrase"] };
    delete data.memory["a2-001:speaking"].origin;
    delete data.memory["a2-001:phrase"];
    for (const review of data.reviews) {
      review.skill = "speaking";
      for (const key of [
        "method",
        "evidence",
        "responseMs",
        "task",
        "scheduled",
        "retry",
      ])
        delete review[key];
    }
    data.settings = { dailyNew: 3, minutes: 15, speechRate: 0.85 };
    data.session = null;
    data.savedSession = null;
    return data;
  });
  const dueAt = legacy.memory["a2-001:speaking"].dueAt;
  // Install a 0.2.1 snapshot before the new application boots, as an update does.
  // Editing storage underneath a mounted lesson races its legitimate autosave.
  await page.addInitScript(
    (data) => localStorage.setItem("frasi.progress.v1", JSON.stringify(data)),
    legacy,
  );
  await page.goto("/#progress");
  await page.reload();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.adaptiveVersion).toBe(1);
  expect(data.reviews).toHaveLength(1);
  expect(data.memory["a2-001:phrase"].dueAt).toBe(dueAt);
  expect(data.memory["a2-001:speaking"].dueAt).toBe(dueAt);
  await expect(
    page.getByText("Ранняя самооценка", { exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  await expect(
    page.getByLabel("Новых фраз в день", { exact: true }),
  ).toHaveCount(0);
});

async function selectedWordIds(page: Page) {
  return page
    .locator(".sentence-answer [data-selected-word-id]")
    .evaluateAll((words) =>
      words.map((word) => Number(word.getAttribute("data-selected-word-id"))),
    );
}
async function moveWord(page: Page, from: number, to: number, touch: boolean) {
  const source = page.locator(`[data-selected-word-id="${from}"] .word-handle`);
  const target = page.locator(`[data-selected-word-id="${to}"] .word-handle`);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(),
    b = await target.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  const start = { x: a!.x + a!.width / 2, y: a!.y + a!.height / 2 };
  const end = { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
  if (touch) {
    const client = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => ({
      x,
      y,
      id: 1,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(start.x, start.y)],
    });
    // Touch dragging deliberately starts after a short hold so vertical scrolling still works.
    await expect(page.locator(".word-dragging")).toHaveCount(1);
    for (let step = 1; step <= 12; step++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          point(
            start.x + ((end.x - start.x) * step) / 12,
            start.y + ((end.y - start.y) * step) / 12,
          ),
        ],
      });
    await page.waitForTimeout(50); // Let the final collision/animation frame settle before dropping.
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 7, start.y);
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  }
  await expect(page.locator(".word-dragging")).toHaveCount(0);
}

test("long answers support moving words across lines and preserve duplicate words after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/#phrases");
  await page
    .getByLabel("Поиск фраз", { exact: true })
    .fill("чтобы общаться с людьми");
  await page.locator(".phrase-tile").click();
  await page
    .getByRole("button", { name: "Потренировать фразу", exact: true })
    .click();
  await page
    .getByRole("button", { name: "К упражнениям", exact: true })
    .click();
  const count = await page.locator(".word-bank [data-word-id]").count();
  expect(count).toBe(12);
  await expect(page.locator('.word-bank [data-word-id="0"]')).toHaveText(
    "μαθαίνω",
  );
  await expect(page.locator('.word-bank [data-word-id="11"]')).toHaveText(
    "Κύπρο",
  );
  const ids = Array.from({ length: count }, (_, i) => i);
  for (const id of [...ids.slice(1), 0])
    await page.locator(`.word-bank [data-word-id="${id}"]`).click();
  await page.locator('[data-selected-word-id="0"] .word-handle').click();
  await expect(page.locator(".sentence-answer .selected")).toHaveCount(count);
  await moveWord(page, 0, 1, testInfo.project.name === "mobile");
  await expect.poll(() => selectedWordIds(page)).toEqual(ids);
  await page.reload();
  await expect.poll(() => selectedWordIds(page)).toEqual(ids);
  await page.locator('[data-selected-word-id="5"] .word-remove').click();
  await expect(page.locator('[data-selected-word-id="3"]')).toHaveCount(1);
  await expect(page.locator('.word-bank [data-word-id="5"]')).toBeEnabled();
  await expect(page.locator('.word-bank [data-word-id="3"]')).toBeDisabled();
  await page.locator('.word-bank [data-word-id="5"]').click();
  await moveWord(page, 5, 6, testInfo.project.name === "mobile");
  await expect.poll(() => selectedWordIds(page)).toEqual(ids);
  await expect(
    page.getByRole("link", { name: "К содержимому", exact: true }),
  ).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("reordered-long-answer.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Завершить занятие", exact: true })
    .click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(1);
  expect(data.reviews[0]).toMatchObject({
    rating: 3,
    method: "words",
    evidence: "guided",
  });
});

test("word order is accessible from the keyboard and cancelling keeps the previous answer", async ({
  page,
}) => {
  await startLesson(page);
  for (const id of [1, 0, 2])
    await page.locator(`.word-bank [data-word-id="${id}"]`).click();
  const handle = page.locator('[data-selected-word-id="0"] .word-handle');
  await handle.focus();
  await handle.press("Space");
  await expect(page.locator(".word-dragging")).toHaveCount(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await handle.press("ArrowLeft");
  await handle.press("Escape");
  await expect(page.locator(".word-dragging")).toHaveCount(0);
  await expect.poll(() => selectedWordIds(page)).toEqual([1, 0, 2]);
  await handle.focus();
  await handle.press("Space");
  await expect(page.locator(".word-dragging")).toHaveCount(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await handle.press("ArrowLeft");
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(
    "место 1 из 3",
  );
  await handle.press("Space");
  await expect.poll(() => selectedWordIds(page)).toEqual([0, 1, 2]);
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
});

test("examiner list contains all 38 questions, factual personal answers and honest source attribution", async ({
  page,
}, testInfo) => {
  await page.goto("/#conversation");
  await page.getByRole("button", { name: /Вопросы экзаменатора/ }).click();
  await expect(
    page.getByRole("heading", { name: "Вопросы экзаменатора", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".exam-question")).toHaveCount(38);
  await expect(page.getByText("38 вопросов", { exact: true })).toBeVisible();
  await page.getByLabel("Поиск вопросов", { exact: true }).fill("новости");
  await expect(page.locator(".exam-question")).toHaveCount(1);
  await page.locator(".exam-question summary").click();
  await expect(page.locator(".exam-question-answer")).toContainText(
    "Μαθαίνω τα νέα από φίλους και γνωστούς.",
  );
  await page
    .getByRole("button", { name: "Источник · твой список", exact: true })
    .click();
  const attribution = page.getByRole("dialog", { name: "Откуда это задание" });
  await expect(
    attribution.getByText("Список вопросов от Захара", { exact: true }),
  ).toBeVisible();
  await expect(
    attribution.getByText("Κέντρο Ελληνικής Γλώσσας · ελληνομάθεια", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(attribution.getByRole("link")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("Поиск вопросов", { exact: true }).fill("");
  await page.getByLabel("Тема вопросов", { exact: true }).selectOption("Жильё");
  await expect(page.locator(".exam-question")).toHaveCount(2);
  await page.locator(".exam-question").last().locator("summary").click();
  await expect(
    page.locator(".exam-question").last().locator(".exam-question-answer"),
  ).toContainText("πρώτο όροφο, πάνω από το ισόγειο");
  await expect(
    page.locator(".exam-question").last().locator(".exam-question-answer"),
  ).toContainText("τρία δωμάτια");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("examiner-personal-answers.png"),
    fullPage: true,
  });
});

test("examiner practice is three questions, saves partial word order and resumes after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/#questions");
  await page
    .getByRole("button", { name: "Потренировать 3 вопроса", exact: true })
    .click();
  for (let i = 0; i < 3; i++) {
    const bar = page.getByRole("progressbar", {
      name: "Прогресс вопросов",
      exact: true,
    });
    await expect(bar).toHaveAttribute("aria-valuemax", "3");
    await expect(bar).toHaveAttribute("aria-valuenow", String(i));
    if (i === 1) {
      await page.locator('.word-bank [data-word-id="0"]').click();
      await page.reload();
      await expect(page.locator(".sentence-answer .selected")).toHaveCount(1);
      await expect(bar).toHaveAttribute("aria-valuenow", "1");
    }
    await assemble(page);
    await expect(
      page.getByText("Ответ получился!", { exact: true }),
    ).toBeVisible();
    if (i === 0) {
      await page.reload();
      await expect(
        page.getByText("Ответ получился!", { exact: true }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", {
        name: i === 2 ? "Завершить блок" : "Следующий вопрос",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Три вопроса — готово.", exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice).toHaveLength(3);
  expect(data.practice.map((p: { taskId: string }) => p.taskId)).toEqual([
    "exam-q-01",
    "exam-q-02",
    "exam-q-03",
  ]);
  expect(
    data.practice.every(
      (p: { checked: boolean; correct: number }) =>
        p.checked && p.correct === 1,
    ),
  ).toBe(true);
  expect(data.memory).toEqual({});
  await page.screenshot({
    path: testInfo.outputPath("examiner-block-finished.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ещё короткий блок", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Γιατί ήρθατε στην Κύπρο;",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Прогресс вопросов" }),
  ).toHaveAttribute("aria-valuemax", "3");
});

test("a chosen examiner question is checked without accepting an invented profession", async ({
  page,
}) => {
  await page.goto("/#questions");
  await page.getByLabel("Поиск вопросов", { exact: true }).fill("Если бы");
  await expect(page.locator(".exam-question")).toHaveCount(1);
  await page.locator(".exam-question summary").click();
  await expect(page.locator(".exam-question-answer")).toContainText(
    "προϊόντων πληροφορικής",
  );
  await page
    .getByRole("button", { name: "Потренировать ответ", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Прогресс вопросов" }),
  ).toHaveAttribute("aria-valuemax", "1");
  await page
    .getByRole("button", { name: "Написать самому", exact: true })
    .click();
  await page
    .getByLabel("Ответ по-гречески", { exact: true })
    .fill("Θα ήθελα να είμαι γιατρός.");
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(
    page.getByText("Посмотри на пример ответа", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Завершить блок", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ответ сохранён.", exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice).toHaveLength(1);
  expect(data.practice[0]).toMatchObject({
    taskId: "exam-q-17",
    checked: true,
    correct: 0,
    total: 1,
  });
  expect(data.memory).toEqual({});
  await page
    .getByRole("button", { name: "К списку вопросов", exact: true })
    .click();
  await expect(page.getByLabel("Поиск вопросов", { exact: true })).toHaveValue(
    "Если бы",
  );
  await page.getByLabel("Поиск вопросов", { exact: true }).fill("");
  await expect(page.locator(".exam-question")).toHaveCount(38);
});
