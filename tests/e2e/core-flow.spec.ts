import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天要教什麼？" }),
  ).toBeVisible();
});

test("mobile layout opens key workflows without horizontal overflow", async ({
  page,
}) => {
  const body = await page.locator("body").boundingBox();
  expect(body?.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "動作庫" }).click();
  await expect(page.getByRole("heading", { name: "動作庫" })).toBeVisible();
  await page.getByLabel("搜尋動作庫").fill("Footwork");
  await expect(
    page.getByText("Footwork", { exact: true }).first(),
  ).toBeVisible();
});

test("teaching mode shows timers and classroom controls", async ({ page }) => {
  await page.getByRole("button", { name: "開始帶課" }).first().click();
  await expect(page.getByText("整堂課")).toBeVisible();
  await expect(page.getByText("目前動作")).toBeVisible();
  await expect(page.getByRole("button", { name: "暫停" })).toBeVisible();
  await page.getByRole("button", { name: "暫停" }).click();
  await expect(page.getByRole("button", { name: "繼續" })).toBeVisible();
  await expect(page.getByRole("button", { name: "＋30秒" })).toBeVisible();
});

test("dialog traps focus, closes with Escape and returns focus", async ({
  page,
}) => {
  const createButton = page.getByRole("button", { name: "新增課程" }).first();
  await createButton.focus();
  await createButton.click();
  const dialog = page.getByRole("dialog", { name: "建立新課程" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(createButton).toBeFocused();
});

test("teacher can create, arrange, cue and study a course", async (
  { page },
  testInfo,
) => {
  test.skip(testInfo.project.name !== "mobile-390x844");
  await page.getByRole("button", { name: "新增課程" }).first().click();
  await page.getByLabel("課程名稱").fill("自動測試 Reformer");
  await page.getByRole("button", { name: /建立並開始排課/ }).click();
  await expect(page.getByLabel("課表名稱")).toHaveValue("自動測試 Reformer");

  const addExercise = async (name: string) => {
    await page.getByRole("button", { name: "加入動作" }).click();
    await page.getByLabel("搜尋可加入或替換的動作").fill(name);
    await page.getByRole("button", { name: "加入課表" }).first().click();
  };
  await addExercise("Footwork");
  await addExercise("Bridge");

  const cards = page.locator(".sortable-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Footwork");
  await cards.nth(1).getByRole("button", { name: /拖曳/ }).press("ArrowUp");
  await expect(cards.nth(0)).toContainText("Bridge");

  await cards.nth(0).getByRole("button", { name: "展開編輯" }).click();
  await cards.nth(0).getByLabel("動作口令").fill("測試專屬 Cue");
  await expect(cards.nth(0).getByLabel("動作口令")).toHaveValue(
    "測試專屬 Cue",
  );
  await page
    .getByRole("main")
    .getByRole("button", { name: "背課", exact: true })
    .click();
  await expect(page.getByText("順序背誦", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "只練普通／不熟" })).toBeVisible();
});

test("complete backup downloads valid local data", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844");
  await page.getByRole("button", { name: "開啟設定" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出完整備份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/pilates-prep-backup.*\.json/);
  expect(await download.failure()).toBeNull();
});

test("template use button preselects and fills the course", async (
  { page },
  testInfo,
) => {
  test.skip(testInfo.project.name !== "mobile-390x844");
  await page.getByLabel("主要導覽").getByRole("button", { name: "備課" }).click();
  await page.locator(".template-mini-row").getByRole("button", { name: "使用" }).click();
  await expect(page.getByRole("dialog", { name: "建立新課程" })).toBeVisible();
  await expect(page.getByLabel("課程名稱")).toHaveValue(
    "初階 Reformer 50 分鐘",
  );
  await expect(page.locator(".template-choice select")).not.toHaveValue("");
});

test("installed shell reloads without a network", async (
  { page, context },
  testInfo,
) => {
  test.skip(testInfo.project.name !== "mobile-390x844");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "今天要教什麼？" }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
