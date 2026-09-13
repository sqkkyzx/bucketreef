import { expect, test } from "@playwright/test";
import { buildBaseRules } from "./fixtures/base";
import { portalUser } from "./fixtures/users";
import { registerApiMocks } from "./mockApi";
import { seedUiPreferences } from "./uiPreferences";

const routes = [
  ["/portal", "Portal 仪表盘"],
  ["/portal/storage-spaces", "创建空间"],
  ["/portal/storage-spaces/genomics-2026?tab=settings", "文件历史"],
  ["/portal/storage-spaces/genomics-2026?tab=statistics", "文件组成"],
  ["/portal/shares", "项目成员"],
  ["/portal/history", "历史记录"],
  ["/portal/usage", "容量与文件"],
  ["/portal/access-keys", "外部 S3 工具"],
  ["/portal/requests", "帮助请求"],
  ["/portal/settings", "管理项目功能和默认设置。"],
  ["/portal/profile", "个人资料与偏好设置"],
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`Simplified Chinese ${theme} ${width}`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const mocks = await registerApiMocks(page, buildBaseRules(), "chinese-visual-qa", { ...portalUser, ui_language: "zh" });
      await seedUiPreferences(page, { selectedWorkspace: "portal", selectedPortalAccountId: "101", theme });
      for (const [path, label] of routes) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main").getByText(label, { exact: false }).first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
        if (path === "/portal/access-keys") {
          await page.getByRole("button", { name: "配置工具", exact: true }).click();
          const dialog = page.getByRole("dialog", { name: "连接工具" });
          await expect(dialog).toBeVisible();
          await expect(dialog.getByText("高级工具和手动配置", { exact: true })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();
        }
        if (path === "/portal/profile") {
          await expect(page.getByRole("combobox", { name: "语言", exact: true })).toHaveValue("zh");
          await expect(page.getByRole("option", { name: "简体中文" })).toHaveCount(1);
          await page.reload();
          await expect(page.getByRole("combobox", { name: "语言", exact: true })).toHaveValue("zh");
        }
        await page.screenshot({ path: testInfo.outputPath(`${path.replace(/[^a-z0-9]/gi, "-")}.png`), fullPage: true });
      }
      mocks.assertNoUnmatched();
      expect(errors).toEqual([]);
    });
  }
}
