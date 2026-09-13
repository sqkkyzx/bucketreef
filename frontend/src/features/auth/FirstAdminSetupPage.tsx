/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useI18n, type I18nMessage } from "../../i18n";
import { FormEvent, useEffect, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  bootstrapFirstAdmin,
  fetchFirstAdminBootstrapStatus,
} from "../../api/auth";
import BrandMark from "../../components/BrandMark";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import { PRODUCT_NAME } from "../../constants/product";
import { extractApiError } from "../../utils/apiError";

const inputClasses =
  "mt-1 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 ui-body text-slate-800 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const buttonClasses =
  "w-full rounded-xl bg-primary px-4 py-2.5 ui-body font-semibold text-white shadow-sm transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60";

function readBootstrapTokenFragment(): string {
  if (typeof window === "undefined") return "";
  const fragment = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(fragment).get("token")?.trim() ?? "";
}

function clearBootstrapTokenFragment(): void {
  if (typeof window === "undefined") return;
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }
}

export default function FirstAdminSetupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [token] = useState(readBootstrapTokenFragment);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<I18nMessage | null>(null);

  useLayoutEffect(() => {
    clearBootstrapTokenFragment();
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchFirstAdminBootstrapStatus()
      .then((status) => {
        if (!mounted) return;
        if (!status.available) {
          navigate("/login", { replace: true });
          return;
        }
        if (!token) {
          setError(
            {
              en: "The bootstrap token is missing. Open the complete one-time URL issued by the backend.",
              fr: "Le jeton d’initialisation est manquant. Ouvrez l’URL à usage unique complète fournie par le backend.",
              de: "Das Einrichtungstoken fehlt. Öffnen Sie die vollständige einmalige URL des Backends.",
              zh: "缺少初始化令牌，请打开后端生成的完整一次性 URL。",
            },
          );
        }
      })
      .catch((statusError) => {
        if (mounted) {
          setError(
            extractApiError(statusError, "") || { en: "Unable to check bootstrap availability.", fr: "Impossible de vérifier la disponibilité de l’initialisation.", de: "Die Verfügbarkeit der Einrichtung konnte nicht geprüft werden.", zh: "无法检查初始化是否可用。" },
          );
        }
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [navigate, token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(
        {
          en: "The bootstrap token is missing. Issue a new one-time URL from the backend.",
          fr: "Le jeton d’initialisation est manquant. Générez une nouvelle URL à usage unique depuis le backend.",
          de: "Das Einrichtungstoken fehlt. Erstellen Sie im Backend eine neue einmalige URL.",
          zh: "缺少初始化令牌，请从后端生成新的一次性 URL。",
        },
      );
      return;
    }
    if (password !== passwordConfirmation) {
      setError({
        en: "Passwords do not match.",
        fr: "Les mots de passe ne correspondent pas.",
        de: "Die Passwörter stimmen nicht überein.",
        zh: "两次输入的密码不一致。",
      });
      return;
    }
    setSubmitting(true);
    try {
      const response = await bootstrapFirstAdmin(token, {
        email: email.trim(),
        full_name: fullName.trim() || null,
        password,
        password_confirmation: passwordConfirmation,
      });
      if (response.status !== "mfa_enrollment_required") {
        throw new Error(t({
          en: "Administrator passkey enrollment was not started.",
          fr: "L’enregistrement de la clé d’accès administrateur n’a pas démarré.",
          de: "Die Registrierung des Administrator-Passkeys wurde nicht gestartet.",
          zh: "尚未启动管理员通行密钥注册。",
        }));
      }
      navigate("/login?mfa=mfa_enrollment_required", { replace: true });
    } catch (submitError) {
      setError(
        extractApiError(submitError, "") || { en: "The bootstrap link is invalid, expired, or already used.", fr: "Le lien d’initialisation est invalide, expiré ou déjà utilisé.", de: "Der Einrichtungslink ist ungültig, abgelaufen oder wurde bereits verwendet.", zh: "初始化链接无效、已过期或已被使用。" },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-7rem] h-80 w-80 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="auth-brand-glow-coral absolute -right-24 bottom-[-7rem] h-96 w-96 rounded-full blur-3xl" />
        <div className="auth-brand-radial absolute inset-0" />
      </div>
      <section className="relative w-full max-w-lg rounded-3xl bg-white p-7 text-slate-900 shadow-2xl sm:p-8">
        <BrandMark alt={PRODUCT_NAME} className="mb-5 h-16 w-16" />
        <p className="ui-caption font-semibold uppercase tracking-wide text-primary-700">
          {t({
            en: "Initial setup",
            fr: "Configuration initiale",
            de: "Ersteinrichtung",
            zh: "初始设置",
          })}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t({
            en: "Create the first administrator",
            fr: "Créer le premier administrateur",
            de: "Ersten Administrator erstellen",
            zh: "创建首个管理员",
          })}</h1>
        <p className="mt-3 ui-body text-slate-600">
          {t({
            en: "This one-time setup creates the platform super-administrator. A passkey will be required immediately afterward.",
            fr: "Cette configuration unique crée le super-administrateur de la plateforme. Une clé d’accès sera requise immédiatement après.",
            de: "Diese einmalige Einrichtung erstellt den Superadministrator der Plattform. Direkt danach wird ein Passkey benötigt.",
            zh: "此一次性设置将创建平台超级管理员，随后需要立即配置通行密钥。",
          })}</p>

        {error ? (
          <div className="mt-5">
            <UiInlineMessage tone="error">{t(error)}</UiInlineMessage>
          </div>
        ) : null}

        {checking ? (
          <p className="mt-6 ui-body text-slate-600">
            {t({
              en: "Checking the bootstrap link…",
              fr: "Vérification du lien d’initialisation…",
              de: "Einrichtungslink wird geprüft…",
              zh: "正在检查初始化链接…",
            })}</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label
              className="block ui-body font-medium"
              htmlFor="bootstrap-full-name"
            >
              {t({
                en: "Full name",
                fr: "Nom complet",
                de: "Vollständiger Name",
                zh: "姓名",
              })}<input
                id="bootstrap-full-name"
                className={inputClasses}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label
              className="block ui-body font-medium"
              htmlFor="bootstrap-email"
            >
              {t({
                en: "Email",
                fr: "E-mail",
                de: "E-Mail",
                zh: "邮箱",
              })}<input
                id="bootstrap-email"
                className={inputClasses}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
              />
            </label>
            <div>
              <label
                className="block ui-body font-medium"
                htmlFor="bootstrap-password"
              >
                {t({
                  en: "Password",
                  fr: "Mot de passe",
                  de: "Passwort",
                  zh: "密码",
                })}</label>
              <input
                id="bootstrap-password"
                className={inputClasses}
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                aria-describedby="bootstrap-password-help"
              />
              <span
                id="bootstrap-password-help"
                className="mt-1 block ui-caption text-slate-500"
              >
                {t({
                  en: "Use at least 12 characters.",
                  fr: "Utilisez au moins 12 caractères.",
                  de: "Verwenden Sie mindestens 12 Zeichen.",
                  zh: "请使用至少 12 个字符。",
                })}</span>
            </div>
            <label
              className="block ui-body font-medium"
              htmlFor="bootstrap-password-confirmation"
            >
              {t({
                en: "Confirm password",
                fr: "Confirmer le mot de passe",
                de: "Passwort bestätigen",
                zh: "确认密码",
              })}<input
                id="bootstrap-password-confirmation"
                className={inputClasses}
                type="password"
                required
                minLength={12}
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                autoComplete="new-password"
              />
            </label>
            <button
              type="submit"
              className={buttonClasses}
              disabled={
                submitting ||
                !token ||
                !email.trim() ||
                password.length < 12 ||
                passwordConfirmation.length < 12
              }
            >
              {submitting
                ? t({
                  en: "Creating administrator…",
                  fr: "Création de l’administrateur…",
                  de: "Administrator wird erstellt…",
                  zh: "正在创建管理员…",
                })
                : t({
                  en: "Create administrator",
                  fr: "Créer l’administrateur",
                  de: "Administrator erstellen",
                  zh: "创建管理员",
                })}
            </button>
          </form>
        )}
        <p className="mt-5 ui-caption text-slate-500">
          {t({
            en: "Already initialized?",
            fr: "Déjà initialisé ?",
            de: "Bereits eingerichtet?",
            zh: "已经初始化？",
          })}{" "}
          <Link className="font-semibold text-primary-700" to="/login">
            {t({
              en: "Return to sign in",
              fr: "Retour à la connexion",
              de: "Zurück zur Anmeldung",
              zh: "返回登录",
            })}</Link>
        </p>
      </section>
    </div>
  );
}
