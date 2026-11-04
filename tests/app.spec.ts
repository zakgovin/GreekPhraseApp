import { test, expect } from "@playwright/test";
test("honest daily session, hidden answers, durable resume and daily limit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Γεια σου, Захар/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Понятно, продолжить", exact: true })
      .click();
  await expect(page.getByText("Με λένε Ζαχάρ.", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Я ответил — сравнить", exact: true })
    .click();
  await expect(page.getByText("Με λένε Ζαχάρ.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Вспомнил самостоятельно", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мне тридцать семь лет.", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Я ответил — сравнить", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Вспомнил самостоятельно", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Отлично. Теперь — пауза." }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(stored.reviews).toHaveLength(3);
  expect(Object.keys(stored.memory).every((k) => k.endsWith(":speaking"))).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "На сегодня всё", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Хорошая работа/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
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
test("conversation can be completed by text without grading every phrase", async ({
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
    await page.getByLabel("Или ответьте текстом").fill(answer);
    await page
      .getByRole("button", { name: "Сравнить с образцом", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Мне удалось", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Разговор состоялся." }),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("frasi.progress.v1")!),
  );
  expect(data.practice).toHaveLength(1);
  expect(data.practice[0].skill).toBe("speaking");
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
test("microphone recording is local and remains playable after reload", async ({
  page,
}) => {
  await page.goto("/#conversation");
  await page.locator(".conversation-tile").first().click();
  await page
    .getByRole("button", { name: "Записать ответ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Остановить запись", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(750);
  await page
    .getByRole("button", { name: "Остановить запись", exact: true })
    .click();
  await expect(page.getByLabel("Ваша запись ответа")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.reload();
  await page.locator(".conversation-tile").first().click();
  await expect(page.getByLabel("Ваша запись ответа")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  const savedAudio = page.getByLabel("Ваша запись ответа");
  await savedAudio.evaluate((el: HTMLAudioElement) => el.play());
  await expect
    .poll(() => savedAudio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await savedAudio.evaluate((el: HTMLAudioElement) => el.pause());
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
  expect(errors).toEqual([]);
});

test("backup export restores settings and invalid import leaves them intact", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page.getByLabel("Новых фраз в день", { exact: true }).selectOption("5");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Экспортировать прогресс", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const chunk of stream!) parts.push(Buffer.from(chunk));
  const backup = Buffer.concat(parts);
  expect(JSON.parse(backup.toString()).progress.settings.dailyNew).toBe(5);
  await page.getByLabel("Новых фраз в день", { exact: true }).selectOption("8");
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
    page.getByLabel("Новых фраз в день", { exact: true }),
  ).toHaveValue("8");
  await page.getByLabel("Файл резервной копии", { exact: true }).setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page
    .getByRole("button", { name: "Восстановить этот файл", exact: true })
    .click();
  await expect(
    page.getByLabel("Новых фраз в день", { exact: true }),
  ).toHaveValue("5");
  await page.reload();
  await expect(
    page.getByLabel("Новых фраз в день", { exact: true }),
  ).toHaveValue("5");
});
