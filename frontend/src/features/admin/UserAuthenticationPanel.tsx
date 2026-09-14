/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addAdminExternalIdentity,
  getAdminUserSecurity,
  resetAdminUserMfa,
  restoreAdminExternalIdentity,
  revokeAdminExternalIdentity,
  revokeAdminUserSession,
  setAdminUserPassword,
  type AdminExternalIdentity,
  type AdminUserSecurity,
  type SecuritySession,
} from "../../api/security";
import {
  isRecentWebAuthnVerificationCancelled,
  useRecentWebAuthnStepUp,
} from "../../auth/useRecentWebAuthnStepUp";
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import PageBanner from "../../components/PageBanner";
import { SettingsButton } from "../../components/settings/SettingsControls";
import { SettingsItem, SettingsSection } from "../../components/settings/SettingsLayout";
import UiBadge from "../../components/ui/UiBadge";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import { extractApiError } from "../../utils/apiError";
import { securityDate } from "../shared/securityPresentation";
import { useAdminControlText } from "./adminControlMessages";

type PendingAction =
  | { kind: "reset-mfa" }
  | { kind: "revoke-identity"; identity: AdminExternalIdentity }
  | { kind: "restore-identity"; identity: AdminExternalIdentity }
  | { kind: "revoke-session"; session: SecuritySession };

function submitOnEnter(event: KeyboardEvent<HTMLFieldSetElement>, action: () => Promise<void>) {
  if (event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    event.stopPropagation();
    void action();
  }
}

