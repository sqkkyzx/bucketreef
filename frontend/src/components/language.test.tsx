import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "./language";
import { setSessionUserCache } from "../utils/workspaces";

function CurrentLanguage() {
  const { language } = useLanguage();
  return <output aria-label="Current language">{language}</output>;
}

function renderLanguage() {
  return render(<LanguageProvider><CurrentLanguage /></LanguageProvider>);
}

afterEach(() => {
  cleanup();
  setSessionUserCache(null);
  vi.restoreAllMocks();
});

describe("Chinese language selection", () => {
  it.each(["zh", "zh-CN", "zh-SG", "zh-Hans", "zh-Hans-CN"])("detects %s automatically", browserLanguage => {
    setSessionUserCache(null);
    vi.spyOn(navigator, "languages", "get").mockReturnValue([browserLanguage, "en"]);
    renderLanguage();
    expect(screen.getByLabelText("Current language")).toHaveTextContent("zh");
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it.each(["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "es"])("does not misidentify %s as Simplified Chinese", browserLanguage => {
    setSessionUserCache(null);
    vi.spyOn(navigator, "languages", "get").mockReturnValue([browserLanguage, "fr", "en"]);
    renderLanguage();
    expect(screen.getByLabelText("Current language")).toHaveTextContent("fr");
  });

  it("restores saved Chinese and follows session updates and automatic selection", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
    setSessionUserCache({ ui_language: "zh" });
    const first = renderLanguage();
    expect(screen.getByLabelText("Current language")).toHaveTextContent("zh");
    first.unmount();
    renderLanguage();
    expect(document.documentElement.lang).toBe("zh-Hans");
    act(() => setSessionUserCache({ ui_language: "de" }));
    expect(screen.getByLabelText("Current language")).toHaveTextContent("de");
    act(() => setSessionUserCache({ ui_language: null }));
    expect(screen.getByLabelText("Current language")).toHaveTextContent("en");
  });
});
