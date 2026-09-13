/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageAdvanced,
} from "../../uiMessages";
import {
  adminRgwAllowManagerBrowserDataAccess,
  adminRgwCancel,
} from "./adminRgwMessages";
import { useI18n } from "../../i18n";
import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import UiButton from "../../components/ui/UiButton";
import UiCheckboxField from "../../components/ui/UiCheckboxField";
import {
  cx,
  uiMutedTextClass,
  uiPanelMutedClass,
  uiTitleTextClass,
} from "../../components/ui/styles";
import { formInlineActionClasses } from "../../components/formInlineActionClasses";

type AdminAssociationAdvancedSettingsProps = {
  targetLabel: string;
  associationKind: "account" | "rgw_user";
  allowManagerBrowserDataAccess: boolean;
  onApply: (allowed: boolean) => void;
};

export default function AdminAssociationAdvancedSettings({
  targetLabel,
  associationKind,
  allowManagerBrowserDataAccess,
  onApply,
}: AdminAssociationAdvancedSettingsProps) {
  const { t } = useI18n();

  const [open, setOpen] = useState(false);
  const [draftAllowed, setDraftAllowed] = useState(allowManagerBrowserDataAccess);

  useEffect(() => {
    if (open) setDraftAllowed(allowManagerBrowserDataAccess);
  }, [allowManagerBrowserDataAccess, open]);

  return (
    <>
      <button type="button" className={formInlineActionClasses} onClick={() => setOpen(true)}>
        {t(messageAdvanced)}</button>
      {open ? (
        <Modal
          title={t({
            en: "Advanced association settings",
            fr: "Paramètres avancés de l’association",
            de: "Erweiterte Zuordnungseinstellungen",
            zh: "高级关联设置",
          })}
          onClose={() => setOpen(false)}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <p className={cx("ui-body font-semibold", uiTitleTextClass)}>{targetLabel}</p>
              <p className={cx("ui-caption", uiMutedTextClass)}>
                {associationKind === "account"
                  ? t({
                    en: "This permission is effective only when this same association also has the Account administrator role.",
                    fr: "Cette autorisation ne s’applique que si cette même association possède aussi le rôle d’administrateur du compte.",
                    de: "Diese Berechtigung gilt nur, wenn dieselbe Zuordnung auch die Rolle des Kontoadministrators hat.",
                    zh: "仅当同一关联也具有账户管理员角色时，此权限才会生效。",
                  })
                  : t({
                    en: "Direct and UI group permissions are aggregated for this RGW user.",
                    fr: "Les autorisations directes et celles des groupes de l’interface sont cumulées pour cet utilisateur RGW.",
                    de: "Direkte Berechtigungen und UI-Gruppenberechtigungen werden für diesen RGW-Benutzer zusammengeführt.",
                    zh: "此 RGW 用户的直接权限和界面用户组权限会合并计算。",
                  })}
              </p>
            </div>
            <UiCheckboxField
              aria-label={t(adminRgwAllowManagerBrowserDataAccess)}
              checked={draftAllowed}
              onChange={(event) => setDraftAllowed(event.target.checked)}
              checkboxClassName="mt-0.5 shrink-0"
              className={cx("w-full items-start gap-3 px-4 py-4", uiPanelMutedClass)}
            >
              <span className="min-w-0 flex-1">
                <span className={cx("block ui-body font-semibold", uiTitleTextClass)}>
                  {t(adminRgwAllowManagerBrowserDataAccess)}</span>
                <span className={cx("mt-0.5 block ui-caption", uiMutedTextClass)}>
                  {t({
                    en: "Disabled by default. This permits data-plane Browser operations from the active Manager context.",
                    fr: "Désactivé par défaut. Autorise les opérations de données de l’explorateur depuis le contexte actif du gestionnaire.",
                    de: "Standardmäßig deaktiviert. Erlaubt Browser-Datenoperationen aus dem aktiven Verwaltungskontext.",
                    zh: "默认禁用。启用后，允许在当前管理控制台上下文中执行浏览器数据操作。",
                  })}</span>
              </span>
            </UiCheckboxField>
            <div className="flex items-center justify-end gap-2">
              <UiButton variant="secondary" onClick={() => setOpen(false)}>
                {t(adminRgwCancel)}</UiButton>
              <UiButton
                onClick={() => {
                  onApply(draftAllowed);
                  setOpen(false);
                }}
              >
                {t({
                  en: "Apply",
                  fr: "Appliquer",
                  de: "Anwenden",
                  zh: "应用",
                })}</UiButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
