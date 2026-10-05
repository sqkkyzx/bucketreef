/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { completeOidcLogin } from "../../api/auth";
import { fetchGeneralSettings } from "../../api/appSettings";
import { getWorkspaceAccess } from "../../api/executionContexts";
import { DEFAULT_GENERAL_SETTINGS, useGeneralSettings } from "../../components/GeneralSettingsContext";
import BrandMark from "../../components/BrandMark";
import { useLanguage } from "../../components/language";
import { useTheme } from "../../components/theme";
import ErrorState from "../../components/errors/ErrorState";
import { PRODUCT_NAME } from "../../constants/product";
import { useSession } from "../../auth/SessionProvider";
import { coordinateOidcCallback } from "./oidcCallbackCoordinator";
import { prefetchWorkspaceBranch } from "../../utils/routePrefetch";
import {
  resolvePostLoginPath,
  resolvePostLoginPathWithWorkspaceAccess,
  type SessionUser,
} from "../../utils/workspaces";
import { AuthCard, AuthCenteredPage } from "./AuthSurface";
import { useI18n } from "../../i18n";

export default function OidcCallbackPage() {
  const { t } = useI18n();
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { runtimeSurfaces, setGeneralSettings } = useGeneralSettings();
  const { setLanguagePreference } = useLanguage();
  const { setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const { acceptAuthentication } = useSession();

  useEffect(() => {
    let cancelled = false;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!provider) {
      setProcessing(false);
      setError(t({ en: "Missing identity provider.", fr: "Fournisseur d'identité manquant.", de: "Identitätsanbieter fehlt.", zh: "缺少身份提供方。" }));
      return;
    }
    const providerId = provider;
    if (!code || !state) {
      setProcessing(false);
      setError(t({ en: "Incomplete authentication response.", fr: "Réponse d'authentification incomplète.", de: "Unvollständige Authentifizierungsantwort.", zh: "认证响应不完整。" }));
      return;
    }
    const codeValue = code;
    const stateValue = state;

    async function finalizeLogin() {
      try {
        const res = await coordinateOidcCallback(
          providerId,
          codeValue,
          stateValue,
          completeOidcLogin,
        );
        if (cancelled) return;
        if (res.status === "mfa_required" || res.status === "mfa_enrollment_required") {
          navigate(`/login?mfa=${res.status}`, { replace: true });
          return;
        }
        if (res.status === "link_approval_required") {
          setError(t({ en: "This identity must be approved by a superadministrator before it can be linked.", fr: "Cette identité doit être approuvée par un super-administrateur avant d'être liée.", de: "Diese Identität muss vor der Verknüpfung von einem Superadministrator genehmigt werden.", zh: "此身份必须先由超级管理员批准，才能完成关联。" }));
          setProcessing(false);
          return;
        }
        if (!res.user) throw new Error(t({ en: "OIDC session did not return a user", fr: "La session OIDC n'a pas renvoyé d'utilisateur", de: "Die OIDC-Sitzung hat keinen Benutzer zurückgegeben", zh: "OIDC 会话未返回用户" }));
        acceptAuthentication(res, "oidc");
        const sessionUser: SessionUser = { ...res.user, authType: "oidc" };
        setLanguagePreference(res.user.ui_language ?? "auto");
        if (res.user.ui_preferences?.theme === "light" || res.user.ui_preferences?.theme === "dark") {
          setTheme(res.user.ui_preferences.theme);
        }
        let settings = DEFAULT_GENERAL_SETTINGS;
        try {
          settings = await fetchGeneralSettings();
          setGeneralSettings(settings);
        } catch (loadError) {
          console.error(loadError);
        }
        let baseDestination = resolvePostLoginPath(sessionUser, settings, runtimeSurfaces);
        try {
          const workspaceAccess = await getWorkspaceAccess();
          baseDestination = resolvePostLoginPathWithWorkspaceAccess(
            sessionUser,
            settings,
            workspaceAccess,
            runtimeSurfaces,
          );
        } catch (workspaceError) {
          console.error(workspaceError);
        }
        const destination = baseDestination;
        prefetchWorkspaceBranch(destination);
        navigate(destination, { replace: true });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(t({ en: "Unable to complete the sign-in. Please try again.", fr: "Impossible de terminer la connexion. Réessayez.", de: "Anmeldung konnte nicht abgeschlossen werden. Bitte erneut versuchen.", zh: "无法完成登录，请重试。" }));
          setProcessing(false);
        }
      }
    }

    finalizeLogin();
    return () => {
      cancelled = true;
    };
  }, [acceptAuthentication, navigate, provider, runtimeSurfaces, searchParams, setGeneralSettings, setLanguagePreference, setTheme, t]);

  if (error) return <ErrorState kind="auth_failed" description={error} presentation="full" />;

  return (
    <AuthCenteredPage>
      <AuthCard className="max-w-md p-8 text-center">
          <BrandMark alt={PRODUCT_NAME} className="mx-auto mb-5 h-16 w-16" />
          <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t({ en: "Signing you in", fr: "Connexion", de: "Anmeldung", zh: "正在登录" })}</h1>
          {processing && <p className="ui-body text-slate-500">{t({ en: "Please wait...", fr: "Veuillez patienter…", de: "Bitte warten…", zh: "请稍候…" })}</p>}
      </AuthCard>
    </AuthCenteredPage>
  );
}
