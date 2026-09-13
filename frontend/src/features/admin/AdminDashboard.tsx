/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate, useI18n } from "../../i18n";
import type { UiLanguage } from "../../components/language";
import { infrastructureMessages } from "../../infrastructureMessages";
import AdminDashboardMap, { type AdminDashboardMapMarker } from "./components/AdminDashboardMap";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAuditLogs, type AuditLogEntry } from "../../api/audit";
import {
  fetchHealthOverview,
  fetchHealthSummary,
  fetchHealthWorkspaceOverview,
  type EndpointHealthOverviewResponse,
  type HealthCheckStatus,
  type WorkspaceEndpointHealthEntry,
  type WorkspaceEndpointHealthOverviewResponse,
} from "../../api/healthchecks";
import { dismissOnboarding, fetchOnboardingStatus, type OnboardingStatus } from "../../api/onboarding";
import { listStorageEndpoints, type StorageEndpoint } from "../../api/storageEndpoints";
import {
  type AdminStorageStats,
  type AdminSummary,
  type AdminTrafficStats,
  fetchAdminStorage,
  fetchAdminSummary,
  fetchAdminTraffic,
} from "../../api/stats";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import PageBanner from "../../components/PageBanner";
import PageHeader from "../../components/PageHeader";
import { localizedAdminPageBreadcrumbs as adminPageBreadcrumbs } from "./adminBreadcrumbs";
import {
  type WorkspaceDashboardFeature,
  type WorkspaceDashboardFeatureGroup,
  type WorkspaceDashboardSummaryItem,
  WorkspaceDashboardSummary,
  WorkspaceDashboardCard,
  WorkspaceDashboardAction,
  WorkspaceDashboardActionLink,
  WorkspaceFeatureSummary,
  WorkspaceAvailabilityMetric,
  type WorkspacePlatformMetric,
  WorkspacePlatformMetricCard,
  WorkspaceStatusDot,
  WorkspaceStatusCounter,
} from "../../components/WorkspaceDashboardKit";
import WorkspaceIncidentsCard from "../../components/WorkspaceIncidentsCard";
import UiBadge from "../../components/ui/UiBadge";
import {
  cx,
  uiCardClass,
  uiCardMutedClass,
  uiMutedTextClass,
} from "../../components/ui/styles";
import {
  OpenIcon,
  RefreshIcon,
} from "../browser/browserIcons";
import { extractApiError } from "../../utils/apiError";
import { formatLocalDateTime } from "../../utils/dateTime";
import { formatBytes, formatCompactNumber, formatPercentage } from "../../utils/format";
import setupIllustration from "./assets/admin-dashboard-setup.png";

const ENDPOINT_STATUS_MAX_AGE_HOURS = 24;
const ENDPOINT_STATUS_MAX_AGE_MS = ENDPOINT_STATUS_MAX_AGE_HOURS * 60 * 60 * 1000;
const ADMIN_INCIDENT_HISTORY_MINUTES = 7 * 24 * 60;
const MAX_ENDPOINT_ROWS = 8;

function parseBackendIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatRelativeTime(value?: string | null, now = Date.now(), locale: UiLanguage = "en"): string {
  const parsed = parseBackendIsoDate(value);
  if (!parsed) return translate(infrastructureMessages.dateUnavailable, locale);
  const diffMs = Math.max(0, now - parsed.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return translate(infrastructureMessages.justNow, locale);
  if (minutes < 60) return translate({ en: `${minutes}m ago`, zh: `${minutes} 分钟前` }, locale);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate({ en: `${hours}h ago`, zh: `${hours} 小时前` }, locale);
  const days = Math.floor(hours / 24);
  return translate({ en: `${days}d ago`, zh: `${days} 天前` }, locale);
}

function isEndpointCheckStale(value?: string | null, now = Date.now()): boolean {
  const parsed = parseBackendIsoDate(value);
  return !parsed || now - parsed.getTime() > ENDPOINT_STATUS_MAX_AGE_MS;
}

function formatEndpointFreshnessWarning(noChecksCount: number, staleCount: number, totalCount: number, locale: UiLanguage = "en"): string {
  const issueCount = noChecksCount + staleCount;
  if (locale === "zh") return `端点状态使用已保存的健康检查采样；${issueCount}/${totalCount} 个端点需要重新检查（${noChecksCount} 个尚无检查，${staleCount} 个检查早于 ${ENDPOINT_STATUS_MAX_AGE_HOURS} 小时前）。仪表板状态可能不代表当前可用性。`;
  const details = [
    noChecksCount > 0 ? `${noChecksCount} without checks` : null,
    staleCount > 0 ? `${staleCount} older than ${ENDPOINT_STATUS_MAX_AGE_HOURS}h` : null,
  ].filter(Boolean);
  return `Endpoint Status uses stored healthcheck samples; ${issueCount}/${totalCount} endpoint(s) need fresh checks (${details.join(
    ", "
  )}). Dashboard statuses may not reflect current availability.`;
}

function formatLatency(value?: number | null): string {
  if (value == null) return "-";
  return `${Math.round(value)} ms`;
}

function formatCheckMode(mode?: string | null): string {
  return (mode || "http").toUpperCase();
}

function computeMeanAvailability(data?: EndpointHealthOverviewResponse | null): number | null {
  const availabilityValues =
    data?.endpoints
      .map((endpoint) => endpoint.availability_pct)
      .filter((value): value is number => value != null && Number.isFinite(value)) ?? [];
  if (availabilityValues.length === 0) return null;
  const totalAvailability = availabilityValues.reduce((total, value) => total + value, 0);
  return Math.round(totalAvailability / availabilityValues.length);
}

function formatAuditAction(log: AuditLogEntry, locale: UiLanguage = "en"): string {
  const rawAction = log.action.replace(/[._-]+/g, " ").trim();
  const actions: Record<string, string> = {
    storage_endpoint_create: "创建存储端点", storage_endpoint_update: "更新存储端点", storage_endpoint_delete: "删除存储端点",
    account_create: "创建账户", account_update: "更新账户", account_delete: "删除账户", account_link_user: "关联用户",
    bucket_list_objects: "列出对象", user_create: "创建用户", user_update: "更新用户", user_delete: "删除用户",
  };
  const action = locale === "zh" ? actions[log.action] ?? rawAction : rawAction;
  const entityLabels: Record<string, string> = { account: "账户", user: "用户", bucket: "存储桶", endpoint: "端点", connection: "连接" };
  if (log.action.includes("login")) return translate({ en: `User ${log.user_email} logged in`, zh: `用户 ${log.user_email} 已登录` }, locale);
  if (log.entity_type === "bucket" && log.entity_id) return translate({ en: `Bucket "${log.entity_id}" ${action}`, zh: `存储桶“${log.entity_id}” ${action}` }, locale);
  if (log.entity_type === "endpoint" && log.entity_id) return translate({ en: `Endpoint ${log.entity_id} ${action}`, zh: `端点 ${log.entity_id} ${action}` }, locale);
  if (log.entity_id) return `${(locale === "zh" ? entityLabels[log.entity_type ?? ""] : undefined) ?? log.entity_type ?? translate(infrastructureMessages.entity, locale)} ${log.entity_id} ${action}`;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function trafficOpsSeries(traffic: AdminTrafficStats | null): number[] {
  return (traffic?.series ?? []).map((point) => point.ops).filter((value): value is number => value != null && Number.isFinite(value));
}

function formatOptionalBytes(value?: number | null): string {
  return value == null ? "" : formatBytes(value);
}

function formatOptionalCompactNumber(value?: number | null): string {
  return value == null ? "" : formatCompactNumber(value);
}

function OnboardingPanel({
  onboarding,
  error,
  dismissBusy,
  onDismiss,
}: {
  onboarding: OnboardingStatus;
  error: string | null;
  dismissBusy: boolean;
  onDismiss: () => void;
}) {
  const { locale } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(!onboarding.complete);

  if (!reviewOpen) {
    return (
      <section className={cx(uiCardClass, "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between")}>
        <div className="min-w-0">
          <h2 className="ui-body font-semibold text-[var(--ui-text)]">
            {onboarding.complete ? translate(infrastructureMessages.storageSetupComplete, locale) : translate(infrastructureMessages.bucketReefIsReady, locale)}
          </h2>
          <p className={cx("mt-0.5 ui-caption", uiMutedTextClass)}>
            {onboarding.complete
              ? translate(infrastructureMessages.aStorageEndpointAndAnActiveStorageAccessContextAre, locale)
              : translate(infrastructureMessages.administratorAccessIsSecuredConnectStorageWhenYouAreReady, locale)}
          </p>
          {error ? <p className="mt-2 ui-caption font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <WorkspaceDashboardAction variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>
            {translate(infrastructureMessages.review, locale)}</WorkspaceDashboardAction>
          <WorkspaceDashboardAction variant="ghost" size="sm" onClick={onDismiss} disabled={dismissBusy} loading={dismissBusy}>
            {translate(infrastructureMessages.dismiss, locale)}</WorkspaceDashboardAction>
        </div>
      </section>
    );
  }

  return (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 w-full flex-1 flex-col gap-4 2xl:flex-row 2xl:items-center">
          <img
            src={setupIllustration}
            alt=""
            className="hidden h-24 w-24 shrink-0 object-contain 2xl:block"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="ui-dashboard-title">
                  {translate(infrastructureMessages.connectYourStorageWhenYouaposreReady, locale)}</h2>
                <p className={cx("mt-1 ui-body", uiMutedTextClass)}>
                  {translate(infrastructureMessages.bucketReefIsReadyTheseOptionalStepsEnableStorageAdministrationAnd, locale)}</p>
              </div>
            </div>
            {error && <p className="mt-3 ui-caption font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
            <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
              <SetupStep
                index={1}
                title={translate(infrastructureMessages.configureAStorageEndpoint, locale)}
                description={translate(infrastructureMessages.addTheS3OrCephEndpointThatBucketReefShouldManage, locale)}
                done={onboarding.endpoint_configured}
                action={{ label: translate(infrastructureMessages.configureEndpoints, locale), to: "/admin/storage-endpoints" }}
              />
              <SetupStep
                index={2}
                title={translate(infrastructureMessages.configureStorageAccess, locale)}
                description={translate(infrastructureMessages.createAnS3AccountOrAnActiveConnectionForStorage, locale)}
                done={onboarding.storage_access_configured}
                action={{ label: translate(infrastructureMessages.configureConnections, locale), to: "/admin/s3-connections" }}
              />
              <div className={cx(uiCardMutedClass, "px-4 py-3 xl:col-span-2 2xl:col-span-1")}>
                <p className="ui-body font-semibold text-[var(--ui-text)]">{translate(infrastructureMessages.nextSteps, locale)}</p>
                <div className="mt-3 space-y-2">
                  <Link to="/admin/users" className="flex items-center gap-2 ui-caption font-medium text-primary">
                    <OpenIcon className="h-3.5 w-3.5" /> {translate(infrastructureMessages.addUIUser, locale)}</Link>
                  <Link to="/admin/s3-accounts" className="flex items-center gap-2 ui-caption font-medium text-primary">
                    <OpenIcon className="h-3.5 w-3.5" /> {translate(infrastructureMessages.createAccount, locale)}</Link>
                  <Link to="/admin/audit" className="flex items-center gap-2 ui-caption font-medium text-primary">
                    <OpenIcon className="h-3.5 w-3.5" /> {translate(infrastructureMessages.viewAuditTrail, locale)}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 self-start lg:self-auto">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceDashboardAction
              type="button"
              onClick={() => setReviewOpen(false)}
              variant="secondary"
            >
              {translate(infrastructureMessages.collapseChecklist, locale)}</WorkspaceDashboardAction>
            <WorkspaceDashboardAction
              type="button"
              onClick={onDismiss}
              disabled={dismissBusy}
              variant="ghost"
            >
              {dismissBusy ? translate(infrastructureMessages.dismissing, locale) : translate(infrastructureMessages.dismissChecklist, locale)}
            </WorkspaceDashboardAction>
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupStep({
  index,
  title,
  description,
  done,
  action,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  action: { label: string; to: string };
}) {
  const { locale } = useI18n();
  return (
    <div className={cx(uiCardMutedClass, "flex min-h-[112px] min-w-0 flex-col justify-between gap-3 px-4 py-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={cx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ui-caption font-semibold",
              done
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950 dark:text-amber-100"
            )}
          >
            {index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words ui-body font-semibold text-[var(--ui-text)]">{title}</span>
            <span className={cx("mt-1 block ui-caption", uiMutedTextClass)}>{description}</span>
          </span>
        </div>
        <UiBadge tone={done ? "success" : "warning"} className="shrink-0">{done ? translate(infrastructureMessages.done, locale) : translate(infrastructureMessages.pending, locale)}</UiBadge>
      </div>
      <WorkspaceDashboardActionLink to={action.to} className="w-fit">
        {action.label}
        <OpenIcon className="h-3.5 w-3.5" />
      </WorkspaceDashboardActionLink>
    </div>
  );
}

function EndpointHealthSection({ data, loading, unavailableReason, freshnessWarning }: {
  data: WorkspaceEndpointHealthOverviewResponse | null;
  loading: boolean;
  unavailableReason?: string | null;
  freshnessWarning: string | null;
}) {
  const { locale } = useI18n();
  const endpoints = unavailableReason ? [] : data?.endpoints.slice(0, MAX_ENDPOINT_ROWS) ?? [];
  return (
    <div className="ui-dashboard-operational-grid">
      <WorkspaceDashboardCard
        title={translate(infrastructureMessages.endpointHealth, locale)}
        presentation="compact"
        action={<WorkspaceDashboardActionLink to="/admin/endpoint-status">{translate(infrastructureMessages.openEndpointStatus, locale)}</WorkspaceDashboardActionLink>}
      >
        <p className="ui-dashboard-note">{translate(infrastructureMessages.storedHealthcheckSamplesAndLatency, locale)}{data && <> {" "}{translate(infrastructureMessages.dataRefreshed, locale)}{" "}{formatLocalDateTime(data.generated_at)}.</>}</p>
        {freshnessWarning && !unavailableReason && <div className="mt-2"><PageBanner tone="warning">{freshnessWarning}</PageBanner></div>}
        {loading ? <p role="status" className="ui-dashboard-note mt-2">{translate(infrastructureMessages.loadingEndpointHealth, locale)}</p> : unavailableReason ? <p role="status" className="ui-dashboard-note mt-2">{unavailableReason}</p> : (
          <>
            <div className="ui-dashboard-badges mt-2">
              <WorkspaceStatusCounter presentation="compact" label={translate({ en: "Up", zh: "正常" }, locale)} value={data?.up_count} status="up" />
              <WorkspaceStatusCounter presentation="compact" label={translate(infrastructureMessages.degraded, locale)} value={data?.degraded_count} status="degraded" />
              <WorkspaceStatusCounter presentation="compact" label={translate(infrastructureMessages.down, locale)} value={data?.down_count} status="down" />
              <WorkspaceStatusCounter presentation="compact" label={translate(infrastructureMessages.unknown, locale)} value={data?.unknown_count} status="unknown" />
            </div>
            <ul className="ui-dashboard-endpoint-list" aria-label={translate(infrastructureMessages.endpointHealthSamples, locale)}>
              {endpoints.map((endpoint) => <EndpointRow key={endpoint.endpoint_id} endpoint={endpoint} />)}
            </ul>
            {(data?.endpoints.length ?? 0) > MAX_ENDPOINT_ROWS && <p className="ui-dashboard-note">+ {(data?.endpoints.length ?? 0) - MAX_ENDPOINT_ROWS} {" "}{translate(infrastructureMessages.moreEndpoints, locale)}</p>}
          </>
        )}
      </WorkspaceDashboardCard>
      <WorkspaceIncidentsCard
        presentation="compact"
        incidents={unavailableReason ? [] : data?.incidents ?? []}
        loading={loading}
        unavailableReason={unavailableReason}
        incidentHighlightMinutes={data?.incident_highlight_minutes}
        action={{ to: "/admin/endpoint-status", label: translate(infrastructureMessages.viewAllIncidents, locale) }}
        showEmptyState
      />
    </div>
  );
}

function EndpointRow({ endpoint }: { endpoint: WorkspaceEndpointHealthEntry }) {
  const { locale } = useI18n();
  const stale = isEndpointCheckStale(endpoint.checked_at);
  const checkedAtLabel = endpoint.checked_at ? translate({ en: `Checked ${formatRelativeTime(endpoint.checked_at, undefined, locale)}`, zh: `检查于 ${formatRelativeTime(endpoint.checked_at, undefined, locale)}` }, locale) : translate(infrastructureMessages.noHealthcheckYet, locale);
  return (
    <li className="ui-dashboard-endpoint-row">
      <span className="ui-dashboard-endpoint-name">
        <WorkspaceStatusDot status={endpoint.status} className="shrink-0" />
        <span title={endpoint.name}>{endpoint.name}</span>
      </span>
      <span className="ui-dashboard-endpoint-measurements">
        <span className="ui-dashboard-note">{formatLatency(endpoint.latency_ms)}</span>
        <span className="ui-dashboard-note">{formatCheckMode(endpoint.check_mode)}</span>
      </span>
      <span className="ui-dashboard-endpoint-check" data-stale={stale} title={formatLocalDateTime(endpoint.checked_at)}>{checkedAtLabel}</span>
      <UiBadge tone={endpoint.status === "up" ? "success" : endpoint.status === "degraded" ? "warning" : endpoint.status === "down" ? "danger" : "neutral"} className="ui-dashboard-badge ui-dashboard-endpoint-state">
        {endpoint.status === "up" ? translate({ en: "Up", zh: "正常" }, locale) : endpoint.status === "degraded" ? translate(infrastructureMessages.degraded, locale) : endpoint.status === "down" ? translate(infrastructureMessages.down, locale) : translate(infrastructureMessages.unknown, locale)}
      </UiBadge>
    </li>
  );
}

function StorageTrafficSummary({
  storage,
  storageLoading,
  storageError,
  traffic,
  trafficLoading,
  trafficError,
  healthScore,
  healthScoreLoading,
  healthScoreUnavailableReason,
}: {
  storage: AdminStorageStats | null;
  storageLoading: boolean;
  storageError: string | null;
  traffic: AdminTrafficStats | null;
  trafficLoading: boolean;
  trafficError: string | null;
  healthScore: number | null;
  healthScoreLoading: boolean;
  healthScoreUnavailableReason?: string | null;
}) {
  const { locale } = useI18n();
  const storageTotals = storage?.storage_totals;
  const requestsSeries = trafficOpsSeries(traffic);
  const storageReason = storageError || (!storageLoading && !storage ? translate(infrastructureMessages.storageMetricsAreNotAvailable, locale) : undefined);
  const trafficReason = trafficError || (!trafficLoading && !traffic ? translate(infrastructureMessages.usageLogsAreNotAvailable, locale) : undefined);
  const metrics: WorkspacePlatformMetric[] = [
    {
      label: translate(infrastructureMessages.buckets, locale),
      value: storageLoading ? "..." : formatOptionalCompactNumber(storageReason ? null : storageTotals?.bucket_count ?? storage?.total_buckets ?? null),
      tone: "blue",

    },
    {
      label: translate(infrastructureMessages.objects, locale),
      value: storageLoading ? "..." : formatOptionalCompactNumber(storageReason ? null : storageTotals?.object_count ?? null),
      tone: "violet",

    },
    {
      label: translate(infrastructureMessages.storedData, locale),
      value: storageLoading ? "..." : formatOptionalBytes(storageReason ? null : storageTotals?.used_bytes ?? null),
      tone: "emerald",

    },
    {
      label: translate(infrastructureMessages.requests24h, locale),
      value: trafficLoading ? "..." : formatOptionalCompactNumber(trafficReason ? null : traffic?.totals.ops ?? null),
      delta: trafficReason ? undefined : traffic?.totals.success_rate != null ? `${formatPercentage(traffic.totals.success_rate * 100)} success` : undefined,
      series: !trafficReason && requestsSeries.length > 0 ? requestsSeries : undefined,
      tone: "blue",

    },
  ];

  return (
    <WorkspaceDashboardCard title={translate(infrastructureMessages.storageTraffic, locale)} presentation="compact">
      <div className="ui-dashboard-metrics">
        {metrics.map((metric) => <WorkspacePlatformMetricCard key={metric.label} metric={metric} />)}
        <WorkspaceAvailabilityMetric score={healthScore} loading={healthScoreLoading} unavailableReason={healthScoreUnavailableReason} />
      </div>
      {storageReason && <p role="status" className="ui-dashboard-note mt-2">{translate(infrastructureMessages.storage, locale)}{" "}{storageReason}</p>}
      {trafficReason && <p role="status" className="ui-dashboard-note mt-2">{translate(infrastructureMessages.traffic, locale)}{" "}{trafficReason}</p>}
    </WorkspaceDashboardCard>
  );
}

function RecentActivityCard({ logs, loading, unavailableReason }: {
  logs: AuditLogEntry[];
  loading: boolean;
  unavailableReason?: string | null;
}) {
  const { locale } = useI18n();
  return (
    <WorkspaceDashboardCard title={translate(infrastructureMessages.recentActivity, locale)} presentation="compact">
      {loading ? <p role="status" className="ui-dashboard-note">{translate(infrastructureMessages.loadingActivity, locale)}</p> : unavailableReason ? <p role="status" className="ui-dashboard-note">{unavailableReason}</p> : logs.length === 0 ? <p className="ui-dashboard-note">{translate(infrastructureMessages.noRecentAuditActivity, locale)}</p> : (
        <ul className="ui-dashboard-activity">
          {logs.slice(0, 3).map((log) => (
            <li key={log.id}>
              <span className="ui-dashboard-note ui-dashboard-activity-text">{formatAuditAction(log, locale)}</span>
              <span className="ui-dashboard-note" title={formatLocalDateTime(log.created_at)}>{formatRelativeTime(log.created_at, undefined, locale)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ui-dashboard-panel-footer">
        <WorkspaceDashboardActionLink to="/admin/audit">{translate(infrastructureMessages.viewAuditLogs, locale)}<OpenIcon className="h-3.5 w-3.5" /></WorkspaceDashboardActionLink>
      </div>
    </WorkspaceDashboardCard>
  );
}

export default function AdminDashboard() {
  const { locale } = useI18n();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [endpointFreshnessWarning, setEndpointFreshnessWarning] = useState<string | null>(null);
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceEndpointHealthOverviewResponse | null>(null);
  const [workspaceHealthLoading, setWorkspaceHealthLoading] = useState(false);
  const [workspaceHealthError, setWorkspaceHealthError] = useState<string | null>(null);
  const [mapEndpoints, setMapEndpoints] = useState<StorageEndpoint[]>([]);
  const [mapEndpointsLoading, setMapEndpointsLoading] = useState(false);
  const [mapEndpointsError, setMapEndpointsError] = useState<string | null>(null);
  const [healthOverview, setHealthOverview] = useState<EndpointHealthOverviewResponse | null>(null);
  const [healthOverviewLoading, setHealthOverviewLoading] = useState(false);
  const [healthOverviewError, setHealthOverviewError] = useState<string | null>(null);
  const [storage, setStorage] = useState<AdminStorageStats | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<AdminTrafficStats | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(true);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [dismissBusy, setDismissBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { generalSettings } = useGeneralSettings();

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetchAdminSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setSummaryError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setSummary(null);
        setSummaryError(extractApiError(err, translate(infrastructureMessages.unableToLoadAdminOverview, locale)));
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, refreshNonce]);

  useEffect(() => {
    let cancelled = false;
    fetchOnboardingStatus()
      .then((data) => {
        if (cancelled) return;
        setOnboarding(data);
        setOnboardingError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setOnboardingError(extractApiError(err, translate(infrastructureMessages.unableToLoadOnboardingStatus, locale)));
      });
    return () => {
      cancelled = true;
    };
  }, [locale, refreshNonce]);

  useEffect(() => {
    if (summaryLoading) return;
    if (!summary || summary.total_endpoints === 0) {
      setStorage(null);
      setStorageError(null);
      setStorageLoading(false);
      return;
    }
    let cancelled = false;
    setStorageLoading(true);
    setStorageError(null);
    fetchAdminStorage()
      .then((data) => {
        if (cancelled) return;
        setStorage(data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setStorage(null);
        setStorageError(extractApiError(err, translate(infrastructureMessages.storageMetricsAreNotAvailable, locale)));
      })
      .finally(() => {
        if (!cancelled) setStorageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, refreshNonce, summary, summaryLoading]);

  useEffect(() => {
    if (summaryLoading) return;
    if (!summary || summary.total_endpoints === 0) {
      setTraffic(null);
      setTrafficError(null);
      setTrafficLoading(false);
      return;
    }
    let cancelled = false;
    setTrafficLoading(true);
    setTrafficError(null);
    fetchAdminTraffic("day")
      .then((data) => {
        if (cancelled) return;
        setTraffic(data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setTraffic(null);
        setTrafficError(extractApiError(err, translate(infrastructureMessages.usageLogsAreNotAvailable, locale)));
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, refreshNonce, summary, summaryLoading]);

  useEffect(() => {
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(null);
    listAuditLogs({ limit: 3 })
      .then((data) => {
        if (cancelled) return;
        setAuditLogs(data.logs ?? []);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setAuditLogs([]);
        setAuditError(extractApiError(err, translate(infrastructureMessages.auditActivityIsNotAvailable, locale)));
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, refreshNonce]);

  useEffect(() => {
    if (!generalSettings.endpoint_status_enabled) {
      setEndpointFreshnessWarning(null);
      setWorkspaceHealth(null);
      setWorkspaceHealthError(null);
      setWorkspaceHealthLoading(false);
      setHealthOverview(null);
      setHealthOverviewError(null);
      setHealthOverviewLoading(false);
      return;
    }
    let cancelled = false;
    const verifyEndpointStatusFreshness = async () => {
      try {
        const data = await fetchHealthSummary();
        if (cancelled) return;
        const endpoints = data.endpoints ?? [];
        if (endpoints.length === 0) {
          setEndpointFreshnessWarning(translate(infrastructureMessages.endpointStatusIsEnabledButNoEndpointHealthcheckDataIs, locale));
          return;
        }
        const now = Date.now();
        let noChecksCount = 0;
        let staleCount = 0;
        for (const endpoint of endpoints) {
          if ((endpoint.error_message ?? "").toLowerCase().includes("no checks yet")) {
            noChecksCount += 1;
            continue;
          }
          const checkedAt = parseBackendIsoDate(endpoint.checked_at);
          if (!checkedAt || now - checkedAt.getTime() > ENDPOINT_STATUS_MAX_AGE_MS) {
            staleCount += 1;
          }
        }
        if (noChecksCount > 0 || staleCount > 0) {
          setEndpointFreshnessWarning(formatEndpointFreshnessWarning(noChecksCount, staleCount, endpoints.length, locale));
          return;
        }
        setEndpointFreshnessWarning(null);
      } catch {
        if (!cancelled) {
          setEndpointFreshnessWarning(translate(infrastructureMessages.endpointStatusIsEnabledButFreshnessCouldNotBeVerified, locale));
        }
      }
    };
    verifyEndpointStatusFreshness();
    return () => {
      cancelled = true;
    };
  }, [generalSettings.endpoint_status_enabled, locale, refreshNonce]);

  useEffect(() => {
    if (!generalSettings.endpoint_status_enabled) return;
    let cancelled = false;
    setWorkspaceHealthLoading(true);
    setWorkspaceHealthError(null);
    fetchHealthWorkspaceOverview(undefined, ADMIN_INCIDENT_HISTORY_MINUTES)
      .then((data) => {
        if (cancelled) return;
        setWorkspaceHealth(data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setWorkspaceHealth(null);
        setWorkspaceHealthError(extractApiError(err, translate(infrastructureMessages.unableToLoadWorkspaceEndpointHealth, locale)));
      })
      .finally(() => {
        if (!cancelled) {
          setWorkspaceHealthLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [generalSettings.endpoint_status_enabled, locale, refreshNonce]);

  useEffect(() => {
    if (!generalSettings.endpoint_status_enabled) {
      setMapEndpoints([]);
      setMapEndpointsError(null);
      setMapEndpointsLoading(false);
      return;
    }
    let cancelled = false;
    setMapEndpointsLoading(true);
    setMapEndpointsError(null);
    listStorageEndpoints()
      .then((data) => {
        if (cancelled) return;
        setMapEndpoints(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setMapEndpoints([]);
        setMapEndpointsError(extractApiError(err, translate(infrastructureMessages.unableToLoadEndpointMapCoordinates, locale)));
      })
      .finally(() => {
        if (!cancelled) {
          setMapEndpointsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [generalSettings.endpoint_status_enabled, locale, refreshNonce]);

  useEffect(() => {
    if (!generalSettings.endpoint_status_enabled) return;
    let cancelled = false;
    setHealthOverviewLoading(true);
    setHealthOverviewError(null);
    fetchHealthOverview("week")
      .then((data) => {
        if (cancelled) return;
        setHealthOverview(data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        setHealthOverview(null);
        setHealthOverviewError(extractApiError(err, "7-day endpoint health history is not available."));
      })
      .finally(() => {
        if (!cancelled) {
          setHealthOverviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [generalSettings.endpoint_status_enabled, refreshNonce]);

  const handleDismissOnboarding = async () => {
    if (!onboarding) return;
    setDismissBusy(true);
    try {
      const data = await dismissOnboarding();
      setOnboarding(data);
    } catch (err) {
      setOnboardingError(extractApiError(err, translate(infrastructureMessages.unableToDismissOnboardingYet, locale)));
    } finally {
      setDismissBusy(false);
    }
  };

  const coreFeatures = useMemo<WorkspaceDashboardFeature[]>(
    () => [
      { id: "manager", label: translate(infrastructureMessages.manager, locale), enabled: generalSettings.manager_enabled },
      { id: "browser", label: translate(infrastructureMessages.browser, locale), enabled: generalSettings.browser_enabled },
      { id: "portal", label: translate(infrastructureMessages.portal, locale), enabled: generalSettings.portal_enabled },
      { id: "ceph_admin", label: translate(infrastructureMessages.cephAdmin, locale), enabled: generalSettings.ceph_admin_enabled, massManagement: true },
      { id: "storage_ops", label: translate(infrastructureMessages.storageOps, locale), enabled: generalSettings.storage_ops_enabled, massManagement: true },
    ],
    [generalSettings.browser_enabled, generalSettings.ceph_admin_enabled, generalSettings.manager_enabled, generalSettings.portal_enabled, generalSettings.storage_ops_enabled, locale]
  );

  const extraFeatures = useMemo<WorkspaceDashboardFeature[]>(
    () => [
      { id: "billing", label: translate(infrastructureMessages.billing, locale), enabled: generalSettings.billing_enabled },
      { id: "endpoint_status", label: translate(infrastructureMessages.endpointStatus, locale), enabled: generalSettings.endpoint_status_enabled },
      { id: "quota_alerts", label: translate(infrastructureMessages.quotaAlerts, locale), enabled: generalSettings.quota_alerts_enabled },
      { id: "usage_history", label: translate(infrastructureMessages.usageHistory, locale), enabled: generalSettings.usage_history_enabled },
    ],
    [generalSettings.billing_enabled, generalSettings.endpoint_status_enabled, generalSettings.quota_alerts_enabled, generalSettings.usage_history_enabled, locale]
  );

  const featureGroups = useMemo<WorkspaceDashboardFeatureGroup[]>(
    () => [
      { title: translate(infrastructureMessages.coreFeatures, locale), features: coreFeatures },
      { title: translate(infrastructureMessages.extraFeatures, locale), features: extraFeatures },
    ],
    [coreFeatures, extraFeatures, locale]
  );

  const administrationItems = useMemo<WorkspaceDashboardSummaryItem[]>(() => {
    const totalUiUsers = (summary?.total_users ?? 0) + (summary?.total_admins ?? 0) + (summary?.total_none_users ?? 0);
    return [
      {
        id: "ui-users",
        label: translate(infrastructureMessages.uIUsers, locale),
        value: totalUiUsers,
        hint: translate({ en: `Admins: ${summary?.total_admins ?? 0}  Users: ${summary?.total_users ?? 0}`, zh: `管理员：${summary?.total_admins ?? 0}  用户：${summary?.total_users ?? 0}` }, locale),
        to: "/admin/users",
      },
      {
        id: "active-sessions",
        label: translate(infrastructureMessages.activeSessions, locale),
        value: summary?.total_active_sessions ?? 0,
        hint: `UI: ${summary?.active_sessions_by_type?.ui ?? 0} · S3: ${summary?.active_sessions_by_type?.s3 ?? 0}`,
        to: "/admin/identity-security",
      },
      {
        id: "accounts-primary",
        label: translate(infrastructureMessages.accounts, locale),
        value: summary?.total_accounts ?? 0,
        hint: translate({ en: `Assigned: ${summary?.assigned_accounts ?? 0}`, zh: `已分配：${summary?.assigned_accounts ?? 0}` }, locale),
        to: "/admin/s3-accounts",
      },
      {
        id: "s3-users",
        label: translate({ en: "S3 Users", zh: "S3 用户" }, locale),
        value: summary?.total_s3_users ?? 0,
        hint: translate({ en: `Assigned: ${summary?.assigned_s3_users ?? 0}`, zh: `已分配：${summary?.assigned_s3_users ?? 0}` }, locale),
        to: "/admin/s3-users",
      },
      {
        id: "shared-s3-connections",
        label: translate(infrastructureMessages.sharedS3Connections, locale),
        value: summary?.total_shared_connections ?? 0,
        hint: translate(infrastructureMessages.adminmanaged, locale),
        to: "/admin/s3-connections",
      },
      {
        id: "endpoints",
        label: translate(infrastructureMessages.endpoints, locale),
        value: summary?.total_endpoints ?? 0,
        hint: translate({ en: `Ceph: ${summary?.total_ceph_endpoints ?? 0}  Other: ${summary?.total_other_endpoints ?? 0}`, zh: `Ceph：${summary?.total_ceph_endpoints ?? 0}  其他：${summary?.total_other_endpoints ?? 0}` }, locale),
        to: "/admin/storage-endpoints",
      },
    ];
  }, [locale, summary?.active_sessions_by_type?.s3, summary?.active_sessions_by_type?.ui, summary?.assigned_accounts, summary?.assigned_s3_users, summary?.total_accounts, summary?.total_active_sessions, summary?.total_admins, summary?.total_ceph_endpoints, summary?.total_endpoints, summary?.total_none_users, summary?.total_other_endpoints, summary?.total_s3_users, summary?.total_shared_connections, summary?.total_users]);

  const mapMarkers = useMemo<AdminDashboardMapMarker[]>(() => {
    const statusByEndpointId = new Map<number, HealthCheckStatus>();
    workspaceHealth?.endpoints.forEach((endpoint) => {
      statusByEndpointId.set(endpoint.endpoint_id, endpoint.status);
    });
    return mapEndpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      latitude: endpoint.latitude,
      longitude: endpoint.longitude,
      status: statusByEndpointId.get(endpoint.id) ?? "unknown",
    }));
  }, [mapEndpoints, workspaceHealth]);

  const endpointUnavailableReason = !generalSettings.endpoint_status_enabled
    ? translate(infrastructureMessages.endpointStatusFeatureIsDisabled, locale)
    : workspaceHealthError
      ? workspaceHealthError
      : !workspaceHealthLoading && workspaceHealth && workspaceHealth.endpoint_count === 0
        ? translate(infrastructureMessages.endpointStatusHasNoEndpointDataYet, locale)
        : null;
  const healthScore = computeMeanAvailability(healthOverview);
  const healthScoreUnavailableReason =
    (!generalSettings.endpoint_status_enabled ? translate(infrastructureMessages.endpointStatusFeatureIsDisabled, locale) : null) ||
    healthOverviewError ||
    (healthScore == null && !healthOverviewLoading ? "7-day endpoint health history is not available." : null);
  const refreshing =
    summaryLoading ||
    storageLoading ||
    trafficLoading ||
    auditLoading ||
    workspaceHealthLoading ||
    healthOverviewLoading ||
    mapEndpointsLoading;

  return (
    <div className="ui-dashboard-compact" data-testid="admin-dashboard">
      <PageHeader
        title={translate(infrastructureMessages.adminOverview, locale)}
        description={translate(infrastructureMessages.monitorTheHealthAndStatusOfYourS3Infrastructure, locale)}
        breadcrumbs={adminPageBreadcrumbs("dashboard", locale)}
        rightContent={
          <div className="flex items-center gap-3">
            <span title={translate(infrastructureMessages.lastDataUpdateHealthcheckSamplesRetainTheirOwnTimestamps, locale)} className={cx("hidden ui-caption sm:inline", uiMutedTextClass)}>
              {translate(infrastructureMessages.updated, locale)}{lastUpdated ? formatLocalDateTime(lastUpdated) : "-"}
            </span>
            <WorkspaceDashboardAction
              type="button"
              onClick={() => setRefreshNonce((current) => current + 1)}
              aria-label={translate(infrastructureMessages.refreshAdminDashboard, locale)}
              title={translate(infrastructureMessages.refresh, locale)}
              variant="secondary"
              className="ui-dashboard-action-icon"
              disabled={refreshing}
            >
              <RefreshIcon className={cx("h-4 w-4", refreshing && "animate-spin")} />
            </WorkspaceDashboardAction>
          </div>
        }
      />

      {onboarding && !onboarding.dismissed && (
        <OnboardingPanel
          onboarding={onboarding}
          error={onboardingError}
          dismissBusy={dismissBusy}
          onDismiss={handleDismissOnboarding}
        />
      )}

      <EndpointHealthSection
        data={workspaceHealth}
        loading={workspaceHealthLoading}
        unavailableReason={endpointUnavailableReason}
        freshnessWarning={endpointFreshnessWarning}
      />
      <StorageTrafficSummary
        storage={storage}
        storageLoading={storageLoading}
        storageError={storageError}
        traffic={traffic}
        trafficLoading={trafficLoading}
        trafficError={trafficError}
        healthScore={healthScore}
        healthScoreLoading={healthOverviewLoading}
        healthScoreUnavailableReason={healthScoreUnavailableReason}
      />
      <WorkspaceDashboardSummary items={administrationItems} loading={summaryLoading} unavailableReason={summaryError} />
      <div className="ui-dashboard-secondary-grid">
        <RecentActivityCard logs={auditLogs} loading={auditLoading} unavailableReason={auditError} />
        {generalSettings.endpoint_status_enabled && <AdminDashboardMap markers={mapMarkers} loading={mapEndpointsLoading} error={mapEndpointsError} />}
      </div>
      <WorkspaceDashboardCard title={translate(infrastructureMessages.enabledFeatures, locale)} presentation="compact">
        <div className="ui-dashboard-features">
          {featureGroups.map((group) => <WorkspaceFeatureSummary key={group.title} group={group} />)}
        </div>
      </WorkspaceDashboardCard>
    </div>
  );
}
