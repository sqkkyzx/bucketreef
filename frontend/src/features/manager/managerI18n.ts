/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useCallback } from "react";
import { useI18n, type I18nMessage } from "../../i18n";

export type ManagerZhMessages = Readonly<Record<string, string>>;

export function useManagerText(zhMessages: ManagerZhMessages) {
  const { locale } = useI18n();
  const t = useCallback(
    (message: string | I18nMessage) => {
      if (typeof message !== "string") {
        return message[locale] ?? message.en ?? message.fr ?? message.de ?? message.zh ?? "";
      }
      return locale === "zh" ? zhMessages[message] ?? message : message;
    },
    [locale, zhMessages],
  );

  return { locale, t };
}
