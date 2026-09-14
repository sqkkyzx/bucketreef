/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";

export function summarizeInlinePolicyDocument(
  document: Record<string, unknown> | null | undefined,
  locale: UiLanguage = "en",
): string {
  if (!document || Object.keys(document).length === 0) {
    return locale === "zh" ? "空 JSON 文档" : "Empty JSON document";
  }

  const topLevelKeys = Object.keys(document).length;
  const statements = Array.isArray((document as { Statement?: unknown }).Statement)
    ? ((document as { Statement: unknown[] }).Statement?.length ?? 0)
    : null;

  if (locale === "zh") {
    const parts: string[] = [];
    if (statements !== null) {
      parts.push(`${statements.toLocaleString("zh-CN")} 条语句`);
    }
    parts.push(`${topLevelKeys.toLocaleString("zh-CN")} 个顶层字段`);
    return parts.join(" • ");
  }

  const parts: string[] = [];
  if (statements !== null) {
    parts.push(`${statements} statement${statements === 1 ? "" : "s"}`);
  }
  parts.push(`${topLevelKeys} top-level ${topLevelKeys === 1 ? "field" : "fields"}`);

  return parts.join(" • ");
}
