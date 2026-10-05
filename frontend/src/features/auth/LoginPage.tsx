/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchLdapProviders,
  fetchOidcProviders,
  beginWebAuthnAuthentication,
  beginWebAuthnRegistration,
  finishWebAuthnAuthentication,
  finishWebAuthnRegistration,
  login,
  loginWithKeys,
  loginWithLdap,
  startOidcLogin,
  verifyRecoveryCode,
  type AuthenticationResponse,
  type LDAPProviderInfo,
  type OidcProviderInfo,
} from "../../api/auth";
import { fetchGeneralSettings, fetchLoginSettings, type GeneralSettings, type LoginSettings } from "../../api/appSettings";
import { getWorkspaceAccess } from "../../api/executionContexts";
import { DEFAULT_GENERAL_SETTINGS, useGeneralSettings } from "../../components/GeneralSettingsContext";
import BrandMark from "../../components/BrandMark";
import AppVersion from "../../components/AppVersion";
import { useLanguage } from "../../components/language";
import { useTheme } from "../../components/theme";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import { PRODUCT_NAME, PRODUCT_SUBTITLE } from "../../constants/product";
import { CLIENT_STORAGE_KEYS, removeClientStorage, writeClientStorage } from "../../utils/clientStorage";
import { classifyApiError } from "../../utils/apiError";
import { useSession } from "../../auth/SessionProvider";
import { authenticatePasskey, createPasskey } from "../../auth/webauthn";
import { prefetchWorkspaceBranch } from "../../utils/routePrefetch";
import {
  resolvePostLoginPath,
  resolvePostLoginPathWithWorkspaceAccess,
  type SessionUser,
} from "../../utils/workspaces";
import { AuthButton, AuthInput, AuthPasswordInput, AuthSelect } from "./AuthFormControls";
import { AuthBrandBackdrop, AuthCard, AuthCenteredPage } from "./AuthSurface";
import { useI18n } from "../../i18n";

type LoginMode = "password" | "keys" | "ldap";