export default function UserAuthenticationPanel({ userId, canMutate, onBusyChange, onDirtyChange }: {
  userId: number;
  canMutate: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { locale, t } = useAdminControlText();
  const [security, setSecurity] = useState<AdminUserSecurity | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGeneration = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<"password" | "identity" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [providerType, setProviderType] = useState<"oidc" | "ldap">("oidc");
  const [providerId, setProviderId] = useState("");
  const [subject, setSubject] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityAttempted, setIdentityAttempted] = useState(false);
  const providerRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const stepUpLabels = useMemo(() => locale === "zh" ? {
    title: t("Verify with passkey"),
    description: t("Confirm your identity to continue this sensitive action in the current session."),
    cancel: t("Cancel"),
    close: t("Close"),
    cancelled: t("Passkey verification was cancelled or timed out. Please try again."),
    failure: (stepUpError: unknown) => t(extractApiError(stepUpError, "Passkey verification failed. Please try again.")),
  } : undefined, [locale, t]);
  const { runWithStepUp, verificationDialog } = useRecentWebAuthnStepUp(stepUpLabels);
  const disabled = !canMutate || loading || Boolean(loadError) || !security || busy;
  const passwordError = !password.trim() || [...password].length < 12 ? t("At least 12 characters.") : undefined;
  const confirmationError = !passwordConfirmation || password !== passwordConfirmation ? t("Enter the same new password in both fields.") : undefined;
  const providerError = !providerId.trim() ? t("Provider ID is required.") : undefined;
  const subjectError = !subject.trim() ? t("Immutable subject is required.") : undefined;
  // Read the native email validity, including after any controlled-input update.
  const [invalidEmail, setInvalidEmail] = useState(false);
  const emailError = invalidEmail ? t("Enter a valid email address.") : undefined;
  const date = (value?: string | null) => securityDate(value, locale === "zh" ? "zh-CN" : navigator.language, t("Not available"));

  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const dirty = Boolean(password || passwordConfirmation || providerId || subject || identityEmail);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadError(null);
    try {
      const details = await getAdminUserSecurity(userId);
      if (generation === loadGeneration.current) setSecurity(details);
    } catch (loadFailure) {
      if (generation === loadGeneration.current) setLoadError(extractApiError(loadFailure, t("Unable to load authentication details.")));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  const runAction = async (action: () => Promise<void>, success: string, requiresStepUp = true) => {
    if (disabled || busyRef.current) return false;
    busyRef.current = true;
    onBusyChange?.(true);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (requiresStepUp) await runWithStepUp(action);
      else await action();
      setMessage(success);
      await load();
      return true;
    } catch (actionError) {
      if (!isRecentWebAuthnVerificationCancelled(actionError)) {
        setError(extractApiError(actionError, t("Unable to update authentication settings.")));
      }
      throw actionError;
    } finally {
      busyRef.current = false;
      onBusyChange?.(false);
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (disabled || busyRef.current) return;
    setError(null);
    setErrorContext("password");
    setMessage(null);
    setPasswordAttempted(true);
    if (passwordError || confirmationError) {
      (passwordError ? passwordRef : confirmationRef).current?.focus();
      return;
    }
    try {
      if (await runAction(() => setAdminUserPassword(userId, password), t("Local password updated and user sessions revoked."))) {
        setPassword("");
        setPasswordConfirmation("");
        setPasswordAttempted(false);
      }
    } catch {
      // Keep the draft; runAction displays the failure.
    }
  };

  const addIdentity = async () => {
    if (disabled || busyRef.current) return;
    setError(null);
    setErrorContext("identity");
    setMessage(null);
    setIdentityAttempted(true);
    if (providerError || subjectError || emailError) {
      (providerError ? providerRef : subjectError ? subjectRef : emailRef).current?.focus();
      return;
    }
    try {
      if (await runAction(
        async () => { await addAdminExternalIdentity(userId, {
          provider_type: providerType,
          provider_id: providerId,
          subject,
          email: identityEmail || null,
          email_verified: providerType === "oidc" && Boolean(identityEmail),
        }); },
        t("External identity linked."),
      )) {
        setProviderId("");
        setSubject("");
        setIdentityEmail("");
        setInvalidEmail(false);
        setIdentityAttempted(false);
      }
    } catch {
      // Keep the draft; runAction displays the failure.
    }
  };

  const requestAction = (action: PendingAction) => {
    if (disabled || busyRef.current) return;
    setError(null);
    setErrorContext(null);
    setMessage(null);
    setPending(action);
  };

  const confirmPending = async () => {
    if (!pending || disabled || busyRef.current) return;
    try {
      const succeeded = pending.kind === "reset-mfa"
        ? await runAction(() => resetAdminUserMfa(userId), t("MFA reset completed. Sessions and API tokens were revoked."))
        : pending.kind === "revoke-identity"
          ? await runAction(() => revokeAdminExternalIdentity(userId, pending.identity.id), t("External identity revoked."))
          : pending.kind === "restore-identity"
            ? await runAction(() => restoreAdminExternalIdentity(userId, pending.identity.id), t("External identity restored."))
            : await runAction(() => revokeAdminUserSession(userId, pending.session.id), t("Session revoked."), false);
      if (succeeded) setPending(null);
    } catch {
      // Keep the confirmation open with its error for retry.
    }
  };

  return (
    <div className="settings-stack">
      {loading && <PageBanner tone="info">{t("Loading authentication details...")}</PageBanner>}
      {loadError && <PageBanner tone="error">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{loadError}</span>
          <SettingsButton variant="secondary" disabled={loading || busy} onClick={() => void load()}>{t("Retry")}</SettingsButton>
        </div>
      </PageBanner>}
      {message && <PageBanner tone="success">{message}</PageBanner>}
      <p className="settings-description">
        {canMutate
          ? t("Authentication changes in this tab are applied immediately; there is no separate user-form save step.")
          : t("Use your personal Security page to manage your own authentication methods.")}
      </p>

      {security && <fieldset disabled={disabled} className="min-w-0">
        <SettingsSection title={t("Passkeys and MFA")} presentation="compact"
          description={security.passkey_required ? t("A passkey is required for this user's role.") : t("Passkey enrollment is optional for this user's role.")}>
          {security.passkeys.map((passkey) => <SettingsItem compact key={passkey.id} title={passkey.name}
            className="[overflow-wrap:anywhere]"
            status={<UiBadge tone={passkey.revoked_at ? "neutral" : "success"}>{passkey.revoked_at ? t("Revoked") : t("Active")}</UiBadge>}
            description={locale === "zh" ? `上次使用：${date(passkey.last_used_at)}` : `Last used: ${date(passkey.last_used_at)}`} />)}
          {security.passkeys.length === 0 && <p className="settings-readonly">{t("No passkeys registered.")}</p>}
          {canMutate && <div className="mt-2"><SettingsButton variant="danger" onClick={() => requestAction({ kind: "reset-mfa" })}>{t("Reset MFA")}</SettingsButton></div>}
        </SettingsSection>

        <SettingsSection title={t("Local password")} presentation="compact"
          description={security.has_local_password ? t("A local password is configured.") : t("No local password is configured.")}>
          {canMutate && <fieldset aria-label={t("Change local password")} className="settings-fields sm:grid-cols-2" onKeyDown={(event) => submitOnEnter(event, savePassword)}>
            <UiInput ref={passwordRef} label={t("New password")} hint={t("At least 12 characters.")} type="password" minLength={12} autoComplete="new-password"
              value={password} onChange={(event) => setPassword(event.target.value)} error={passwordAttempted ? passwordError : undefined} />
            <UiInput ref={confirmationRef} label={t("Confirm password")} type="password" minLength={12} autoComplete="new-password"
              value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} error={passwordAttempted ? confirmationError : undefined} />
            <div className="sm:col-span-2"><SettingsButton onClick={() => void savePassword()}>{t("Set password")}</SettingsButton></div>
            {error && errorContext === "password" && <PageBanner tone="error" className="sm:col-span-2">{error}</PageBanner>}
          </fieldset>}
        </SettingsSection>

        <SettingsSection title={t("External identities")} presentation="compact" description={t("Active and revoked immutable provider subjects are managed here.")}>
          {security.external_identities.map((identity) => <SettingsItem compact key={identity.id}
            title={`${identity.provider_type}:${identity.provider_id}`} className="[overflow-wrap:anywhere]"
            status={<UiBadge tone={identity.revoked_at ? "neutral" : "success"}>{identity.revoked_at ? t("Revoked") : t("Active")}</UiBadge>}
            description={<><code className="block break-all">{identity.subject}</code><span>{identity.link_source}</span></>}
            action={canMutate && (identity.revoked_at
              ? <SettingsButton variant="secondary" onClick={() => requestAction({ kind: "restore-identity", identity })}>{t("Restore")}</SettingsButton>
              : <SettingsButton variant="danger" onClick={() => requestAction({ kind: "revoke-identity", identity })}>{t("Revoke")}</SettingsButton>)} />)}
          {security.external_identities.length === 0 && <p className="settings-readonly">{t("No external identities.")}</p>}
          {canMutate && <fieldset aria-label={t("Link external identity")} className="settings-fields mt-3 border-t border-[var(--ui-border-soft)] pt-3 sm:grid-cols-2"
            onKeyDown={(event) => submitOnEnter(event, addIdentity)}>
            <UiSelect label={t("Provider type")} value={providerType} onChange={(event) => setProviderType(event.target.value as "oidc" | "ldap")}>
              <option value="oidc">OIDC</option><option value="ldap">LDAP</option>
            </UiSelect>
            <UiInput ref={providerRef} label={t("Provider ID")} value={providerId} onChange={(event) => setProviderId(event.target.value)} error={identityAttempted ? providerError : undefined} />
            <UiInput ref={subjectRef} label={t("Immutable subject")} value={subject} onChange={(event) => setSubject(event.target.value)} error={identityAttempted ? subjectError : undefined} />
            <UiInput ref={emailRef} label={t("Claimed email (optional)")} type="email" value={identityEmail} error={identityAttempted ? emailError : undefined}
              onChange={(event) => { setIdentityEmail(event.target.value); setInvalidEmail(!event.target.validity.valid); }} />
            <div className="sm:col-span-2"><SettingsButton onClick={() => void addIdentity()}>{t("Link identity")}</SettingsButton></div>
            {error && errorContext === "identity" && <PageBanner tone="error" className="sm:col-span-2">{error}</PageBanner>}
          </fieldset>}
        </SettingsSection>

        <SettingsSection title={t("User sessions")} presentation="compact">
          {security.sessions.map((session) => <SettingsItem compact key={session.id}
            title={`${session.auth_type} · ${session.ip_address ?? t("Unknown address")}`} className="[overflow-wrap:anywhere]"
            description={locale === "zh" ? `上次活动：${date(session.last_activity_at)}` : `Last activity: ${date(session.last_activity_at)}`}
            status={session.revoked_at && <UiBadge tone="neutral">{t("Revoked")}</UiBadge>}
            action={canMutate && !session.revoked_at && <SettingsButton variant="danger" onClick={() => requestAction({ kind: "revoke-session", session })}>{t("Revoke")}</SettingsButton>} />)}
          {security.sessions.length === 0 && <p className="settings-readonly">{t("No sessions.")}</p>}
        </SettingsSection>
      </fieldset>}

      {pending && <ConfirmActionDialog
        title={pending.kind === "reset-mfa" ? t("Reset user MFA") : pending.kind === "revoke-session" ? t("Revoke user session") : pending.kind === "restore-identity" ? t("Restore external identity") : t("Revoke external identity")}
        description={pending.kind === "reset-mfa"
          ? t("Passkeys, recovery codes and authentication challenges will be removed. All sessions and API tokens will be revoked.")
          : pending.kind === "revoke-session" ? t("Only the selected session will be revoked.")
            : t("This security change revokes the user's active sessions and API tokens.")}
        details={[
          { label: t("User"), value: security?.email ?? String(userId) },
          ...(pending.kind === "revoke-identity" || pending.kind === "restore-identity" ? [
            { label: t("Provider"), value: `${pending.identity.provider_type}:${pending.identity.provider_id}` },
            { label: t("Subject"), value: pending.identity.subject, mono: true },
          ] : pending.kind === "revoke-session" ? [
            { label: t("Session"), value: pending.session.id, mono: true },
            { label: t("Address"), value: pending.session.ip_address ?? t("Unknown address") },
          ] : []),
        ]}
        confirmLabel={pending.kind === "reset-mfa" ? t("Reset MFA") : pending.kind === "restore-identity" ? t("Restore identity") : t("Confirm")}
        tone={pending.kind === "restore-identity" ? "primary" : "danger"}
        error={error}
        loading={busy}
        confirmDisabled={loading || Boolean(loadError) || !canMutate}
        onCancel={() => { if (!busyRef.current) { setPending(null); setError(null); } }}
        onConfirm={() => void confirmPending()}
      />}
      {verificationDialog}
    </div>
  );
}
