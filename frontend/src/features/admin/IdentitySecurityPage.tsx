/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { ListActionButton } from "../../components/list/ListControls";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminRevokeSession,
  decideExternalLinkRequest,
  listAdminSessions,
  listExternalLinkRequests,
  type AdminSecuritySession,
  type ExternalLinkRequest,
} from "../../api/security";
import {
  isRecentWebAuthnVerificationCancelled,
  useRecentWebAuthnStepUp,
} from "../../auth/useRecentWebAuthnStepUp";
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import ListPageSection from "../../components/list/ListPageSection";
import PageBanner from "../../components/PageBanner";
import PageShell from "../../components/PageShell";
import PageTabs from "../../components/PageTabs";
import UiBadge from "../../components/ui/UiBadge";
import UiButton from "../../components/ui/UiButton";
import { cx, type UiTone, uiMutedTextClass, uiTitleTextClass } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import { uiPrincipalRoleLabel } from "./AssociationSummary";
import {
  localizeAdminIdentityConnectionBreadcrumbs,
  useAdminIdentityConnectionText,
} from "./adminIdentityConnectionMessages";

type PendingLinkDecision = {
  request: ExternalLinkRequest;
  approve: boolean;
};

type IdentitySecurityView = "requests" | "sessions";

const AUTH_TYPE_LABELS: Record<string, string> = {
  ldap: "LDAP",
  oidc: "OIDC",
  passkey: "Passkey",
  password: "Password",
  s3: "S3 access key",
  s3_session: "S3 access key",
  webauthn: "Passkey",
};

