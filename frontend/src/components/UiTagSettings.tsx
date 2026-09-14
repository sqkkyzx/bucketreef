/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  type ReactNode,
  type RefObject,
  useRef,
} from "react";

import type { TagColorKey, TagScope } from "../api/tags";
import { getTagColorOption, TAG_COLOR_OPTIONS } from "../utils/tagPalette";
import AnchoredPortalMenu from "./ui/AnchoredPortalMenu";
import UiRemoveIcon from "./ui/UiRemoveIcon";
import { cx, uiBadgeShapeClass, uiLabelClass } from "./ui/styles";
import { useDismissibleLayer } from "./ui/useDismissibleLayer";
import { uiTagText, useUiTagText } from "./uiTagMessages";

type UiTagVisibility = "private" | "shared";
type UiTagSelectionState = "selected" | "available";

type UiTagBadgeProps = {
  label: string;
  colorKey: string;
  visibility?: UiTagVisibility;
  selectionState?: UiTagSelectionState;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
  onRemove?: () => void;
  removeAriaLabel?: string;
};

const visibilityLabel = (visibility: UiTagVisibility | undefined, locale: "en" | "fr" | "de" | "zh") =>
  visibility === "private" ? uiTagText("Private", locale) : visibility === "shared" ? uiTagText("Shared", locale) : null;

export function UiTagBadge({
  label,
  colorKey,
  visibility,
  selectionState,
  active = false,
  disabled = false,
  title,
  ariaLabel,
  className,
  onClick,
  onRemove,
  removeAriaLabel,
}: UiTagBadgeProps) {
  const { locale } = useUiTagText();
  const visibilityText = visibilityLabel(visibility, locale);
  const accessibleLabel = visibilityText ? `${label}, ${visibilityText}` : label;
  const labelContent = onClick ? (
    <span className="truncate">{label}</span>
  ) : (
    label
  );
  return (
    <span
      className={cx(
        "ui-tag-badge inline-flex max-w-full items-center overflow-hidden transition",
        uiBadgeShapeClass,
        getTagColorOption(colorKey).badgeClassName,
        visibility === "private" && "!border-dashed",
        visibility === "shared" && "!border-solid",
        active && "ring-2 ring-primary/40",
        selectionState === "selected" && "ring-2 ring-primary/50",
        selectionState === "available" &&
          "!bg-transparent hover:!bg-slate-50 focus-within:!bg-slate-50 dark:hover:!bg-slate-800/70 dark:focus-within:!bg-slate-800/70",
        (onClick || onRemove) &&
          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-700 dark:focus-within:outline-primary-200",
        disabled && "opacity-60",
        className
      )}
      title={title ?? accessibleLabel}
      data-tag-visibility={visibility}
      data-tag-selection-state={selectionState}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel ?? (locale === "zh" ? `配置界面标签 ${accessibleLabel}` : `Configure UI tag ${accessibleLabel}`)}
          className="inline-flex min-w-0 items-center gap-1 px-2 py-0.5 text-[10px] font-medium leading-4 focus:outline-none"
        >
          {labelContent}
        </button>
      ) : (
        <span
          aria-label={ariaLabel ?? accessibleLabel}
          className="inline-flex min-w-0 items-center gap-1 px-2 py-0.5 text-[10px] font-medium leading-4"
        >
          {labelContent}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          disabled={disabled}
          aria-label={removeAriaLabel ?? (locale === "zh" ? `移除界面标签 ${accessibleLabel}` : `Remove UI tag ${accessibleLabel}`)}
          className="flex items-center border-l border-current/15 px-1.5 py-0.5 opacity-70 transition hover:opacity-100 focus:outline-none"
        >
          <UiRemoveIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

type UiTagColorPaletteProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (colorKey: TagColorKey) => void | Promise<void>;
};

