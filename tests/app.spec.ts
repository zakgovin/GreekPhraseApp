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
    await page.getByRole("button", { name: "Дальше", exact: true }).click();
}
test("guided lessons check answers, persist feedback and continue beyond three new phrases", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startLesson(page);
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
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await assemble(page);
    await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
  expect(errors).toEqual([]);
});
test("help is processed automatically and returns the phrase after other exercises", async ({
  page,
}) => {
  await startLesson(page);
  await page.getByRole("button", { name: "Не помню", exact: true }).click();
  await expect(
    page.getByText("Запомним эту фразу", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.reviews).toHaveLength(1);
  expect(data.reviews[0].rating).toBe(1);
  expect(data.reviews[0].assisted).toBe(true);
  const retry = data.session.items.findIndex(
    (item: { retry?: boolean }) => item.retry,
  );
  expect(retry).toBeGreaterThanOrEqual(data.session.index + 2);
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
  await expect(page.locator(".phrase-tile")).toHaveCount(122);
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
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
