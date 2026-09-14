/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import type { InlinePolicy } from "../../api/managerIamPolicies";
import { SettingsButton } from "../../components/settings/SettingsControls";
import UiBadge from "../../components/ui/UiBadge";
import { summarizeInlinePolicyDocument } from "./inlinePolicySummary";
import { useManagerText } from "./managerI18n";
import { managerIamRolesPoliciesZhMessages } from "./managerIamRolesPoliciesMessages";

/** Shared identity and selected state for saved drafts and persisted policies. */
export default function InlinePolicyChoice({ policy, selected, disabled, onSelect }: {
  policy: InlinePolicy;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const { locale, t } = useManagerText(managerIamRolesPoliciesZhMessages);
  return (
    <SettingsButton variant={selected ? "secondary" : "ghost"} onClick={onSelect}
      disabled={disabled} aria-pressed={selected} className="min-w-0 flex-1 flex-wrap text-left sm:flex-nowrap">
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <span className="settings-label block [overflow-wrap:anywhere]">{policy.name}</span>
        <span className="settings-description block">{summarizeInlinePolicyDocument(policy.document, locale)}</span>
      </span>
      <UiBadge tone={selected ? "primary" : "neutral"}>{selected ? t("Selected") : t("Edit")}</UiBadge>
    </SettingsButton>
  );
}