export function UiTagColorPalette({
  label,
  value,
  disabled = false,
  onChange,
}: UiTagColorPaletteProps) {
  const { locale, t } = useUiTagText();
  return (
    <div className="space-y-2">
      <span className={uiLabelClass}>{t("Color")}</span>
      <div className="grid grid-cols-6 gap-2">
        {TAG_COLOR_OPTIONS.map((option) => {
          const selected = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              aria-label={locale === "zh" ? `将 ${label} 的颜色设为${t(option.label)}` : `Set ${label} color to ${option.label}`}
              title={t(option.label)}
              disabled={disabled}
              onClick={() => void onChange(option.key)}
              className={cx(
                "inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition hover:scale-105 disabled:cursor-wait disabled:hover:scale-100",
                selected
                  ? "border-slate-900 ring-2 ring-primary/50 dark:border-slate-100"
                  : "border-slate-300 dark:border-slate-600"
              )}
            >
              <span className={cx("h-4 w-4 rounded-full", option.swatchClassName)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const UI_TAG_SCOPE_OPTIONS: Array<{
  key: TagScope;
  label: string;
  description: string;
}> = [
  {
    key: "standard",
    label: "Standard",
    description: "Also visible in selectors.",
  },
  {
    key: "administrative",
    label: "Administrative",
    description: "Visible only in management lists and edit surfaces.",
  },
];

export function getUiTagScopeOption(scope: TagScope | undefined, locale: "en" | "fr" | "de" | "zh" = "en") {
  const option = (
    UI_TAG_SCOPE_OPTIONS.find((option) => option.key === scope) ??
    UI_TAG_SCOPE_OPTIONS[0]
  );
  return {
    ...option,
    label: uiTagText(option.label, locale),
    description: uiTagText(option.description, locale),
  };
}

type UiTagScopeSettingsProps = {
  value: TagScope;
  readOnly?: boolean;
  help?: ReactNode;
  onChange?: (scope: TagScope) => void;
};

export function UiTagScopeSettings({
  value,
  readOnly = false,
  help,
  onChange,
}: UiTagScopeSettingsProps) {
  const { locale, t } = useUiTagText();
  const options = readOnly
    ? UI_TAG_SCOPE_OPTIONS.filter((option) => option.key === value)
    : UI_TAG_SCOPE_OPTIONS;
  return (
    <div className="space-y-2">
      <span className={uiLabelClass}>{t("Scope")}</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/70">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(option.key)}
              className={cx(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                selected
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                readOnly && "cursor-default"
              )}
            >
              {getUiTagScopeOption(option.key, locale).label}
            </button>
          );
        })}
      </div>
      {help && <p className="ui-caption text-slate-500 dark:text-slate-400">{help}</p>}
    </div>
  );
}

type UiTagSettingsPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  colorKey: string;
  visibility?: UiTagVisibility;
  description: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function UiTagSettingsPopover({
  open,
  anchorRef,
  label,
  colorKey,
  visibility,
  description,
  onDismiss,
  children,
  footer,
}: UiTagSettingsPopoverProps) {
  const { locale, t } = useUiTagText();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDismissibleLayer({
    open,
    insideRefs: [anchorRef, panelRef],
    onDismiss,
  });
  return (
    <AnchoredPortalMenu
      open={open}
      anchorRef={anchorRef}
      placement="bottom-start"
      offset={6}
      minWidth={288}
      className="z-[90]"
    >
      <div
        ref={panelRef}
        role="group"
        aria-label={locale === "zh" ? `${label} 的标签设置` : `Tag settings for ${label}`}
        className="w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <span className={uiLabelClass}>{t("Tag settings")}</span>
            <div className="flex items-start justify-between gap-3">
              <UiTagBadge
                label={label}
                colorKey={colorKey}
                visibility={visibility}
              />
              <button
                type="button"
                onClick={onDismiss}
                className="ui-caption font-semibold text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={locale === "zh" ? "关闭标签设置" : "Close tag settings"}
              >
                ×
              </button>
            </div>
            <p className="ui-caption text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </AnchoredPortalMenu>
  );
}
