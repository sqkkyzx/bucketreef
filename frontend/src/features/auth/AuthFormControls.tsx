/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useState, type ComponentProps } from "react";

import UiButton from "../../components/ui/UiButton";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import { cx } from "../../components/ui/styles";
import { useI18n } from "../../i18n";

const authFieldLabelClass =
  "normal-case tracking-normal ui-body font-medium text-slate-700";
const authControlClass =
  "mt-1 rounded-xl border-slate-200/90 bg-white/90 px-3 py-2.5 text-slate-800 shadow-sm focus:border-primary focus:ring-primary/30";

export function AuthInput({ className, labelClassName, ...props }: ComponentProps<typeof UiInput>) {
  return (
    <UiInput
      {...props}
      labelClassName={cx(authFieldLabelClass, labelClassName)}
      className={cx(authControlClass, className)}
    />
  );
}

type AuthPasswordInputProps = Omit<ComponentProps<typeof AuthInput>, "type"> & {
  secretLabel?: string;
};

export function AuthPasswordInput({
  className,
  secretLabel: providedSecretLabel,
  ...props
}: AuthPasswordInputProps) {
  const { t } = useI18n();
  const secretLabel = providedSecretLabel ?? t({ en: "password", zh: "密码" });
  const [visible, setVisible] = useState(false);
  const actionLabel = visible
    ? t({ en: `Hide ${secretLabel}`, zh: `隐藏${secretLabel}` })
    : t({ en: `Show ${secretLabel}`, zh: `显示${secretLabel}` });

  return (
    <div className="relative">
      <AuthInput
        {...props}
        type={visible ? "text" : "password"}
        className={cx("pr-20", className)}
      />
      <button
        type="button"
        aria-label={actionLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute bottom-2.5 right-3 ui-caption font-semibold text-primary-700 hover:text-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        {visible ? t({ en: "Hide", zh: "隐藏" }) : t({ en: "Show", zh: "显示" })}
      </button>
    </div>
  );
}

export function AuthSelect({ className, labelClassName, ...props }: ComponentProps<typeof UiSelect>) {
  return (
    <UiSelect
      {...props}
      labelClassName={cx(authFieldLabelClass, labelClassName)}
      className={cx(authControlClass, className)}
    />
  );
}

type AuthButtonProps = ComponentProps<typeof UiButton> & {
  presentation?: "primary" | "provider";
};

export function AuthButton({ presentation = "primary", className, ...props }: AuthButtonProps) {
  return (
    <UiButton
      {...props}
      variant={presentation === "provider" ? "secondary" : "primary"}
      className={cx(
        "w-full rounded-xl py-2.5 ui-body",
        presentation === "provider" &&
          "border-slate-200/90 bg-white font-medium text-slate-700 hover:border-primary hover:text-primary-700",
        className,
      )}
    />
  );
}
