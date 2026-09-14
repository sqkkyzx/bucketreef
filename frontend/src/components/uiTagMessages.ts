/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { useCallback } from "react";
import { useI18n } from "../i18n";

const zhMessages: Record<string, string> = {
  Tags: "标签",
  "Add a tag": "添加标签",
  Private: "私有",
  Shared: "共享",
  Color: "颜色",
  Scope: "范围",
  Standard: "标准",
  Administrative: "管理",
  "Also visible in selectors.": "也会显示在选择器中。",
  "Visible only in management lists and edit surfaces.": "仅显示在管理列表和编辑界面中。",
  "Tag settings": "标签设置",
  "This tag belongs to your private-connection tag catalog.": "此标签属于你的私有连接标签目录。",
  "This tag is shared across the current domain.": "此标签在当前域内共享。",
  "Administrative tags stay in your private-connection management views. Standard tags can also appear in selectors.": "管理标签仅显示在私有连接管理界面中，标准标签还可显示在选择器中。",
  "Administrative tags stay in management views. Standard tags can also appear in selectors.": "管理标签仅显示在管理界面中，标准标签还可显示在选择器中。",
  "This new tag stays local to the form until you save.": "此新标签会保留在当前表单中，直到你保存。",
  Neutral: "中性",
  Slate: "石板灰",
  Gray: "灰色",
  Zinc: "锌灰",
  Stone: "石色",
  Red: "红色",
  Orange: "橙色",
  Amber: "琥珀色",
  Yellow: "黄色",
  Lime: "青柠色",
  Green: "绿色",
  Emerald: "翠绿色",
  Teal: "蓝绿色",
  Cyan: "青色",
  Sky: "天蓝色",
  Blue: "蓝色",
  Indigo: "靛蓝色",
  Violet: "紫罗兰色",
  Purple: "紫色",
  Fuchsia: "紫红色",
  Pink: "粉色",
  Rose: "玫瑰色",
};

export function uiTagText(message: string, locale: "en" | "fr" | "de" | "zh"): string {
  return locale === "zh" ? zhMessages[message] ?? message : message;
}

export function useUiTagText() {
  const { locale } = useI18n();
  const t = useCallback((message: string) => uiTagText(message, locale), [locale]);
  return { locale, t };
}
