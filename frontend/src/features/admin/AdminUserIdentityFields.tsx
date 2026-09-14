/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import type { UiRole, UpdateUserPayload } from "../../api/users";
import type { ReactNode } from "react";
import { SettingsButton } from "../../components/settings/SettingsControls";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import { useAdminControlText } from "./adminControlMessages";

type IdentityValues = Pick<UpdateUserPayload, "email" | "full_name" | "role"> & { password?: string };
export type UserIdentityErrors = Partial<Record<"email" | "password", string>>;

// Keep the native email constraint effective when General is not mounted.
export function userIdentityErrors(values: IdentityValues, creating: boolean): UserIdentityErrors {
  const errors: UserIdentityErrors = {};
  const email = document.createElement("input");
  email.type = "email";
  email.value = values.email ?? "";
  if (creating && !values.email) errors.email = "Email is required.";
  else if (!email.checkValidity()) errors.email = "Enter a valid email address.";
  if (creating && !values.password) errors.password = "Password is required.";
  return errors;
}

export default function AdminUserIdentityFields({
  values, creating = false, onChange, onRoleChange, canAssignAdmin, errors,
  helpOpen, onToggleHelp, idPrefix, children,
}: {
  values: IdentityValues;
  creating?: boolean;
  onChange: (patch: Partial<IdentityValues>) => void;
  onRoleChange: (role: UiRole) => void;
  canAssignAdmin: boolean;
  errors: UserIdentityErrors;
  helpOpen: boolean;
  onToggleHelp: () => void;
  idPrefix: string;
  children?: ReactNode;
}) {
  const { t } = useAdminControlText();
  const helpId = `${idPrefix}-role-access-help`;
  return (
    <SettingsSection title={t("Identity")} presentation="compact">
      <div className="settings-fields">
        <UiInput id={`${idPrefix}-email`} label={t("Email")} type="email" required={creating}
          value={values.email ?? ""} onChange={(event) => onChange({ email: event.target.value })}
          autoComplete="off" placeholder={creating ? "jane.doe@example.com" : undefined} error={errors.email ? t(errors.email) : undefined} />
        {creating && <UiInput id={`${idPrefix}-password`} label={t("Password")} type="password" required
          value={values.password ?? ""} onChange={(event) => onChange({ password: event.target.value })}
          autoComplete="new-password" error={errors.password ? t(errors.password) : undefined} />}
        <UiInput label={t("Full name")} value={values.full_name ?? ""}
          onChange={(event) => onChange({ full_name: event.target.value })} placeholder={t("Jane Doe")} />
        <UiSelect label={t("Role")} value={values.role ?? "ui_user"} onChange={(event) => onRoleChange(event.target.value as UiRole)}>
          <option value="ui_none">{t("No access")}</option>
          <option value="ui_user">{t("User")}</option>
          <option value="ui_admin" disabled={!canAssignAdmin}>{t("Admin")}{canAssignAdmin ? "" : t(" (restricted)")}</option>
          <option value="ui_superadmin" disabled={!canAssignAdmin}>{t("Superadmin")}{canAssignAdmin ? "" : t(" (restricted)")}</option>
        </UiSelect>
        <div>
          <SettingsButton variant="secondary" aria-label={t("Explain role access levels")}
            aria-expanded={helpOpen} aria-controls={helpId} onClick={onToggleHelp}>
            {t("About roles")}
          </SettingsButton>
          {helpOpen && <div id={helpId} className="mt-2 settings-stack">
            <p className="settings-label">{t("Role access summary")}</p>
            <dl className="settings-stack">
              {[
                ["No Access", "No workspace access (profile only)"],
                ["User", "Non-admin workspaces only"],
                ["Admin", "User access + /admin"],
                ["Superadmin", "Admin access + /admin settings"],
              ].map(([role, access]) => <div key={role} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="settings-label">{t(role)}</dt><dd className="settings-readonly">{t(access)}</dd>
              </div>)}
            </dl>
            <p className="settings-description">{t("Ceph Admin and Storage Ops also require dedicated access flags.")}</p>
          </div>}
        </div>
      </div>
      {children}
    </SettingsSection>
  );
}
