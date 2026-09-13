/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useI18n } from "../../i18n";
import { useMemo } from "react";
import FullPageStatus from "../../components/FullPageStatus";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import { readStoredUser, resolvePostLoginPath } from "../../utils/workspaces";

export default function UnauthorizedPage() {
  const { t } = useI18n();
  const { generalSettings } = useGeneralSettings();
  const homePath = useMemo(() => resolvePostLoginPath(readStoredUser(), generalSettings), [generalSettings]);
  const canReturnToWorkspace = homePath !== "/login" && homePath !== "/unauthorized";

  return (
    <FullPageStatus
      title={t({
        en: "Unauthorized access",
        fr: "Accès non autorisé",
        de: "Nicht autorisierter Zugriff",
        zh: "无权访问",
      })}
      description={t({
        en: "Your account does not have the required permissions yet. Please contact an administrator so they can assign a role before you try again.",
        fr: "Votre compte ne dispose pas encore des autorisations nécessaires. Contactez un administrateur pour qu’il vous attribue un rôle avant de réessayer.",
        de: "Ihr Konto verfügt noch nicht über die erforderlichen Berechtigungen. Bitten Sie einen Administrator, Ihnen eine Rolle zuzuweisen, bevor Sie es erneut versuchen.",
        zh: "您的账户尚无所需权限。请联系管理员分配角色后重试。",
      })}
      primaryAction={canReturnToWorkspace ? { label: t({
        en: "Back to workspace",
        fr: "Retour à l’espace de travail",
        de: "Zurück zum Arbeitsbereich",
        zh: "返回工作区",
      }), to: homePath, variant: "primary" } : undefined}
      secondaryAction={{ label: t({
        en: "Switch account",
        fr: "Changer de compte",
        de: "Konto wechseln",
        zh: "切换账户",
      }), to: "/login" }}
    />
  );
}
