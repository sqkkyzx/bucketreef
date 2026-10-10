/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { FormEvent, useEffect, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  bootstrapFirstAdmin,
  fetchFirstAdminBootstrapStatus,
} from "../../api/auth";
import { useSession } from "../../auth/SessionProvider";
import BrandMark from "../../components/BrandMark";
import ErrorState from "../../components/errors/ErrorState";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import { PRODUCT_NAME } from "../../constants/product";
import { extractApiError } from "../../utils/apiError";
import { AuthButton, AuthInput } from "./AuthFormControls";
import { AuthCard, AuthCenteredPage } from "./AuthSurface";
import { useI18n } from "../../i18n";


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
  const { refresh: refreshSession } = useSession();
  const [token] = useState(readBootstrapTokenFragment);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<unknown>(null);

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
            t({ en: "The bootstrap token is missing. Open the complete one-time URL issued by the backend.", zh: "缺少引导令牌，请打开后端生成的完整一次性 URL。" }),
          );
        }
      })
      .catch((statusError) => {
        if (mounted) {
          setAvailabilityError(statusError);
        }
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [navigate, token, t]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(
        t({ en: "The bootstrap token is missing. Issue a new one-time URL from the backend.", zh: "缺少引导令牌，请从后端生成新的一次性 URL。" }),
      );
      return;
    }
    if (password !== passwordConfirmation) {
      setError(t({ en: "Passwords do not match.", zh: "两次输入的密码不一致。" }));
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
      if (response.status === "authenticated") {
        const session = await refreshSession();
        if (!session) {
          throw new Error(t({ en: "The administrator session could not be loaded.", zh: "无法加载管理员会话。" }));
        }
        navigate("/", { replace: true });
        return;
      }
      if (response.status === "mfa_enrollment_required") {
        navigate("/login?mfa=mfa_enrollment_required", { replace: true });
        return;
      }
      throw new Error(t({ en: "Administrator authentication did not complete.", zh: "管理员认证未完成。" }));
    } catch (submitError) {
      setError(
        extractApiError(
          submitError,
          t({ en: "The bootstrap link is invalid, expired, or already used.", zh: "引导链接无效、已过期或已使用。" }),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!checking && availabilityError) return <ErrorState error={availabilityError} presentation="full" onRetry={async () => {
    // The single-use token has already been removed from the address bar.
    // Retry in place so a transient outage cannot discard it through a reload.
    const status = await fetchFirstAdminBootstrapStatus();
    if (!status.available) navigate("/login", { replace: true });
    else setAvailabilityError(null);
  }} />;
  if (!checking && !token) return <ErrorState kind="invalid_link" presentation="full" />;

  return (
    <AuthCenteredPage radial className="py-10">
      <AuthCard className="max-w-lg p-7 sm:p-8">
        <BrandMark alt={PRODUCT_NAME} className="mb-5 h-16 w-16" />
        <p className="ui-caption font-semibold uppercase tracking-wide text-primary-700">
          {t({ en: "Initial setup", zh: "初始设置" })}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t({ en: "Create the first administrator", zh: "创建首个管理员" })}
        </h1>
        <p className="mt-3 ui-body text-slate-600">
          {t({ en: "This one-time setup creates the platform super-administrator. A passkey is optional during onboarding and should be enabled before production.", zh: "此一次性设置将创建平台超级管理员。引导期间可选用通行密钥，但应在生产环境启用。" })}
        </p>

        {error ? (
          <div className="mt-5">
            <UiInlineMessage tone="error">{error}</UiInlineMessage>
          </div>
        ) : null}

        {checking ? (
          <p className="mt-6 ui-body text-slate-600">
            {t({ en: "Checking the bootstrap link…", zh: "正在检查引导链接…" })}
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <AuthInput
              id="bootstrap-full-name"
              label={t({ en: "Full name", zh: "姓名" })}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
            <AuthInput
              id="bootstrap-email"
              label={t({ en: "Email", zh: "邮箱" })}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
            <div>
              <AuthInput
                id="bootstrap-password"
                label={t({ en: "Password", zh: "密码" })}
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
                {t({ en: "Use at least 12 characters.", zh: "至少使用 12 个字符。" })}
              </span>
            </div>
            <AuthInput
              id="bootstrap-password-confirmation"
              label={t({ en: "Confirm password", zh: "确认密码" })}
              type="password"
              required
              minLength={12}
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              autoComplete="new-password"
            />
            <AuthButton
              type="submit"
              disabled={
                submitting ||
                !token ||
                !email.trim() ||
                password.length < 12 ||
                passwordConfirmation.length < 12
              }
            >
              {submitting
                ? t({ en: "Creating administrator…", zh: "正在创建管理员…" })
                : t({ en: "Create administrator", zh: "创建管理员" })}
            </AuthButton>
          </form>
        )}
        <p className="mt-5 ui-caption text-slate-500">
          {t({ en: "Already initialized?", zh: "已经初始化？" })}{" "}
          <Link className="font-semibold text-primary-700" to="/login">
            {t({ en: "Return to sign in", zh: "返回登录" })}
          </Link>
        </p>
      </AuthCard>
    </AuthCenteredPage>
  );
}
