/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import UiTextarea from "../../components/ui/UiTextarea";
import { useManagerText } from "./managerI18n";
import { managerIamRolesPoliciesZhMessages } from "./managerIamRolesPoliciesMessages";

type Props = {
  name: string;
  path: string;
  policy: string;
  editing?: boolean;
  onNameChange?: (value: string) => void;
  onPathChange?: (value: string) => void;
  onPolicyChange: (value: string) => void;
  nameError?: string;
  policyError?: string;
};

export default function ManagerRoleFormFields({
  name, path, policy, editing = false, onNameChange, onPathChange, onPolicyChange, nameError, policyError,
}: Props) {
  const { t } = useManagerText(managerIamRolesPoliciesZhMessages);
  return <>
    <SettingsSection title={t("Identity")} presentation="compact">
      <div className="settings-fields md:grid-cols-2">
        <UiInput label={t("Role name")} value={name} required={!editing} readOnly={editing}
          onChange={(event) => onNameChange?.(event.target.value)} placeholder={t("Role name")} error={nameError ? t(nameError) : undefined} />
        <UiInput label={editing ? t("Role path") : t("Role path (optional)")} value={path} readOnly={editing}
          onChange={(event) => onPathChange?.(event.target.value)} placeholder="/application/"
          hint={editing ? t("Path is fixed at creation. Create a new role to use a different path.") : t('Defaults to "/". Sets the IAM path prefix for the role.')} />
      </div>
    </SettingsSection>
    <SettingsSection title={t("Trust policy")} presentation="compact">
      <div className="settings-fields">
        <UiTextarea label={t("Assume role policy (JSON)")} value={policy} onChange={(event) => onPolicyChange(event.target.value)}
          className="font-mono" rows={10} spellCheck={false} error={policyError ? t(policyError) : undefined}
          hint={t("IAM trust policy document used by STS AssumeRole. Provide valid JSON.")} />
      </div>
    </SettingsSection>
  </>;
}
