/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import ModalActions from "./ModalActions";
import ModalOptions from "./ModalOptions";
import { type ReactNode, useId } from "react";
import Modal from "./Modal";
import UiButton from "./ui/UiButton";
import UiInlineMessage from "./ui/UiInlineMessage";
import "./settings/compactSettings.css";
import { useI18n } from "../i18n";

type ConfirmActionDialogDetail = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

type ConfirmActionDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  processingLabel?: string;
  impactLabel?: string;
  closeLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  confirmDisabled?: boolean;
  details?: ConfirmActionDialogDetail[];
  impacts?: ReactNode[];
  warning?: ReactNode;
  warningTone?: "neutral" | "warning";
  options?: ReactNode;
  error?: ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  processingLabel = "Processing...",
  impactLabel = "Impact",
  closeLabel,
  tone = "danger",
  loading = false,
  confirmDisabled = false,
  details = [],
  impacts = [],
  warning,
  warningTone = "neutral",
  options,
  error,
  maxWidthClass = "max-w-xl",
  zIndexClass,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const { t } = useI18n();
  const resolvedCancelLabel = cancelLabel === "Cancel" ? t({ en: "Cancel", zh: "取消" }) : cancelLabel;
  const resolvedProcessingLabel = processingLabel === "Processing..." ? t({ en: "Processing...", zh: "正在处理…" }) : processingLabel;
  const resolvedImpactLabel = impactLabel === "Impact" ? t({ en: "Impact", zh: "影响" }) : impactLabel;
  const descriptionId = useId();
  return (
    <Modal
      className="settings-dialog"
      title={title}
      onClose={onCancel}
      maxWidthClass={maxWidthClass}
      zIndexClass={zIndexClass}
      closeDisabled={loading}
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
      closeLabel={closeLabel}
      closeAriaLabel={closeLabel}
      ariaDescribedby={descriptionId}
    >
      <div className="settings-stack">
        <p id={descriptionId} className="settings-body text-[var(--ui-text-muted)] [overflow-wrap:anywhere]">{description}</p>

        {details.length > 0 && (
          <dl className="grid gap-2">
            {details.map((detail) => (
              <div key={detail.label} className="grid min-w-0 gap-1 border-b border-[var(--ui-border-soft)] pb-2 last:border-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
                <dt className="settings-label min-w-0 [overflow-wrap:anywhere]">{detail.label}</dt>
                <dd className={`settings-body min-w-0 [overflow-wrap:anywhere] ${detail.mono ? "font-mono" : ""}`}>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {impacts.length > 0 && (
          <UiInlineMessage tone="warning">
            <p className="settings-label">{resolvedImpactLabel}</p>
            <ul className="settings-body mt-1 list-disc space-y-1 pl-4 [overflow-wrap:anywhere]">
              {impacts.map((impact, index) => <li key={index}>{impact}</li>)}
            </ul>
          </UiInlineMessage>
        )}

        {warning && <UiInlineMessage tone={warningTone} className="[overflow-wrap:anywhere]">{warning}</UiInlineMessage>}
        {options && (
          <fieldset disabled={loading} className="min-w-0">
            <ModalOptions>{options}</ModalOptions>
          </fieldset>
        )}
        {error && <UiInlineMessage tone="error" role="alert" className="[overflow-wrap:anywhere]">{error}</UiInlineMessage>}

        <ModalActions>
          <UiButton variant="secondary" onClick={onCancel} disabled={loading}>{resolvedCancelLabel}</UiButton>
          <UiButton variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={loading || confirmDisabled}>
            {loading ? resolvedProcessingLabel : confirmLabel}
          </UiButton>
        </ModalActions>
      </div>
    </Modal>
  );
}