function formatDate(value: string, locale: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function roleTone(role?: string | null): UiTone {
  if (role === "ui_superadmin" || role === "ui_admin") return "primary";
  if (role === "ui_none") return "warning";
  return "neutral";
}

function authenticationLabel(authType: string, t: (message: string) => string): string {
  const label = AUTH_TYPE_LABELS[authType.toLowerCase()];
  return label ? t(label) : authType.replaceAll("_", " ");
}

function providerLabel(providerType: string): string {
  const normalized = providerType.toLowerCase();
  if (normalized === "oidc") return "OIDC";
  if (normalized === "ldap") return "LDAP";
  return providerType.toUpperCase();
}

function sessionPrincipalLabel(session: AdminSecuritySession, locale: string): string {
  if (session.user_full_name) return session.user_full_name;
  if (session.user_email) return session.user_email;
  if (session.user_id) return locale === "zh" ? `用户 #${session.user_id}` : `User #${session.user_id}`;
  return locale === "zh" ? "S3 会话" : "S3 session";
}

export default function IdentitySecurityPage() {
  const [activeView, setActiveView] = useState<IdentitySecurityView>("requests");
  const [sessions, setSessions] = useState<AdminSecuritySession[]>([]);
  const [requests, setRequests] = useState<ExternalLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingLinkDecision, setPendingLinkDecision] = useState<PendingLinkDecision | null>(null);
  const [pendingSession, setPendingSession] = useState<AdminSecuritySession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { locale, t } = useAdminIdentityConnectionText();
  const stepUpLabels = useMemo(() => locale === "zh" ? {
    title: t("Verify with passkey"),
    description: t("Confirm your identity to continue this sensitive action in the current session."),
    cancel: t("Cancel"),
    close: t("Close"),
    cancelled: t("Passkey verification was cancelled or timed out. Please try again."),
    failure: (stepUpError: unknown) => t(extractApiError(stepUpError, "Passkey verification failed. Please try again.")),
  } : undefined, [locale, t]);
  const { runWithStepUp, verificationDialog } = useRecentWebAuthnStepUp(stepUpLabels);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSessions, nextRequests] = await Promise.all([
        listAdminSessions(),
        listExternalLinkRequests(),
      ]);
      setSessions(nextSessions);
      setRequests(nextRequests);
    } catch (loadError) {
      setError(extractApiError(loadError, "Unable to load identity security data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async () => {
    if (!pendingLinkDecision) return;
    const { request, approve } = pendingLinkDecision;
    setBusy(request.id);
    setError(null);
    try {
      const operation = () => decideExternalLinkRequest(request.id, approve);
      if (approve) await runWithStepUp(operation);
      else await operation();
      setPendingLinkDecision(null);
      setMessage(approve ? "Identity link approved." : "Identity link rejected.");
      await load();
    } catch (actionError) {
      if (!isRecentWebAuthnVerificationCancelled(actionError)) {
        setError(extractApiError(actionError, "Unable to update the identity request."));
      }
    } finally {
      setBusy(null);
    }
  };

  const showData = !loading && !error;

  const requestColumns = useMemo<Array<DataTableColumn<ExternalLinkRequest>>>(
    () => [
      {
        id: "account",
        label: t("Local account"),
        primary: true,
        render: (request) => (
          <div className="min-w-0 space-y-1">
            <p className={cx("break-all", uiTitleTextClass)}>{request.user_email}</p>
            <UiBadge tone={roleTone(request.user_role)}>{t(uiPrincipalRoleLabel(request.user_role))}</UiBadge>
          </div>
        ),
      },
      {
        id: "provider",
        label: t("Provider"),
        render: (request) => (
          <div className="min-w-0 space-y-1">
            <UiBadge tone="info">{providerLabel(request.provider_type)}</UiBadge>
            <p className={cx("break-all ui-caption", uiMutedTextClass)}>{request.provider_id}</p>
          </div>
        ),
      },
      {
        id: "claimed-email",
        label: t("Claimed email"),
        render: (request) => <span className="break-all">{request.email}</span>,
      },
      {
        id: "expires",
        label: t("Expires"),
        render: (request) => <time dateTime={request.expires_at}>{formatDate(request.expires_at, locale)}</time>,
      },
      {
        id: "actions",
        label: t("Actions"),
        align: "right",
        mobileRole: "actions",
        render: (request) => (
          <div className="flex flex-wrap justify-end gap-2">
            <ListActionButton variant="primary"
              disabled={busy === request.id}
              onClick={() => setPendingLinkDecision({ request, approve: true })}
            >
              {t("Approve")}
            </ListActionButton>
            <ListActionButton
              variant="danger"
              disabled={busy === request.id}
              onClick={() => setPendingLinkDecision({ request, approve: false })}
            >
              {t("Reject")}
            </ListActionButton>
          </div>
        ),
      },
    ],
    [busy, locale, t],
  );

  const sessionColumns = useMemo<Array<DataTableColumn<AdminSecuritySession>>>(
    () => [
      {
        id: "user",
        label: t("User"),
        primary: true,
        render: (session) => (
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className={cx("truncate", uiTitleTextClass)}>{sessionPrincipalLabel(session, locale)}</p>
              {session.current ? <UiBadge tone="success">{t("Current")}</UiBadge> : null}
            </div>
            <p className={cx("break-all ui-caption", uiMutedTextClass)}>
              {session.user_full_name && session.user_email
                ? session.user_email
                : session.s3_session_id ?? session.user_email ?? session.id}
            </p>
          </div>
        ),
      },
      {
        id: "authentication",
        label: t("Authentication"),
        mobileLabel: t("Auth method"),
        render: (session) => (
          <span className="inline-flex justify-self-start">
            <UiBadge tone="info">{authenticationLabel(session.auth_type, t)}</UiBadge>
          </span>
        ),
      },
      {
        id: "role",
        label: t("Role"),
        render: (session) => session.user_role
          ? (
              <span className="inline-flex justify-self-start">
                <UiBadge tone={roleTone(session.user_role)}>{t(uiPrincipalRoleLabel(session.user_role))}</UiBadge>
              </span>
            )
          : <span className={uiMutedTextClass}>{t("Not applicable")}</span>,
      },
      {
        id: "network",
        label: t("Network"),
        render: (session) => session.ip_address ?? <span className={uiMutedTextClass}>{t("Unknown")}</span>,
      },
      {
        id: "activity",
        label: t("Last activity"),
        render: (session) => <time dateTime={session.last_activity_at}>{formatDate(session.last_activity_at, locale)}</time>,
      },
      {
        id: "actions",
        label: t("Actions"),
        align: "right",
        mobileRole: "actions",
        render: (session) => session.revoked_at
          ? <UiBadge>{t("Revoked")}</UiBadge>
          : <ListActionButton  variant="danger" onClick={() => setPendingSession(session)}>{t("Revoke")}</ListActionButton>,
      },
    ],
    [locale, t],
  );

  const revokeSession = async () => {
    if (!pendingSession) return;
    setBusy(pendingSession.id);
    setError(null);
    try {
      await adminRevokeSession(pendingSession.id);
      setPendingSession(null);
      setMessage("Session revoked.");
      await load();
    } catch (actionError) {
      setError(extractApiError(actionError, "Unable to revoke the session."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell actionPresentation="listing"
      title={t("Identity Security")}
      description={t("Review external identity link requests and manage active platform sessions within your administrative scope.")}
      breadcrumbs={localizeAdminIdentityConnectionBreadcrumbs(adminPageBreadcrumbs("identity-security"), locale)}
      breadcrumbLabel={t("Breadcrumb")}

    >
      {error ? (
        <PageBanner tone="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t(error)}</span>
            <UiButton size="xs" variant="secondary" onClick={() => void load()}>{t("Retry")}</UiButton>
          </div>
        </PageBanner>
      ) : null}
      {message ? <PageBanner tone="success">{t(message)}</PageBanner> : null}
      {loading ? <PageBanner tone="info">{t("Loading identity security data...")}</PageBanner> : null}

      {showData ? (
        <>
          <PageTabs
            activeTab={activeView}
            onChange={(view) => setActiveView(view as IdentitySecurityView)}
            variant="line"
            ariaLabel={t("Identity security views")}
            idPrefix="identity-security"
            tabs={[
              {
                id: "requests",
                label: t(`Link requests (${requests.length})`),
                content: (
                  <ListPageSection
                    title={t("External identity link requests")}
                    secondaryContent={<p>{t("Decide only when the external identity and local account have been verified through a trusted channel.")}</p>}
                    variant="page"
                    actions={<ListActionButton loading={loading} onClick={() => void load()}>{t("Refresh")}</ListActionButton>}
                  >
                    <DataTableShell
                      columns={requestColumns}
                      rows={requests}
                      rowKey={(request) => request.id}
                      status={resolveListTableStatus({ loading, error, rowCount: requests.length })}
                      loadingMessage={t("Loading identity link requests...")}
                      errorMessage={t("Unable to load identity link requests.")}
                      emptyMessage={t("No pending identity link requests.")}
                      primaryColumnId="account"
                      responsiveCards
                      tableClassName="ui-data-table"
                      rowClassName="bg-white/80 hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-900/50"
                    />
                  </ListPageSection>
                ),
              },
              {
                id: "sessions",
                label: t(`Active sessions (${sessions.length})`),
                content: (
                  <ListPageSection
                    title={t("Platform sessions")}
                    secondaryContent={<p>{t("Revoke a session to remove its access immediately. Only sessions inside your administrative scope are shown.")}</p>}
                    variant="page"
                    actions={<ListActionButton loading={loading} onClick={() => void load()}>{t("Refresh")}</ListActionButton>}
                  >
                    <DataTableShell
                      columns={sessionColumns}
                      rows={sessions}
                      rowKey={(session) => session.id}
                      status={resolveListTableStatus({ loading, error, rowCount: sessions.length })}
                      loadingMessage={t("Loading platform sessions...")}
                      errorMessage={t("Unable to load platform sessions.")}
                      emptyMessage={t("No active sessions.")}
                      primaryColumnId="user"
                      responsiveCards
                      tableClassName="ui-data-table"
                      rowClassName="bg-white/80 hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-900/50"
                    />
                  </ListPageSection>
                ),
              },
            ]}
          />
        </>
      ) : null}

      {pendingLinkDecision ? (
        <ConfirmActionDialog
          title={t(pendingLinkDecision.approve ? "Approve identity link" : "Reject identity link request")}
          description={pendingLinkDecision.approve
            ? t("This external identity will be linked to the selected local account.")
            : t("This request will be closed without linking the external identity.")}
          confirmLabel={t(pendingLinkDecision.approve ? "Approve link" : "Reject request")}
          closeLabel={locale === "zh" ? t("Close") : undefined}
          tone={pendingLinkDecision.approve ? "primary" : "danger"}
          loading={busy === pendingLinkDecision.request.id}
          details={[
            { label: t("Local account"), value: pendingLinkDecision.request.user_email },
            { label: t("Provider"), value: `${pendingLinkDecision.request.provider_type}:${pendingLinkDecision.request.provider_id}` },
            { label: t("Claimed email"), value: pendingLinkDecision.request.email },
          ]}
          onCancel={() => setPendingLinkDecision(null)}
          onConfirm={() => void decide()}
        />
      ) : null}

      {pendingSession ? (
        <ConfirmActionDialog
          title={t("Revoke session")}
          description={t("This session will lose access immediately.")}
          confirmLabel={t("Revoke session")}
          closeLabel={locale === "zh" ? t("Close") : undefined}
          loading={busy === pendingSession.id}
          details={[{ label: t("Session"), value: pendingSession.id }]}
          onCancel={() => setPendingSession(null)}
          onConfirm={() => void revokeSession()}
        />
      ) : null}
      {verificationDialog}
    </PageShell>
  );
}
