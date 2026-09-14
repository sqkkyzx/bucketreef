/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useId } from "react";
import type { InlinePolicy } from "../../api/managerIamPolicies";
import InlinePolicyChoice from "./InlinePolicyChoice";
import UiInput from "../../components/ui/UiInput";
import UiTextarea from "../../components/ui/UiTextarea";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import { SettingsButton } from "../../components/settings/SettingsControls";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import { useManagerText } from "./managerI18n";
import {
  managerIamEntityLabel,
  managerIamRolesPoliciesZhMessages,
  managerIamSavedCount,
} from "./managerIamRolesPoliciesMessages";

export type InlinePolicyDraftEditorMode = "idle" | "create" | "edit";

type InlinePolicyDraftEditorProps = {
  drafts: InlinePolicy[];
  selectedDraftName: string | null;
  draftName: string;
  draftText: string;
  entityLabel: string;
  mode: InlinePolicyDraftEditorMode;
  expanded?: boolean;
  onCreateDraft: () => void;
  onSelectDraft: (name: string | null) => void;
  onDraftNameChange: (value: string) => void;
  onDraftTextChange: (value: string) => void;
  onSaveDraft: () => void;
  onRemoveDraft: (name: string) => void;
  onClearDrafts: () => void;
  onInsertTemplate: () => void;
  onToggleExpanded?: () => void;
};

export default function InlinePolicyDraftEditor({
  drafts,
  selectedDraftName,
  draftName,
  draftText,
  entityLabel,
  mode,
  expanded = true,
  onCreateDraft,
  onSelectDraft,
  onDraftNameChange,
  onDraftTextChange,
  onSaveDraft,
  onRemoveDraft,
  onClearDrafts,
  onInsertTemplate,
  onToggleExpanded,
}: InlinePolicyDraftEditorProps) {
  const { locale, t } = useManagerText(managerIamRolesPoliciesZhMessages);
  const contentId = useId();
  const replacementMessageId = `${contentId}-replacement`;
  const hasDrafts = drafts.length > 0;
  const selectedDraft = selectedDraftName ? drafts.find((draft) => draft.name === selectedDraftName) ?? null : null;
  const trimmedName = draftName.trim();
  const replacementTarget = trimmedName
    ? drafts.find((draft) => draft.name === trimmedName && draft.name !== selectedDraftName) ?? null
    : null;
  const actionLabel = mode === "edit" ? t("Update draft") : t("Save draft");
  const showIdleState = mode === "idle" && hasDrafts;
  const showEditor = mode !== "idle" || !hasDrafts;
  const localizedEntityLabel = managerIamEntityLabel(locale, entityLabel);

  return (
    <SettingsSection
      title={t("Inline policies (optional)")}
      description={locale === "zh"
        ? `保存直接嵌入此${localizedEntityLabel}的内联 JSON 策略。`
        : `Save inline JSON policies that embed directly on this ${entityLabel}.`}
      presentation="compact"
    >
      <div className="settings-stack">
        {(hasDrafts || onToggleExpanded) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasDrafts && <span className="settings-description">{managerIamSavedCount(locale, drafts.length)}</span>}
            {onToggleExpanded && (
              <SettingsButton
                variant="secondary"
                onClick={onToggleExpanded}
                aria-label={expanded ? t("Hide inline policies") : t("Show inline policies")}
                aria-expanded={expanded}
                aria-controls={contentId}
              >
                {expanded ? t("Hide") : t("Show")}
              </SettingsButton>
            )}
            {hasDrafts && (
              <>
                <SettingsButton variant="secondary" onClick={onClearDrafts}>{t("Clear all")}</SettingsButton>
                <SettingsButton variant="secondary" onClick={onCreateDraft}>{t("Create new inline policy")}</SettingsButton>
              </>
            )}
          </div>
        )}
        <div id={contentId} hidden={!expanded} className={expanded ? "settings-stack" : undefined}>
          {hasDrafts && (
            <div className="settings-stack">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="settings-label">{t("Saved inline policies")}</h3>
                {showIdleState && <span className="settings-description">{t("Select one to edit or create a new one.")}</span>}
              </div>
              <div className="grid gap-2">
                {drafts.map((draft) => {
                  const isSelected = draft.name === selectedDraft?.name;
                  return (
                    <div key={draft.name} className="flex min-w-0 flex-wrap items-center gap-2">
                      <InlinePolicyChoice policy={draft} selected={isSelected} onSelect={() => onSelectDraft(draft.name)} />
                      <SettingsButton
                        variant="ghost"
                        onClick={() => onRemoveDraft(draft.name)}
                        aria-label={locale === "zh" ? `移除内联策略 ${draft.name}` : `Remove inline policy ${draft.name}`}
                      >
                        {t("Remove")}
                      </SettingsButton>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {showIdleState && (
            <div className="settings-body">
              <p>{t("Select a saved inline policy to edit, or create a new one.")}</p>
              <p className="settings-description mt-1">
                {t("Existing inline policies stay listed above so you can review them before adding another draft.")}
              </p>
            </div>
          )}
          {showEditor && (
            <div className="settings-fields">
              <div>
                <h3 className="settings-label break-words [overflow-wrap:anywhere]">
                  {mode === "edit"
                    ? locale === "zh" ? `正在编辑“${selectedDraftName}”` : `Editing "${selectedDraftName}"`
                    : t("Create a new inline policy")}
                </h3>
                <p className="settings-description mt-1">
                  {mode === "edit"
                    ? locale === "zh"
                      ? `请在创建${localizedEntityLabel}前更新所选草稿。`
                      : `Update the selected draft before creating the ${entityLabel}.`
                    : t("Provide a name and valid JSON to keep this inline policy draft visible in the form.")}
                </p>
              </div>
              {replacementTarget && (
                <div id={replacementMessageId}>
                  <UiInlineMessage tone="warning" className="[overflow-wrap:anywhere]">
                    {locale === "zh"
                      ? `保存此草稿将替换现有草稿“${replacementTarget.name}”。`
                      : `Saving this draft will replace the existing draft "${replacementTarget.name}".`}
                  </UiInlineMessage>
                </div>
              )}
              <UiInput
                label={t("Inline policy name")}
                aria-describedby={replacementTarget ? replacementMessageId : undefined}
                value={draftName}
                onChange={(event) => onDraftNameChange(event.target.value)}
                placeholder="inline-policy"
              />
              <UiTextarea
                label={t("Inline policy document")}
                value={draftText}
                onChange={(event) => onDraftTextChange(event.target.value)}
                className="font-mono"
                rows={8}
                spellCheck={false}
                hint={t("Provide valid JSON. Blank defaults to an empty document.")}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <SettingsButton variant="secondary" onClick={onInsertTemplate}>{t("Insert template")}</SettingsButton>
                {hasDrafts && (
                  <SettingsButton variant="secondary" onClick={() => onSelectDraft(null)}>{t("Cancel")}</SettingsButton>
                )}
                <SettingsButton onClick={onSaveDraft}>{actionLabel}</SettingsButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
