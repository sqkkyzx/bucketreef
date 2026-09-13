/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import {
  adminRgwSelectACephEndpoint,
} from "./adminRgwMessages";
import { translate, useI18n } from "../../i18n";
import type { UiLanguage } from "../../components/language";
import { useState } from "react";
import { focusFirstInvalidField } from "../../utils/focusFirstInvalidField";

/** Bind native and RGW-specific validation to named fields, retaining failed drafts. */
export function useAdminRgwFormValidation(values: Record<string, unknown>, fieldErrors: Record<string, string | undefined>) {
  const { locale } = useI18n();
  const [attempted, setAttempted] = useState(false);
  const [nativeErrors, setNativeErrors] = useState<Record<string, {value: unknown; message: string}>>({});
  const errors = attempted ? {...Object.fromEntries(Object.entries(nativeErrors)
    .filter(([key, error]) => values[key] === error.value).map(([key, error]) => [key, error.message])), ...fieldErrors} : {};
  return {
    errors,
    reset: () => { setAttempted(false); setNativeErrors({}); },
    validate: (form: HTMLFormElement) => {
      setAttempted(true);
      const native: typeof nativeErrors = {};
      for (const control of Array.from(form.elements)) {
        if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) || !control.name || control.disabled || control.validity.valid) continue;
        native[control.name] = {value: values[control.name], message: control.validity.typeMismatch ? translate({
          en: "Enter a valid email address.",
          fr: "Saisissez une adresse e-mail valide.",
          de: "Geben Sie eine gültige E-Mail-Adresse ein.",
          zh: "请输入有效的邮箱地址。",
        }, locale) : control.validity.badInput ? translate({
          en: "Enter a valid number.",
          fr: "Saisissez un nombre valide.",
          de: "Geben Sie eine gültige Zahl ein.",
          zh: "请输入有效数字。",
        }, locale) : control.validationMessage};
      }
      setNativeErrors(native);
      if (Object.values(fieldErrors).some(Boolean) || Object.keys(native).length > 0) {
        focusFirstInvalidField(form);
        return false;
      }
      return true;
    },
  };
}

export function rgwCreateErrors(value: {name: string; storage_endpoint_id: string; quota_max_size_gb: string; quota_max_objects: string}, locale: UiLanguage = "en"): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!value.name.trim()) errors.name = translate({
    en: "Enter a name.",
    fr: "Saisissez un nom.",
    de: "Geben Sie einen Namen ein.",
    zh: "请输入名称。",
  }, locale);
  if (!value.storage_endpoint_id) errors.storage_endpoint_id = translate(adminRgwSelectACephEndpoint, locale);
  if (value.quota_max_size_gb && (!Number.isFinite(Number(value.quota_max_size_gb)) || Number(value.quota_max_size_gb) < 0)) errors.quota_max_size_gb = translate({
    en: "Enter a non-negative storage quota.",
    fr: "Saisissez un quota de stockage positif ou nul.",
    de: "Geben Sie ein nicht negatives Speicherkontingent ein.",
    zh: "请输入非负的存储配额。",
  }, locale);
  if (value.quota_max_objects && (!Number.isSafeInteger(Number(value.quota_max_objects)) || Number(value.quota_max_objects) < 0)) errors.quota_max_objects = translate({
    en: "Enter a non-negative whole number within the supported range.",
    fr: "Saisissez un entier positif ou nul dans la plage prise en charge.",
    de: "Geben Sie eine nicht negative ganze Zahl im unterstützten Bereich ein.",
    zh: "请输入支持范围内的非负整数。",
  }, locale);
  return errors;
}

export function rgwImportEntries(text: string, kind: "account" | "user", locale: UiLanguage = "en") {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const entries = kind === "account" ? lines : lines.map(line => (line.includes("/") ? line.split("/", 2)[1] : line).trim());
  const invalid = lines.filter((_, index) => kind === "account" ? !/^RGW\d{17}$/.test(entries[index]) : !entries[index]);
  return {entries, error: !entries.length ? translate({
    en: "Enter at least one identifier.",
    fr: "Saisissez au moins un identifiant.",
    de: "Geben Sie mindestens eine Kennung ein.",
    zh: "请至少输入一个标识符。",
  }, locale) : invalid.length ? translate({
    en: `Invalid identifiers: ${invalid.join(", ")}`,
    fr: `Identifiants invalides : ${invalid.join(", ")}`,
    de: `Ungültige Kennungen: ${invalid.join(", ")}`,
    zh: `无效标识符：${invalid.join(", ")}`,
  }, locale) : undefined};
}
