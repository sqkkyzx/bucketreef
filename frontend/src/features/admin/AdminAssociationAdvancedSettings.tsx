/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { useState } from "react";
import { createPortal } from "react-dom";
import SettingsDraftDialog from "../../components/settings/SettingsDraftDialog";
import { SettingsItem, SettingsSection, SettingsSwitch } from "../../components/settings/SettingsLayout";
import { ListActionButton } from "../../components/list/ListControls";
import { useI18n } from "../../i18n";
import { rgwMessages } from "./adminRgwMessages";

type Props = {
  targetLabel: string;
  associationKind: "account" | "rgw_user";
  allowManagerBrowserDataAccess: boolean;
  onApply: (allowed: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  disabled?: boolean;
};

export default function AdminAssociationAdvancedSettings({
  targetLabel, associationKind, allowManagerBrowserDataAccess, onApply, onDirtyChange, disabled = false,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <ListActionButton disabled={disabled} onClick={() => setOpen(true)}>{t({ en: "Advanced", zh: "高级设置" })}</ListActionButton>
    {open && createPortal(<SettingsDraftDialog title={t({ en: "Advanced association settings", zh: "高级关联设置" })}
      initialValue={allowManagerBrowserDataAccess} onApply={onApply} onDirtyChange={onDirtyChange} disabled={disabled}
      onClose={() => setOpen(false)} maxWidthClass="max-w-lg">
      {(allowed, setAllowed) => <SettingsSection title={targetLabel} presentation="compact"
        description={associationKind === "account"
          ? t({ en: "This permission is effective only when this same association also has the Account administrator role.", zh: "仅当此关联同时具有账户管理员角色时，此权限才会生效。" })
          : t({ en: "Direct and UI group permissions are aggregated for this RGW user.", zh: "该 RGW 用户的直接权限和界面用户组权限会合并计算。" })}>
        <SettingsItem compact title={t(rgwMessages.allowManagerBrowser)}
          description={t({ en: "Disabled by default. This permits data-plane Browser operations from the active Manager context.", zh: "默认禁用。启用后可从当前管理器上下文执行数据平面浏览器操作。" })}
          action={<SettingsSwitch checked={allowed} onChange={setAllowed} disabled={disabled}
            ariaLabel={t(rgwMessages.allowManagerBrowser)} />} />
      </SettingsSection>}
    </SettingsDraftDialog>, document.body)}
  </>;
}
