/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListActionButton } from "./list/ListControls";
import type { ReactNode } from "react";
import UiField from "./ui/UiField";
import { cx, uiInputClass } from "./ui/styles";
import { useI18n } from "../i18n";

type ToolbarSearchMatchMode = "contains" | "exact";

type ToolbarSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: ReactNode;
  className?: string;
  active?: boolean;
  inputClassName?: string;
  inputWrapperClassName?: string;
  matchMode?: ToolbarSearchMatchMode;
  onToggleMatchMode?: () => void;
  trailingControl?: ReactNode;
};

export default function ToolbarSearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = "w-full sm:w-72",
  active = false,
  inputClassName,
  inputWrapperClassName,
  matchMode,
  onToggleMatchMode,
  trailingControl,
}: ToolbarSearchInputProps) {
  const { locale, t } = useI18n();
  const resolvedLabel = label ?? t({ en: "Search", zh: "搜索" });
  const matchModeLabel = matchMode === "contains"
    ? t({ en: "contains", zh: "包含" })
    : t({ en: "exact", zh: "精确匹配" });
  const matchModeControl =
    matchMode && onToggleMatchMode ? (
      <ListActionButton iconOnly
        type="button"
        onClick={onToggleMatchMode}
        className="ui-list-search-mode"
        title={locale === "zh" ? `筛选模式：${matchModeLabel}` : `Filter mode: ${matchModeLabel}`}
        aria-label={t({ en: "Toggle filter match mode", zh: "切换筛选匹配模式" })}
      >
        {matchMode === "contains" ? "~" : "="}
      </ListActionButton>
    ) : null;
  const resolvedTrailingControl = trailingControl ?? matchModeControl;
  const renderInput = ({ id, describedBy, invalid }: { id: string; describedBy?: string; invalid: boolean }) => (
    <input
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cx(
        uiInputClass,
        "ui-list-control",
        resolvedTrailingControl ? "ui-list-search" : "",
        active ? "border-primary/50 bg-primary/5 dark:bg-primary/10" : "",
        inputClassName
      )}
    />
  );

  return (
    <UiField label={resolvedLabel} className={className}>
      {(fieldProps) =>
        resolvedTrailingControl ? (
          <div className={cx("relative", inputWrapperClassName)}>
            {renderInput(fieldProps)}
            {resolvedTrailingControl}
          </div>
        ) : (
          renderInput(fieldProps)
        )
      }
    </UiField>
  );
}