function passwordLoginErrorMessage(error: unknown, t: ReturnType<typeof useI18n>["t"]): string {
  const failure = classifyApiError(error, "Unable to sign in. Try again.");
  if (failure.status === 401) {
    return t({ en: "Invalid email or password.", fr: "Adresse e-mail ou mot de passe invalide.", de: "Ungültige E-Mail-Adresse oder ungültiges Passwort.", zh: "邮箱或密码无效。" });
  }
  if (failure.status === 429) {
    return t({ en: "Too many sign-in attempts. Try again later.", fr: "Trop de tentatives de connexion. Réessayez plus tard.", de: "Zu viele Anmeldeversuche. Bitte später erneut versuchen.", zh: "登录尝试次数过多，请稍后重试。" });
  }
  if (
    failure.kind === "timeout" ||
    failure.kind === "unavailable" ||
    failure.kind === "invalid_response"
  ) {
    return t({ en: "Unable to reach BucketReef. Check your connection and try again.", fr: "Impossible de joindre BucketReef. Vérifiez votre connexion et réessayez.", de: "BucketReef ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.", zh: "无法连接到 BucketReef，请检查网络连接后重试。" });
  }
  return t({ en: "Unable to sign in. Try again.", fr: "Impossible de se connecter. Réessayez.", de: "Anmeldung nicht möglich. Bitte erneut versuchen.", zh: "无法登录，请重试。" });
}

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { runtimeSurfaces, setGeneralSettings } = useGeneralSettings();
  const { setLanguagePreference } = useLanguage();
  const { setTheme } = useTheme();
  const { acceptAuthentication } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ldapUsername, setLdapUsername] = useState("");
  const [ldapPassword, setLdapPassword] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
  const [error, setError] = useState<string | null>(null);
  const [oidcError, setOidcError] = useState<string | null>(null);
  const [ldapError, setLdapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState<string | null>(null);
  const [oidcProviders, setOidcProviders] = useState<OidcProviderInfo[]>([]);
  const [ldapProviders, setLdapProviders] = useState<LDAPProviderInfo[]>([]);
  const [selectedLdapProvider, setSelectedLdapProvider] = useState("");
  const [loginSettings, setLoginSettings] = useState<LoginSettings | null>(null);
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [endpointLoading, setEndpointLoading] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [loginBrandingLogoFailed, setLoginBrandingLogoFailed] = useState(false);
  const [mfaStage, setMfaStage] = useState<"mfa_required" | "mfa_enrollment_required" | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("mfa");
    return value === "mfa_required" || value === "mfa_enrollment_required" ? value : null;
  });
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingEnrollment, setPendingEnrollment] = useState<AuthenticationResponse | null>(null);
  const loadGeneralSettings = async (): Promise<GeneralSettings> => {
    try {
      const settings = await fetchGeneralSettings();
      setGeneralSettings(settings);
      return settings;
    } catch (err) {
      console.error(err);
      return DEFAULT_GENERAL_SETTINGS;
    }
  };

  const resolveInteractiveDestination = async (
    sessionUser: SessionUser,
    settings: GeneralSettings
  ): Promise<string> => {
    try {
      const workspaceAccess = await getWorkspaceAccess();
      return resolvePostLoginPathWithWorkspaceAccess(
        sessionUser,
        settings,
        workspaceAccess,
        runtimeSurfaces,
      );
    } catch (workspaceError) {
      console.error(workspaceError);
      return resolvePostLoginPath(sessionUser, settings, runtimeSurfaces);
    }
  };

  const finishLogin = async (res: AuthenticationResponse, authType: SessionUser["authType"]) => {
    if (res.status === "mfa_required" || res.status === "mfa_enrollment_required") {
      setMfaStage(res.status);
      return;
    }
    if (res.status !== "authenticated") {
      throw new Error(t({ en: "Authentication requires administrator approval", fr: "L'authentification nécessite l'approbation d'un administrateur", de: "Die Authentifizierung erfordert die Genehmigung eines Administrators", zh: "认证需要管理员批准" }));
    }
    acceptAuthentication(res, authType);
    const sessionUser: SessionUser = res.user
      ? { ...res.user, authType }
      : {
          email: res.session?.account_id ? `${res.session.account_id}@s3-session` : "s3-session",
          role: "ui_user",
          authType: "s3_session",
          actorType: res.session?.actor_type,
          accountId: res.session?.account_id ?? null,
          accountName: res.session?.account_name ?? null,
          capabilities: res.session?.capabilities,
        };
    if (res.user) {
      setLanguagePreference(res.user.ui_language ?? "auto");
      if (res.user.ui_preferences?.theme === "light" || res.user.ui_preferences?.theme === "dark") {
        setTheme(res.user.ui_preferences.theme);
      }
    } else {
      setLanguagePreference("auto");
    }
    const appSettings = await loadGeneralSettings();
    const destination = await resolveInteractiveDestination(sessionUser, appSettings);
    prefetchWorkspaceBranch(destination);
    navigate(destination, { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    fetchOidcProviders()
      .then((providers) => {
        if (isMounted) {
          setOidcProviders(providers);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOidcError(t({ en: "Unable to load identity providers", fr: "Impossible de charger les fournisseurs d'identité", de: "Identitätsanbieter konnten nicht geladen werden", zh: "无法加载身份提供方" }));
        }
      });
    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    fetchLdapProviders()
      .then((providers) => {
        if (isMounted) {
          setLdapProviders(providers);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLdapError(t({ en: "Unable to load directory providers", fr: "Impossible de charger les fournisseurs d'annuaire", de: "Verzeichnisanbieter konnten nicht geladen werden", zh: "无法加载目录服务提供方" }));
        }
      });
    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    setEndpointLoading(true);
    fetchLoginSettings()
      .then((settings) => {
        if (isMounted) {
          setLoginSettings(settings);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEndpointError(t({ en: "Unable to load endpoint options", fr: "Impossible de charger les options de point de terminaison", de: "Endpunktoptionen konnten nicht geladen werden", zh: "无法加载端点选项" }));
        }
      })
      .finally(() => {
        if (isMounted) {
          setEndpointLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!loginSettings) return;
    if (selectedEndpoint || customEndpoint) return;
    const defaultEndpoint = loginSettings.endpoints.find((endpoint) => endpoint.is_default);
    if (defaultEndpoint) {
      setSelectedEndpoint(defaultEndpoint.endpoint_url);
    }
  }, [loginSettings, selectedEndpoint, customEndpoint]);

  useEffect(() => {
    if (selectedLdapProvider || ldapProviders.length === 0) return;
    setSelectedLdapProvider(ldapProviders[0].id);
  }, [ldapProviders, selectedLdapProvider]);

  useEffect(() => {
    setLoginBrandingLogoFailed(false);
  }, [loginSettings?.login_logo_url]);

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      await finishLogin(res, "password");
    } catch (err) {
      console.error(err);
      setError(passwordLoginErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleLdapLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLdapError(null);
    const providerId = selectedLdapProvider || ldapProviders[0]?.id || "";
    if (!providerId) {
      setError(t({ en: "No directory provider is available", fr: "Aucun fournisseur d'annuaire disponible", de: "Kein Verzeichnisanbieter verfügbar", zh: "没有可用的目录服务提供方" }));
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithLdap(providerId, ldapUsername.trim(), ldapPassword);
      await finishLogin(res, "ldap");
    } catch (err) {
      console.error(err);
      setError(t({ en: "Unable to authenticate with this directory account", fr: "Impossible d'authentifier ce compte d'annuaire", de: "Dieses Verzeichniskonto konnte nicht authentifiziert werden", zh: "无法使用此目录账户认证" }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedCustom = customEndpoint.trim().replace(/\/+$/, "");
      const normalizedSelected = selectedEndpoint.trim().replace(/\/+$/, "");
      const normalizedDefault =
        loginSettings?.default_endpoint_url?.trim().replace(/\/+$/, "") ?? "";
      const shouldSendEndpoint = allowEndpointList || allowCustomEndpoint;
      const endpointUrl = shouldSendEndpoint
        ? normalizedCustom || normalizedSelected || normalizedDefault || undefined
        : undefined;
      const res = await loginWithKeys(accessKey.trim(), secretKey.trim(), endpointUrl);
      if (endpointUrl) {
        writeClientStorage(CLIENT_STORAGE_KEYS.s3SessionEndpoint, endpointUrl);
      } else {
        removeClientStorage(CLIENT_STORAGE_KEYS.s3SessionEndpoint);
      }
      await finishLogin(res, "s3_session");
    } catch (err) {
      console.error(err);
      setError(t({ en: "Unable to authenticate with these access keys", fr: "Impossible d'authentifier avec ces clés d'accès", de: "Authentifizierung mit diesen Zugriffsschlüsseln nicht möglich", zh: "无法使用这些访问密钥认证" }));
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (next: LoginMode) => {
    setMode(next);
    setError(null);
  };

  const startOidcFlow = async (providerId: string) => {
    setOidcError(null);
    setOidcLoading(providerId);
    try {
      const { authorization_url } = await startOidcLogin(providerId);
      window.location.href = authorization_url;
    } catch (err) {
      console.error(err);
      setOidcError(t({ en: "Unable to start external authentication", fr: "Impossible de démarrer l'authentification externe", de: "Externe Authentifizierung konnte nicht gestartet werden", zh: "无法启动外部认证" }));
      setOidcLoading(null);
    }
  };

  const completePasskey = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = mfaStage === "mfa_enrollment_required"
        ? await (async () => {
            const options = await beginWebAuthnRegistration();
            const credential = await createPasskey(options);
            return finishWebAuthnRegistration(credential);
          })()
        : await (async () => {
            const options = await beginWebAuthnAuthentication();
            const credential = await authenticatePasskey(options);
            return finishWebAuthnAuthentication(credential);
          })();
      if (res.recovery_codes?.length) {
        setRecoveryCodes(res.recovery_codes);
        setPendingEnrollment(res);
        return;
      }
      await finishLogin(res, "password");
    } catch (err) {
      console.error(err);
      setError(t({ en: "Passkey verification failed. Please try again.", fr: "Échec de la vérification par clé d'accès. Réessayez.", de: "Passkey-Verifizierung fehlgeschlagen. Bitte erneut versuchen.", zh: "通行密钥验证失败，请重试。" }));
    } finally {
      setLoading(false);
    }
  };

  const completeRecovery = async () => {
    setError(null);
    setLoading(true);
    try {
      await finishLogin(await verifyRecoveryCode(recoveryCode), "password");
    } catch (err) {
      console.error(err);
      setError(t({ en: "The recovery code is invalid or has already been used.", fr: "Le code de récupération est invalide ou a déjà été utilisé.", de: "Der Wiederherstellungscode ist ungültig oder wurde bereits verwendet.", zh: "恢复码无效或已被使用。" }));
    } finally {
      setLoading(false);
    }
  };

  const tabClasses = (value: LoginMode) =>
    `min-w-0 rounded-lg px-2 py-2 ui-body font-semibold leading-tight transition ${
      mode === value
        ? "bg-white text-slate-900 shadow-sm ring-1 ring-primary-200"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    }`;

  const allowAccessKeys = loginSettings?.allow_login_access_keys ?? false;
  const allowEndpointList = Boolean(loginSettings?.allow_login_endpoint_list);
  const allowCustomEndpoint = Boolean(loginSettings?.allow_login_custom_endpoint);
  const endpointOptions = loginSettings?.endpoints ?? [];
  const hasLdapProviders = ldapProviders.length > 0;
  const loginModes: Array<{ value: LoginMode; label: string }> = [
    { value: "password", label: t({ en: "Email & password", fr: "E-mail et mot de passe", de: "E-Mail und Passwort", zh: "邮箱和密码" }) },
    ...(hasLdapProviders ? [{ value: "ldap" as const, label: t({ en: "Directory", fr: "Annuaire", de: "Verzeichnis", zh: "目录服务" }) }] : []),
    ...(allowAccessKeys ? [{ value: "keys" as const, label: t({ en: "S3 access keys", fr: "Clés d'accès S3", de: "S3-Zugriffsschlüssel", zh: "S3 访问密钥" }) }] : []),
  ];
  const loginBrandingLogoUrl = loginSettings?.login_logo_url ?? null;
  const shouldShowLeftLogo = Boolean(loginBrandingLogoUrl && !loginBrandingLogoFailed);
  useEffect(() => {
    if (!allowAccessKeys && mode === "keys") {
      setMode("password");
    }
    if (!hasLdapProviders && mode === "ldap") {
      setMode("password");
    }
  }, [allowAccessKeys, hasLdapProviders, mode]);

  if (mfaStage) {
    return (
      <AuthCenteredPage>
        <AuthCard className="max-w-md p-8">
          <BrandMark alt={PRODUCT_NAME} className="mb-5 h-16 w-16" />
          <h1 className="text-2xl font-semibold">
            {mfaStage === "mfa_enrollment_required"
              ? t({ en: "Create your administrator passkey", fr: "Créer votre clé d'accès administrateur", de: "Administrator-Passkey erstellen", zh: "创建管理员通行密钥" })
              : t({ en: "Verify your passkey", fr: "Vérifier votre clé d'accès", de: "Passkey verifizieren", zh: "验证通行密钥" })}
          </h1>
          <p className="mt-3 ui-body text-slate-600">
            {t({ en: "Administrator access requires user verification with a passkey bound to this site.", fr: "L'accès administrateur nécessite une vérification avec une clé d'accès liée à ce site.", de: "Der Administratorzugriff erfordert eine Benutzerprüfung mit einem an diese Website gebundenen Passkey.", zh: "管理员访问需要使用绑定到本站的通行密钥验证身份。" })}
          </p>
          {error && <div className="mt-4"><UiInlineMessage tone="error">{error}</UiInlineMessage></div>}
          {!pendingEnrollment && (
            <AuthButton type="button" className="mt-6" disabled={loading} onClick={() => void completePasskey()}>
              {mfaStage === "mfa_enrollment_required" ? t({ en: "Create passkey", fr: "Créer une clé d'accès", de: "Passkey erstellen", zh: "创建通行密钥" }) : t({ en: "Use passkey", fr: "Utiliser la clé d'accès", de: "Passkey verwenden", zh: "使用通行密钥" })}
            </AuthButton>
          )}
          {mfaStage === "mfa_required" && !pendingEnrollment && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <AuthInput
                id="recovery-code"
                label={t({ en: "Recovery code", fr: "Code de récupération", de: "Wiederherstellungscode", zh: "恢复码" })}
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                autoComplete="one-time-code"
              />
              <button type="button" className="mt-3 ui-body font-semibold text-primary-700" disabled={loading || !recoveryCode.trim()} onClick={() => void completeRecovery()}>
                {t({ en: "Use recovery code", fr: "Utiliser le code de récupération", de: "Wiederherstellungscode verwenden", zh: "使用恢复码" })}
              </button>
            </div>
          )}
          {recoveryCodes.length > 0 && (
            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-950">
              <p className="font-semibold">{t({ en: "Save these one-time recovery codes now.", fr: "Enregistrez maintenant ces codes de récupération à usage unique.", de: "Speichern Sie diese einmaligen Wiederherstellungscodes jetzt.", zh: "请立即保存这些一次性恢复码。" })}</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
                {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
              </ul>
              <AuthButton
                type="button"
                className="mt-5"
                disabled={loading || !pendingEnrollment}
                onClick={() => pendingEnrollment && void finishLogin(pendingEnrollment, "password")}
              >
                {t({ en: "I saved these recovery codes", fr: "J'ai enregistré ces codes de récupération", de: "Ich habe diese Wiederherstellungscodes gespeichert", zh: "我已保存这些恢复码" })}
              </AuthButton>
            </div>
          )}
        </AuthCard>
      </AuthCenteredPage>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <AuthBrandBackdrop radial />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden rounded-3xl border border-slate-700/50 bg-slate-900/55 p-8 shadow-2xl backdrop-blur lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/70 px-3 py-1 ui-caption font-semibold uppercase tracking-wide text-slate-300">
                <BrandMark className="h-7 w-7" />
                {PRODUCT_NAME}
              </div>
              <h1 className="mt-6 max-w-md text-3xl font-semibold leading-tight text-white">{t({ en: PRODUCT_SUBTITLE, fr: "Gestion du stockage objet compatible S3", de: "Verwaltung von S3-kompatiblem Objektspeicher", zh: "兼容 S3 的对象存储管理" })}</h1>
              <p className="mt-3 max-w-md ui-body text-slate-300">
                {t({ en: "Sign in to reach the workspace that matches your role and execution context.", fr: "Connectez-vous pour accéder à l'espace correspondant à votre rôle et à votre contexte d'exécution.", de: "Melden Sie sich an, um den für Ihre Rolle und Ihren Ausführungskontext passenden Arbeitsbereich zu öffnen.", zh: "登录以进入与您的角色和执行上下文对应的工作区。" })}
              </p>
            </div>
            {shouldShowLeftLogo ? (
              <div className="flex h-full items-end">
                <div className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-5">
                  <img
                    src={loginBrandingLogoUrl ?? ""}
                    alt={t({ en: "Company logo", fr: "Logo de l'entreprise", de: "Firmenlogo", zh: "公司标志" })}
                    className="mx-auto max-h-28 w-auto object-contain"
                    onError={() => setLoginBrandingLogoFailed(true)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                  <p className="ui-caption font-semibold uppercase tracking-wide text-slate-400">{t({ en: "After sign-in", fr: "Après la connexion", de: "Nach der Anmeldung", zh: "登录后" })}</p>
                  <p className="mt-1 ui-body text-slate-200">
                    {t({ en: "Password sign-in opens your assigned UI workspaces. Access keys create an S3 session when that mode is enabled.", fr: "La connexion par mot de passe ouvre vos espaces UI assignés. Les clés d'accès créent une session S3 lorsque ce mode est activé.", de: "Die Anmeldung mit Passwort öffnet Ihre zugewiesenen UI-Arbeitsbereiche. Zugriffsschlüssel erstellen eine S3-Sitzung, wenn dieser Modus aktiviert ist.", zh: "密码登录会打开分配给您的工作区。启用密钥登录后，访问密钥可用于创建 S3 会话。" })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                  <p className="ui-caption font-semibold uppercase tracking-wide text-slate-400">{t({ en: "Need help?", fr: "Besoin d'aide ?", de: "Brauchen Sie Hilfe?", zh: "需要帮助？" })}</p>
                  <p className="mt-1 ui-body text-slate-200">
                    {t({ en: "Contact your platform admin if you don't know which sign-in method or endpoint to use.", fr: "Contactez votre administrateur de plateforme si vous ne savez pas quelle méthode de connexion ou quel point de terminaison utiliser.", de: "Wenden Sie sich an den Plattformadministrator, wenn Sie nicht wissen, welche Anmeldemethode oder welchen Endpunkt Sie verwenden sollen.", zh: "如果不确定该使用哪种登录方式或端点，请联系平台管理员。" })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                  <p className="ui-caption font-semibold uppercase tracking-wide text-slate-400">{t({ en: "Security note", fr: "Note de sécurité", de: "Sicherheitshinweis", zh: "安全提示" })}</p>
                  <p className="mt-1 ui-body text-slate-200">
                    {t({ en: "Never share your password, secret key, or session token.", fr: "Ne partagez jamais votre mot de passe, votre clé secrète ou votre jeton de session.", de: "Geben Sie Ihr Passwort, Ihren geheimen Schlüssel oder Sitzungstoken niemals weiter.", zh: "切勿分享密码、秘密密钥或会话令牌。" })}
                  </p>
                </div>
              </div>
            )}
          </section>

          <div className="flex min-w-0 flex-col">
            <AuthCard className="flex-1 p-6 sm:p-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 ui-caption font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                <BrandMark className="h-7 w-7" />
                {PRODUCT_NAME}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">{t({ en: "Sign in", fr: "Se connecter", de: "Anmelden", zh: "登录" })}</h2>
              <p className="mt-1 ui-body text-slate-500">{t({ en: "Use your account credentials.", fr: "Utilisez les identifiants de votre compte.", de: "Verwenden Sie Ihre Kontodaten.", zh: "使用您的账户凭据登录。" })}</p>
            </div>

            {loginModes.length > 1 && (
              <div
                className="mb-6 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5 ui-body font-semibold text-slate-600"
                style={{ gridTemplateColumns: `repeat(${loginModes.length}, minmax(0, 1fr))` }}
              >
                {loginModes.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={tabClasses(item.value)}
                    onClick={() => handleModeChange(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {mode === "ldap" && hasLdapProviders ? (
              <form onSubmit={handleLdapLogin} className="space-y-4">
                {ldapProviders.length > 1 && (
                  <AuthSelect
                    id="ldap-provider"
                    label={t({ en: "Directory", fr: "Annuaire", de: "Verzeichnis", zh: "目录服务" })}
                    value={selectedLdapProvider || ldapProviders[0]?.id || ""}
                    onChange={(e) => setSelectedLdapProvider(e.target.value)}
                    required
                  >
                    {ldapProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.display_name}
                      </option>
                    ))}
                  </AuthSelect>
                )}
                <AuthInput id="ldap-username" label={t({ en: "Username", fr: "Nom d'utilisateur", de: "Benutzername", zh: "用户名" })} type="text" autoComplete="username" value={ldapUsername} onChange={(e) => setLdapUsername(e.target.value)} placeholder={t({ en: "jane.doe or jane@example.com", fr: "jane.doe ou jane@example.com", de: "jane.doe oder jane@example.com", zh: "jane.doe 或 jane@example.com" })} required />
                <AuthPasswordInput id="ldap-password" label={t({ en: "Password", fr: "Mot de passe", de: "Passwort", zh: "密码" })} autoComplete="current-password" value={ldapPassword} onChange={(e) => setLdapPassword(e.target.value)} required />
                {(error || ldapError) && (
                  <UiInlineMessage tone="error">{error || ldapError}</UiInlineMessage>
                )}
                <AuthButton type="submit" disabled={loading}>
                  {loading ? t({ en: "Signing in...", fr: "Connexion…", de: "Anmeldung…", zh: "正在登录…" }) : t({ en: "Sign in with directory", fr: "Se connecter avec l'annuaire", de: "Mit Verzeichnis anmelden", zh: "通过目录服务登录" })}
                </AuthButton>
              </form>
            ) : mode === "password" || !allowAccessKeys ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <AuthInput id="login-email" label={t({ en: "Email", fr: "E-mail", de: "E-Mail", zh: "邮箱" })} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <AuthPasswordInput id="login-password" label={t({ en: "Password", fr: "Mot de passe", de: "Passwort", zh: "密码" })} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                {error && (
                  <UiInlineMessage tone="error" role="alert">{error}</UiInlineMessage>
                )}
                <AuthButton type="submit" disabled={loading}>
                  {loading ? t({ en: "Signing in...", fr: "Connexion…", de: "Anmeldung…", zh: "正在登录…" }) : t({ en: "Sign in", fr: "Se connecter", de: "Anmelden", zh: "登录" })}
                </AuthButton>
              </form>
            ) : (
              <form onSubmit={handleKeyLogin} className="space-y-4">
                <AuthInput id="login-access-key" label={t({ en: "Access key", fr: "Clé d'accès", de: "Zugriffsschlüssel", zh: "访问密钥" })} type="text" autoComplete="username" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="ACCESS_KEY" required />
                <AuthPasswordInput id="login-secret-key" label={t({ en: "Secret key", fr: "Clé secrète", de: "Geheimer Schlüssel", zh: "秘密密钥" })} secretLabel={t({ en: "secret key", fr: "clé secrète", de: "geheimer Schlüssel", zh: "秘密密钥" })} autoComplete="current-password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} required />
                {(allowEndpointList || allowCustomEndpoint) && (
                  <div className="space-y-3">
                    {allowEndpointList && (
                      <div>
                        <AuthSelect id="login-endpoint" label={t({ en: "Endpoint", fr: "Point de terminaison", de: "Endpunkt", zh: "端点" })} value={selectedEndpoint} onChange={(e) => setSelectedEndpoint(e.target.value)} disabled={endpointLoading}>
                          {endpointLoading && <option value="">{t({ en: "Loading endpoints...", fr: "Chargement des points de terminaison…", de: "Endpunkte werden geladen…", zh: "正在加载端点…" })}</option>}
                          {!endpointLoading && <option value="">{t({ en: "Select endpoint", fr: "Sélectionner un point de terminaison", de: "Endpunkt auswählen", zh: "选择端点" })}</option>}
                          {!endpointLoading &&
                            endpointOptions.map((endpoint) => (
                              <option key={endpoint.id} value={endpoint.endpoint_url} title={endpoint.endpoint_url}>
                                {endpoint.is_default ? t({ en: `${endpoint.name} (default)`, fr: `${endpoint.name} (par défaut)`, de: `${endpoint.name} (Standard)`, zh: `${endpoint.name}（默认）` }) : endpoint.name}
                              </option>
                            ))}
                        </AuthSelect>
                        {!endpointLoading && endpointOptions.length === 0 && (
                          <p className="mt-1 ui-caption text-slate-500">
                            {allowCustomEndpoint
                              ? t({ en: "No endpoint configured. Use a custom endpoint URL.", fr: "Aucun point de terminaison configuré. Utilisez une URL personnalisée.", de: "Kein Endpunkt konfiguriert. Verwenden Sie eine benutzerdefinierte URL.", zh: "尚未配置端点，请使用自定义端点 URL。" })
                              : t({ en: "No endpoint configured. Ask an admin to add one.", fr: "Aucun point de terminaison configuré. Demandez à un administrateur d'en ajouter un.", de: "Kein Endpunkt konfiguriert. Bitten Sie einen Administrator, einen hinzuzufügen.", zh: "尚未配置端点，请联系管理员添加。" })}
                          </p>
                        )}
                      </div>
                    )}
                    {allowCustomEndpoint && (
                      <div>
                        <AuthInput id="login-custom-endpoint" label={t({ en: "Custom endpoint URL (optional)", fr: "URL de point de terminaison personnalisée (facultatif)", de: "Benutzerdefinierte Endpunkt-URL (optional)", zh: "自定义端点 URL（可选）" })} type="url" autoComplete="url" value={customEndpoint} onChange={(e) => setCustomEndpoint(e.target.value)} placeholder="https://s3.example.com" />
                        {allowEndpointList && (
                          <p className="mt-1 ui-caption text-slate-500">{t({ en: "Custom endpoint overrides the selection above.", fr: "Le point de terminaison personnalisé remplace la sélection ci-dessus.", de: "Der benutzerdefinierte Endpunkt überschreibt die obige Auswahl.", zh: "自定义端点将覆盖上方的选择。" })}</p>
                        )}
                      </div>
                    )}
                    {endpointError && (
                      <UiInlineMessage tone="error">{endpointError}</UiInlineMessage>
                    )}
                  </div>
                )}
                {error && (
                  <UiInlineMessage tone="error">{error}</UiInlineMessage>
                )}
                <AuthButton type="submit" disabled={loading}>
                  {loading ? t({ en: "Connecting...", fr: "Connexion…", de: "Verbindung wird hergestellt…", zh: "正在连接…" }) : t({ en: "Connect with keys", fr: "Se connecter avec des clés", de: "Mit Schlüsseln verbinden", zh: "使用密钥连接" })}
                </AuthButton>
              </form>
            )}

            {oidcProviders.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 ui-caption font-semibold uppercase tracking-wide text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>{t({ en: "Or", fr: "Ou", de: "Oder", zh: "或" })}</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                {oidcProviders.map((provider) => (
                  <AuthButton
                    key={provider.id}
                    type="button"
                    onClick={() => startOidcFlow(provider.id)}
                    disabled={Boolean(oidcLoading)}
                    presentation="provider"
                  >
                    {oidcLoading === provider.id ? t({ en: "Redirecting...", fr: "Redirection…", de: "Weiterleitung…", zh: "正在跳转…" }) : t({ en: `Continue with ${provider.display_name}`, fr: `Continuer avec ${provider.display_name}`, de: `Weiter mit ${provider.display_name}`, zh: `通过 ${provider.display_name} 继续` })}
                  </AuthButton>
                ))}
                {oidcError && (
                  <UiInlineMessage tone="error">{oidcError}</UiInlineMessage>
                )}
              </div>
            )}
            </AuthCard>
            <AppVersion className="mt-3 block text-center text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
