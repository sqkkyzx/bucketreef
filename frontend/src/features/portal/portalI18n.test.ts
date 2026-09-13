import { describe, expect, it } from "vitest";
import { portalDateLabel, formatPortalCurrency } from "./portalI18n";
import { translate } from "../../i18n";

describe("portal i18n helpers", () => {
  it("translates the requested locale and falls back deterministically", () => {
    expect(translate({ en: "Storage Spaces", fr: "Espaces de stockage", de: "Speicherbereiche" }, "fr")).toBe("Espaces de stockage");
    expect(translate({ fr: "Partages", de: "Freigaben" }, "en")).toBe("Partages");
    expect(translate("Portal", "de")).toBe("Portal");
  });
});

describe("Simplified Chinese", () => {
  it("uses Chinese and falls back to English for untranslated messages", () => {
    expect(translate({ en: "Spaces", zh: "空间" }, "zh")).toBe("空间");
    expect(translate({ en: "New feature", fr: "Nouvelle fonction" }, "zh")).toBe("New feature");
    expect(translate("S3", "zh")).toBe("S3");
  });
});

 it("formats Chinese dates and currency without changing the billing currency", () => {
   expect(portalDateLabel("2026-09-13T12:00:00Z", "zh")).toBe("2026年9月13日");
   expect(formatPortalCurrency(1234.5, "EUR", "zh")).toBe(new Intl.NumberFormat("zh-CN", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(1234.5));
 });
