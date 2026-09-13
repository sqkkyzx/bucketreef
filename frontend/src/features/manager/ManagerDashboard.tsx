/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBuckets } from "../../api/managerBuckets";
import type { Bucket } from "../../api/bucketContracts";
import {
  getManagerUsageStatsAggregate,
  type BucketUsageStatsAggregate,
} from "../../api/bucketUsageStats";
import {
  fetchManagerWorkspaceHealthOverview,
  type HealthCheckStatus,
  type WorkspaceEndpointHealthEntry,
  type WorkspaceEndpointHealthOverviewResponse,
  type WorkspaceEndpointIncidentEntry,
} from "../../api/healthchecks";
import { listManagerActivity, type ManagerActivityEntry } from "../../api/managerActivity";
import { fetchManagerContext, type ManagerContext } from "../../api/managerContext";
import {
  fetchManagerTraffic,
  fetchManagerUsageTrends,
  type ManagerTrafficStats,
  type ManagerUsageTrendBaseline,
  type ManagerUsageTrendsResponse,
  type TrafficWindow,
} from "../../api/stats";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import PageHeader from "../../components/PageHeader";
import {
  buildWorkspaceStorageEvolutionPoints,
  WorkspaceDashboardIconBubble as IconBubble,
  WorkspaceDashboardKpiRow as KpiRow,
  WorkspaceDashboardProgressBar as ProgressBar,
  WorkspaceDashboardStorageOverview,
  WorkspaceDashboardAction,
  WorkspaceDashboardActionLink,
  WorkspaceDashboardLinkRow,
  WorkspaceDashboardUnavailableFrame as DashboardUnavailable,
  WorkspaceStatusDot,
  type WorkspaceDashboardTone as DashboardTone,
} from "../../components/WorkspaceDashboardKit";
import {
  WORKSPACE_TRAFFIC_TREND_WINDOWS as TRAFFIC_TREND_WINDOWS,
  buildWorkspaceDashboardKpis,
  formatWorkspaceProjectedFull,
  formatWorkspaceSignedBytesDelta,
  selectWorkspaceTrafficTrend,
  workspaceStorageGrowthDelta,
  type WorkspaceTrafficTrendSelection,
} from "../../components/workspaceDashboardKpis";
import UiBadge from "../../components/ui/UiBadge";
import {
  cx,
  uiCardClass,
  uiMutedTextClass,
} from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { formatLocalDateTime } from "../../utils/dateTime";
import { formatBytes, formatPercentage, formatSpacedCompactNumber } from "../../utils/format";
import {
  BellIcon,
  BucketCollectionIcon,
  BucketIcon,
  FileIcon,
  FolderPlusIcon,
  GroupIcon,
  HistoryIcon,
  InfoIcon,
  OpenIcon,
  RefreshIcon,
  ShieldIcon,
  TransferIcon,
  UploadIcon,
  UserIcon,
} from "../browser/browserIcons";
import { formatAccountLabel } from "../shared/storageEndpointLabel";
import { BucketUsageStatsDataTypesCard } from "../shared/BucketUsageStatsVisuals";
import { useIamOverview } from "./useIamOverview";
import { useManagerStats } from "./useManagerStats";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import {
  formatManagerMessage,
  managerDashboardZhMessages,
} from "./managerDashboardMessages";
import { useManagerText } from "./managerI18n";

type BucketRankingRow = {
  name: string;
  storageBytes: number | null;
  objectCount: number | null;
  percent: number;
};

type ActivityRow = {
  id: number;
  label: string;
  detail: string;
  time: string;
  tone: DashboardTone;
  icon: ReactNode;
};

type QuickAction = {
  label: string;
  to: string;
  icon: ReactNode;
  tone: DashboardTone;
  unavailableReason?: string | null;
};

type ManagerText = (message: string) => string;

function percent(used?: number | null, quota?: number | null): number | null {
  if (used == null || quota == null || quota <= 0) return null;
  return Math.max(0, Math.min(100, (used / quota) * 100));
}

function formatRelativeTime(value: string | null | undefined, t: ManagerText, now = Date.now()): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const diffMs = Math.max(0, now - parsed.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return formatManagerMessage(t("{count}m ago"), { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatManagerMessage(t("{count}h ago"), { count: hours });
  const days = Math.floor(hours / 24);
  return formatManagerMessage(t("{count}d ago"), { count: days });
}

function formatOptionalBytes(value?: number | null): string {
  return value == null ? "" : formatBytes(value);
}

function formatLatency(value?: number | null): string {
  if (value == null) return "-";
  return `${Math.round(value)} ms`;
}

function formatQuotaStatusValue(
  used: number | null | undefined,
  quota: number | null | undefined,
  formatter: (value: number) => string
): string {
  if (used == null) return "";
  const usableQuota = quota != null && quota > 0 ? quota : null;
  return usableQuota == null ? formatter(used) : `${formatter(used)} / ${formatter(usableQuota)}`;
}

function formatStatus(status: HealthCheckStatus, t: ManagerText): string {
  if (status === "up") return t("Operational");
  if (status === "degraded") return t("Degraded");
  if (status === "down") return t("Down");
  return t("Unknown");
}

function normalizeActionLabel(action: string): string {
  return action
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function activityPresentation(log: ManagerActivityEntry, t: ManagerText): { label: string; tone: DashboardTone; icon: ReactNode } {
  const action = log.action.toLowerCase();
  const entityType = (log.entity_type ?? "").toLowerCase();
  if (entityType === "bucket" || action.includes("bucket")) {
    return { label: bucketActionLabel(action, t), tone: "emerald", icon: <BucketIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("user") || action.includes("iam_user") || action.includes("access_key")) {
    return { label: iamActionLabel(action, "IAM user", t), tone: "blue", icon: <UserIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("group") || action.includes("iam_group")) {
    return { label: iamActionLabel(action, "IAM group", t), tone: "emerald", icon: <GroupIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("role") || action.includes("iam_role")) {
    return { label: iamActionLabel(action, "IAM role", t), tone: "amber", icon: <ShieldIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("policy") || action.includes("policy")) {
    return { label: iamActionLabel(action, "Policy", t), tone: "violet", icon: <FileIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("topic") || action.includes("topic")) {
    return { label: genericEntityActionLabel(action, "Topic", t), tone: "emerald", icon: <BellIcon className="h-4 w-4" /> };
  }
  if (action.includes("migration")) {
    return { label: genericEntityActionLabel(action, "Migration", t), tone: "violet", icon: <HistoryIcon className="h-4 w-4" /> };
  }
  if (entityType.includes("object") || action.includes("object")) {
    return { label: genericEntityActionLabel(action, "Object", t), tone: "amber", icon: <UploadIcon className="h-4 w-4" /> };
  }
  return { label: normalizeActionLabel(log.action), tone: "blue", icon: <InfoIcon className="h-4 w-4" /> };
}

function bucketActionLabel(action: string, t: ManagerText): string {
  if (action.includes("create")) return t("Bucket created");
  if (action.includes("delete")) return t("Bucket deleted");
  if (action.includes("lifecycle")) return t("Lifecycle updated");
  if (action.includes("versioning")) return t("Versioning updated");
  if (action.includes("notification")) return t("Notifications updated");
  if (action.includes("replication")) return t("Replication updated");
  if (action.includes("policy")) return t("Bucket policy updated");
  if (action.includes("tag")) return t("Bucket tags updated");
  if (action.includes("quota")) return t("Bucket quota updated");
  if (action.includes("compare")) return t("Bucket compare updated");
  return t("Bucket updated");
}

function iamActionLabel(action: string, entityLabel: string, t: ManagerText): string {
  const entity = t(entityLabel);
  if (action.includes("create")) return formatManagerMessage(t("{entity} created"), { entity });
  if (action.includes("delete")) return formatManagerMessage(t("{entity} deleted"), { entity });
  if (action.includes("attach")) return formatManagerMessage(t("{entity} policy attached"), { entity });
  if (action.includes("detach")) return formatManagerMessage(t("{entity} policy detached"), { entity });
  if (action.includes("status")) return formatManagerMessage(t("{entity} status updated"), { entity });
  if (action.includes("key")) return formatManagerMessage(t("{entity} key updated"), { entity });
  if (action.includes("policy")) return formatManagerMessage(t("{entity} policy updated"), { entity });
  return formatManagerMessage(t("{entity} updated"), { entity });
}

function genericEntityActionLabel(action: string, entityLabel: string, t: ManagerText): string {
  const entity = t(entityLabel);
  if (action.includes("create")) return formatManagerMessage(t("{entity} created"), { entity });
  if (action.includes("delete")) return formatManagerMessage(t("{entity} deleted"), { entity });
  return formatManagerMessage(t("{entity} updated"), { entity });
}

function buildActivityRows(logs: ManagerActivityEntry[], t: ManagerText): ActivityRow[] {
  return logs.map((log) => {
    const presentation = activityPresentation(log, t);
    return {
      id: log.id,
      ...presentation,
      detail: log.entity_id || log.account_name || log.user_email,
      time: formatRelativeTime(log.created_at, t),
    };
  });
}

function StorageOverviewCard({
  usedBytes,
  quotaBytes,
  trendBaseline,
  referenceDate,
  unavailableReason,
}: {
  usedBytes: number | null;
  quotaBytes: number | null;
  trendBaseline?: ManagerUsageTrendBaseline | null;
  referenceDate?: string | Date | null;
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const usagePercent = unavailableReason ? null : percent(usedBytes, quotaBytes);
  const storageValue = unavailableReason ? "" : formatOptionalBytes(usedBytes);
  const quotaValue = unavailableReason || quotaBytes == null ? "" : formatBytes(quotaBytes);
  const chartPoints = useMemo(
    () => (unavailableReason ? [] : buildWorkspaceStorageEvolutionPoints(usedBytes, trendBaseline, referenceDate)),
    [referenceDate, trendBaseline, unavailableReason, usedBytes]
  );
  const growthDelta = workspaceStorageGrowthDelta(usedBytes, trendBaseline);
  const growthToneClass =
    growthDelta == null || growthDelta === 0
      ? "text-[var(--ui-text-muted)]"
      : growthDelta > 0
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-rose-600 dark:text-rose-300";
  const growthLabel = trendBaseline?.label
    ? formatManagerMessage(t("Growth ({period})"), { period: t(trendBaseline.label) })
    : t("Growth");
  const projectedFull = formatWorkspaceProjectedFull(usedBytes, quotaBytes, trendBaseline, {
    full: t("Full"),
    stable: t("Stable"),
    days: (count) => formatManagerMessage(t("~{count} days"), { count }),
    months: (count) => formatManagerMessage(t("~{count} months"), { count }),
    years: (count) => formatManagerMessage(t("~{count} years"), { count }),
  });
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      <WorkspaceDashboardStorageOverview
        title={<span className="flex items-center gap-1.5">{t("Storage overview")}<InfoIcon className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)]" /></span>}
        action={<WorkspaceDashboardActionLink to="/manager/metrics">{t("Usage analytics")}<OpenIcon className="h-3.5 w-3.5" /></WorkspaceDashboardActionLink>}
        usedLabel={t("Storage Used")}
        usedValue={storageValue}
        quotaValue={quotaValue}
        percentage={usagePercent}
        percentageLabel={usagePercent == null ? "" : formatPercentage(usagePercent)}
        chart={{ points: chartPoints }}
        growth={{ label: growthLabel, value: formatWorkspaceSignedBytesDelta(growthDelta), className: growthToneClass }}
        projection={{ label: t("Projected full"), value: projectedFull, adornment: <InfoIcon className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)]" /> }}
      />
    </DashboardUnavailable>
  );
}

function TopBucketsCard({
  rows,
  unavailableReason,
}: {
  rows: BucketRankingRow[];
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <div className="ui-dashboard-panel-heading">
        <h2 className="ui-dashboard-title">{t("Top buckets by storage")}</h2>
        <WorkspaceDashboardActionLink to="/manager/buckets">
          {t("View all buckets")}
          <OpenIcon className="h-3.5 w-3.5" />
        </WorkspaceDashboardActionLink>
      </div>
      <div className="mt-3 ui-dashboard-ranking-row ui-dashboard-note">
        <span>{t("Bucket")}</span>
        <span>{t("Storage")}</span>
        <span className="text-right">{t("Objects")}</span>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div
            key={row.name}
            className="ui-dashboard-ranking-row"
          >
            <div className="flex min-w-0 items-center gap-2">
              <IconBubble tone="emerald" className="h-6 w-6 rounded-md">
                <BucketIcon className="h-3.5 w-3.5" />
              </IconBubble>
              <span className="ui-dashboard-label">{row.name}</span>
            </div>
            <div className="ui-dashboard-ranking-storage">
              <span className="ui-dashboard-label">{formatBytes(row.storageBytes)}</span>
              <ProgressBar value={row.percent} className="h-1.5" />
            </div>
            <span className="text-right ui-dashboard-label">
              {formatSpacedCompactNumber(row.objectCount)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function RecentActivityCard({
  rows,
  loading,
  unavailableReason,
}: {
  rows: ActivityRow[];
  loading: boolean;
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <div className="ui-dashboard-panel-heading">
        <h2 className="ui-dashboard-title">{t("Recent activity")}</h2>
        <span className="inline-flex items-center gap-2 ui-caption font-semibold text-primary">
          {t("View all")}
          <OpenIcon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-8 animate-pulse rounded-md bg-[var(--ui-surface-muted)]" />
            ))}
          </div>
        ) : rows.length === 0 && !unavailableReason ? (
          <div className="rounded-md border border-dashed border-[color:var(--ui-border-soft)] px-3 py-6 text-center ui-caption text-[var(--ui-text-muted)]">
            {t("No recent activity.")}
          </div>
        ) : (
          rows.map((activity) => (
            <div key={activity.id} className="ui-dashboard-activity-row">
              <div className="flex min-w-0 items-start gap-2.5">
                <IconBubble tone={activity.tone} className="h-7 w-7 rounded-md">
                  {activity.icon}
                </IconBubble>
                <div className="min-w-0">
                  <p className="ui-dashboard-label">{activity.label}</p>
                  <p className={cx("mt-0.5 ui-dashboard-note", uiMutedTextClass)}>{activity.detail}</p>
                </div>
              </div>
              <span className={cx("shrink-0 ui-caption", uiMutedTextClass)}>{activity.time}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function QuotaStatusCard({
  storageUsed,
  storageQuota,
  objectCount,
  objectQuota,
  bucketCount,
  bucketQuota,
  userCount,
  userQuota,
  roleCount,
  roleQuota,
  groupCount,
  groupQuota,
  unavailableReason,
  bucketUnavailableReason,
  iamUnavailableReason,
}: {
  storageUsed: number | null;
  storageQuota: number | null;
  objectCount: number | null;
  objectQuota: number | null;
  bucketCount: number | null;
  bucketQuota: number | null;
  userCount: number | null;
  userQuota: number | null;
  roleCount: number | null;
  roleQuota: number | null;
  groupCount: number | null;
  groupQuota: number | null;
  unavailableReason?: string | null;
  bucketUnavailableReason?: string | null;
  iamUnavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const visibleStorageUsed = unavailableReason ? null : storageUsed;
  const visibleStorageQuota = unavailableReason ? null : storageQuota;
  const visibleObjectCount = unavailableReason ? null : objectCount;
  const visibleObjectQuota = unavailableReason ? null : objectQuota;
  const visibleBucketCount = bucketUnavailableReason ? null : bucketCount;
  const visibleBucketQuota = bucketUnavailableReason ? null : bucketQuota;
  const visibleUserCount = iamUnavailableReason ? null : userCount;
  const visibleUserQuota = iamUnavailableReason ? null : userQuota;
  const visibleRoleCount = iamUnavailableReason ? null : roleCount;
  const visibleRoleQuota = iamUnavailableReason ? null : roleQuota;
  const visibleGroupCount = iamUnavailableReason ? null : groupCount;
  const visibleGroupQuota = iamUnavailableReason ? null : groupQuota;
  const storagePercent = percent(visibleStorageUsed, visibleStorageQuota);
  const objectPercent = percent(visibleObjectCount, visibleObjectQuota);
  const bucketStatusPercent = percent(visibleBucketCount, visibleBucketQuota);
  const userPercent = percent(visibleUserCount, visibleUserQuota);
  const rolePercent = percent(visibleRoleCount, visibleRoleQuota);
  const groupPercent = percent(visibleGroupCount, visibleGroupQuota);
  const rows = [
    {
      label: t("Storage"),
      value: formatQuotaStatusValue(visibleStorageUsed, visibleStorageQuota, formatBytes),
      percent: storagePercent,
      tone: "blue" as DashboardTone,
      icon: <BucketIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t("Buckets"),
      value: formatQuotaStatusValue(visibleBucketCount, visibleBucketQuota, formatSpacedCompactNumber),
      percent: bucketStatusPercent,
      tone: "emerald" as DashboardTone,
      icon: <BucketCollectionIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t("Objects"),
      value: formatQuotaStatusValue(visibleObjectCount, visibleObjectQuota, formatSpacedCompactNumber),
      percent: objectPercent,
      tone: "violet" as DashboardTone,
      icon: <FileIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t("Users"),
      value: formatQuotaStatusValue(visibleUserCount, visibleUserQuota, formatSpacedCompactNumber),
      percent: userPercent,
      tone: "blue" as DashboardTone,
      icon: <UserIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t("Roles"),
      value: formatQuotaStatusValue(visibleRoleCount, visibleRoleQuota, formatSpacedCompactNumber),
      percent: rolePercent,
      tone: "amber" as DashboardTone,
      icon: <ShieldIcon className="h-3.5 w-3.5" />,
    },
    {
      label: t("Groups"),
      value: formatQuotaStatusValue(visibleGroupCount, visibleGroupQuota, formatSpacedCompactNumber),
      percent: groupPercent,
      tone: "emerald" as DashboardTone,
      icon: <GroupIcon className="h-3.5 w-3.5" />,
    },
  ];
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <h2 className="ui-dashboard-title">{t("Quota status")}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="relative" data-quota-status-row={row.label}>
            <div className="ui-dashboard-quota-row">
              <div className="flex min-w-0 items-center gap-2">
                <IconBubble tone={row.tone} className="h-6 w-6 rounded-md">
                  {row.icon}
                </IconBubble>
                <span className="ui-dashboard-label">{row.label}</span>
              </div>
              <div>
                <p className="ui-dashboard-label">{row.value}</p>
                {row.percent != null && <ProgressBar value={row.percent} className="mt-1 h-1.5" />}
              </div>
              <span className="text-right ui-dashboard-label">
                {row.percent == null ? "" : formatPercentage(row.percent)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  const { t } = useManagerText(managerDashboardZhMessages);
  return (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <h2 className="ui-dashboard-title">{t("Quick actions")}</h2>
      <div className="mt-3 grid grid-cols-1 gap-2" data-testid="manager-dashboard-quick-actions-list">
        {actions.map((action) => {
          const content = <>
            <span className="flex min-w-0 items-center gap-2">
              <IconBubble tone={action.tone} className="h-6 w-6 rounded-md">{action.icon}</IconBubble>
              <span>{action.label}</span>
            </span>
            <OpenIcon className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)]" />
          </>;
          return action.unavailableReason ? (
            <span key={action.label} className="ui-dashboard-link-row" aria-disabled="true" title={action.unavailableReason}>{content}</span>
          ) : (
            <WorkspaceDashboardLinkRow key={action.label} to={action.to}>{content}</WorkspaceDashboardLinkRow>
          );
        })}
      </div>
    </section>
  );
}

function AccessManagementCard({
  counts,
  unavailableReason,
}: {
  counts: Array<{ label: string; value: number | null; to: string; tone: DashboardTone; icon: ReactNode }>;
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <h2 className="ui-dashboard-title">{t("Access management")}</h2>
      <div className="mt-3 divide-y divide-[color:var(--ui-border-soft)]">
        {counts.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="ui-dashboard-text-link w-full flex-wrap justify-between gap-2 py-1"
          >
            <span className="flex min-w-0 items-center gap-3">
              <IconBubble tone={item.tone} className="h-7 w-7 rounded-md">
                {item.icon}
              </IconBubble>
              <span className="ui-dashboard-label">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-5">
              <span className={cx("ui-caption font-semibold", uiMutedTextClass)}>{item.value == null ? "" : item.value.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1 ui-dashboard-note text-primary">
                {t("View all")}
                <OpenIcon className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function BackendHealthCard({
  endpoint,
  unavailableReason,
}: {
  endpoint?: WorkspaceEndpointHealthEntry | null;
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const showEndpoint = !unavailableReason && endpoint;
  const stale = showEndpoint ? endpoint.is_stale === true : false;
  const healthStatus = showEndpoint ? (stale ? "unknown" : endpoint.status) : "unknown";
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel")}>
      <div className="flex items-center gap-1.5">
        <h2 className="ui-dashboard-title">{t("Storage backend health")}</h2>
        <InfoIcon className="h-3.5 w-3.5 text-[var(--ui-text-muted)]" />
      </div>
      <div className="mt-3 rounded-md border border-[color:var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5">
        {showEndpoint ? (
          <div className="ui-dashboard-panel-heading">
            <p className="flex min-w-0 items-center gap-2 ui-dashboard-label">
              <WorkspaceStatusDot status={healthStatus} />
              <span className="min-w-0 break-words">{endpoint.name}</span>
            </p>
            <UiBadge tone={healthStatus === "up" ? "success" : healthStatus === "down" ? "danger" : "warning"} className="ui-dashboard-badge">
              {stale ? t("Stale") : formatStatus(healthStatus, t)}
            </UiBadge>
          </div>
        ) : (
          <div className="min-h-5" aria-hidden="true" />
        )}
        <div className="mt-3 space-y-2">
          <HealthValue label={t("Latency (avg)")} value={showEndpoint ? formatLatency(endpoint.latency_ms) : ""} />
          <HealthValue label={t("Last check")} value={showEndpoint ? formatLocalDateTime(endpoint.checked_at) : ""} />
        </div>
      </div>
      <WorkspaceDashboardActionLink to="/manager/metrics" className="mt-2.5">
        {t("View details")}
        <OpenIcon className="h-3.5 w-3.5" />
      </WorkspaceDashboardActionLink>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function HealthValue({
  label,
  value,
}: {
  label: string;
  value: string;
  unavailableReason?: string | null;
}) {
  return (
    <div>
      <div className="ui-dashboard-panel-heading">
        <span className="ui-dashboard-label">{label}</span>
        <span className="ui-dashboard-label">{value}</span>
      </div>
    </div>
  );
}

function IncidentStrip({
  incidents,
  unavailableReason,
}: {
  incidents: WorkspaceEndpointIncidentEntry[];
  unavailableReason?: string | null;
}) {
  const { t } = useManagerText(managerDashboardZhMessages);
  const incident = incidents.find((item) => item.ongoing) ?? incidents[0] ?? null;
  const hasRealIncident = incidents.length > 0 && !unavailableReason;
  const content = (
    <section className={cx(uiCardClass, "ui-dashboard-panel ui-dashboard-panel-heading")}>
      <div className="min-w-0">
        <h2 className="ui-dashboard-title">{t("Ongoing / Recent incidents")}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {hasRealIncident && incident ? (
            <>
              <span className="flex items-center gap-2 ui-dashboard-label">
                <span className={cx("h-2.5 w-2.5 rounded-full", incident.ongoing ? "bg-amber-500" : "bg-emerald-500")} />
                {incident.endpoint_name}
              </span>
              <UiBadge tone={incident.ongoing ? "warning" : "success"} className="ui-dashboard-badge">
                {incident.ongoing ? t("In progress") : t("Resolved")}
              </UiBadge>
              <span className={cx("ui-caption", uiMutedTextClass)}>
                {incident.ongoing ? t("Ongoing since") : t("Resolved")} {formatLocalDateTime(incident.start)}
              </span>
            </>
          ) : !unavailableReason ? (
            <span className={cx("ui-caption", uiMutedTextClass)}>{t("No ongoing or recent incidents.")}</span>
          ) : (
            <span className="min-h-4" aria-hidden="true" />
          )}
        </div>
      </div>
      <WorkspaceDashboardActionLink to="/manager/metrics">
        {t("View all incidents")}
        <OpenIcon className="h-3.5 w-3.5" />
      </WorkspaceDashboardActionLink>
    </section>
  );
  return (
    <DashboardUnavailable reason={unavailableReason ? t(unavailableReason) : unavailableReason}>
      {content}
    </DashboardUnavailable>
  );
}

function buildBucketRows(statsRows: Array<{ name: string; used_bytes?: number | null; object_count?: number | null }>): BucketRankingRow[] {
  const rows = statsRows
    .filter((bucket) => bucket.name)
    .map((bucket) => ({
      name: bucket.name,
      storageBytes: bucket.used_bytes ?? null,
      objectCount: bucket.object_count ?? null,
      percent: 0,
    }))
    .sort((left, right) => (right.storageBytes ?? 0) - (left.storageBytes ?? 0))
    .slice(0, 5);
  const maxBytes = Math.max(...rows.map((row) => row.storageBytes ?? 0), 1);
  return rows.map((row) => ({
    ...row,
    percent: Math.max(4, ((row.storageBytes ?? 0) / maxBytes) * 100),
  }));
}

function resolveBucketCount(buckets: Bucket[], fallback?: number | null): number | null {
  if (buckets.length > 0) return buckets.length;
  return fallback ?? null;
}

export default function ManagerDashboard() {
  const { locale, t } = useManagerText(managerDashboardZhMessages);
  const { generalSettings } = useGeneralSettings();
  const {
    accounts,
    selectedS3AccountId,
    sessionS3AccountName,
    selectedS3AccountType,
    hasS3AccountContext,
    requiresS3AccountSelection,
    accountIdForApi,
    accessMode,
    managerStatsEnabled,
    managerStatsMessage,
  } = useS3AccountContext();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceEndpointHealthOverviewResponse | null>(null);
  const [workspaceHealthLoading, setWorkspaceHealthLoading] = useState(false);
  const [workspaceHealthError, setWorkspaceHealthError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketCountLoading, setBucketCountLoading] = useState(false);
  const [bucketCountError, setBucketCountError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ManagerActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [trafficStats, setTrafficStats] = useState<ManagerTrafficStats | null>(null);
  const [trafficTrend, setTrafficTrend] = useState<WorkspaceTrafficTrendSelection | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [usageTrends, setUsageTrends] = useState<ManagerUsageTrendsResponse | null>(null);
  const [usageTrendsLoading, setUsageTrendsLoading] = useState(false);
  const [usageStatsAggregate, setUsageStatsAggregate] = useState<BucketUsageStatsAggregate | null>(null);
  const [usageStatsLoading, setUsageStatsLoading] = useState(false);
  const [managerLimits, setManagerLimits] = useState<ManagerContext | null>(null);

  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedS3AccountId),
    [accounts, selectedS3AccountId]
  );
  const hasContext = hasS3AccountContext;
  const endpointCaps = selected?.storage_endpoint_capabilities ?? null;
  const iamFeatureEnabled = endpointCaps ? endpointCaps.iam !== false : true;
  const contextCanManageIam = selected?.capabilities?.can_manage_iam !== false;
  const usageFeatureEnabled = Boolean(managerStatsEnabled) && (endpointCaps ? endpointCaps.metrics !== false : true);
  const trafficFeatureEnabled = Boolean(managerStatsEnabled) && (endpointCaps ? endpointCaps.usage !== false : true);
  const isS3User = selectedS3AccountType === "s3_user";
  const canManageIam = !isS3User && contextCanManageIam && iamFeatureEnabled;
  const canLoadUsageStatsDataTypes =
    hasContext &&
    Boolean(requiresS3AccountSelection) &&
    Boolean(generalSettings.bucket_usage_stats_enabled);
  const refreshKey = `${accessMode ?? "default"}:${refreshNonce}`;
  const { stats, loading, error } = useManagerStats(
    accountIdForApi,
    usageFeatureEnabled && hasContext,
    refreshKey
  );
  const { overview: iamOverview, loading: iamLoading, error: iamError } = useIamOverview(
    accountIdForApi,
    canManageIam,
    hasContext,
    refreshKey
  );

  useEffect(() => {
    if (!hasContext) {
      setManagerLimits(null);
      return;
    }
    let cancelled = false;
    setManagerLimits(null);
    fetchManagerContext(accountIdForApi, { includeLimits: true })
      .then((context) => {
        if (!cancelled) setManagerLimits(context);
      })
      .catch(() => {
        if (!cancelled) setManagerLimits(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, hasContext, refreshNonce]);

  useEffect(() => {
    if (!hasContext) {
      setWorkspaceHealth(null);
      setWorkspaceHealthError(null);
      setWorkspaceHealthLoading(false);
      return;
    }
    if (!generalSettings.endpoint_status_enabled) {
      setWorkspaceHealth(null);
      setWorkspaceHealthError(null);
      setWorkspaceHealthLoading(false);
      return;
    }
    let cancelled = false;
    setWorkspaceHealthLoading(true);
    setWorkspaceHealthError(null);
    fetchManagerWorkspaceHealthOverview(accountIdForApi)
      .then((data) => {
        if (cancelled) return;
        setWorkspaceHealth(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setWorkspaceHealth(null);
        setWorkspaceHealthError(extractApiError(err, "Unable to load endpoint health for this account."));
      })
      .finally(() => {
        if (!cancelled) setWorkspaceHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, generalSettings.endpoint_status_enabled, hasContext, refreshNonce]);

  useEffect(() => {
    if (!hasContext) {
      setBuckets([]);
      setBucketCountError(null);
      setBucketCountLoading(false);
      return;
    }
    let cancelled = false;
    setBucketCountLoading(true);
    setBucketCountError(null);
    listBuckets(accountIdForApi, { with_stats: false })
      .then((items) => {
        if (cancelled) return;
        setBuckets(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setBuckets([]);
        setBucketCountError(extractApiError(err, "Unable to load bucket count."));
      })
      .finally(() => {
        if (!cancelled) setBucketCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, hasContext, refreshNonce]);

  useEffect(() => {
    if (!hasContext) {
      setActivityLogs([]);
      setActivityError(null);
      setActivityLoading(false);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    listManagerActivity(accountIdForApi, { limit: 5 })
      .then((items) => {
        if (cancelled) return;
        setActivityLogs(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setActivityLogs([]);
        setActivityError(extractApiError(err, "Unable to load manager activity."));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, hasContext, refreshNonce]);

  useEffect(() => {
    if (!hasContext || !trafficFeatureEnabled) {
      setTrafficStats(null);
      setTrafficTrend(null);
      setTrafficError(null);
      setTrafficLoading(false);
      return;
    }
    let cancelled = false;
    setTrafficLoading(true);
    setTrafficError(null);
    Promise.allSettled(
      TRAFFIC_TREND_WINDOWS.map((option) =>
        fetchManagerTraffic(accountIdForApi, option.window).then((data) => [option.window, data] as const)
      )
    )
      .then((results) => {
        if (cancelled) return;
        const entries = results
          .filter((result): result is PromiseFulfilledResult<readonly [TrafficWindow, ManagerTrafficStats]> => result.status === "fulfilled")
          .map((result) => result.value);
        const statsByWindow = Object.fromEntries(entries) as Partial<Record<TrafficWindow, ManagerTrafficStats>>;
        const dayStats = statsByWindow.day ?? null;
        setTrafficStats(dayStats);
        setTrafficTrend(selectWorkspaceTrafficTrend(statsByWindow));
        const dayFailure = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        setTrafficError(dayStats ? null : extractApiError(dayFailure?.reason, "Unable to load traffic usage."));
      })
      .catch((err) => {
        if (cancelled) return;
        setTrafficStats(null);
        setTrafficTrend(null);
        setTrafficError(extractApiError(err, "Unable to load traffic usage."));
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, hasContext, refreshNonce, trafficFeatureEnabled]);

  useEffect(() => {
    if (!hasContext || !usageFeatureEnabled) {
      setUsageTrends(null);
      setUsageTrendsLoading(false);
      return;
    }
    let cancelled = false;
    setUsageTrendsLoading(true);
    fetchManagerUsageTrends(accountIdForApi)
      .then((data) => {
        if (!cancelled) setUsageTrends(data);
      })
      .catch(() => {
        if (!cancelled) setUsageTrends(null);
      })
      .finally(() => {
        if (!cancelled) setUsageTrendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, hasContext, refreshNonce, usageFeatureEnabled]);

  useEffect(() => {
    if (!canLoadUsageStatsDataTypes) {
      setUsageStatsAggregate(null);
      setUsageStatsLoading(false);
      return;
    }
    let cancelled = false;
    setUsageStatsLoading(true);
    getManagerUsageStatsAggregate(accountIdForApi)
      .then((data) => {
        if (!cancelled) setUsageStatsAggregate(data.aggregate);
      })
      .catch(() => {
        if (!cancelled) {
          setUsageStatsAggregate(null);
        }
      })
      .finally(() => {
        if (!cancelled) setUsageStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, canLoadUsageStatsDataTypes, refreshNonce]);

  const accountLabel = selected
    ? formatAccountLabel(selected, true, locale)
    : sessionS3AccountName ?? t("S3 session");
  const noContextReason = !hasContext ? t("Select an account to display live values.") : null;
  const metricsUnavailableReason =
    noContextReason ||
    (managerStatsEnabled === null
      ? t("Metrics availability is loading for this context.")
      : !usageFeatureEnabled
        ? t(managerStatsMessage || "Storage metrics are not available for this context.")
        : error ? t(error) : null);
  const bucketCount = stats?.total_buckets ?? resolveBucketCount(buckets, null);
  const bucketUnavailableReason =
    noContextReason || (bucketCountError ? t(bucketCountError) : null) || (!bucketCountLoading && bucketCount == null ? t("Bucket list is not accessible.") : null);
  const iamUnavailableReason =
    noContextReason ||
    (canManageIam ? (iamError ? t(iamError) : null) : t("IAM is disabled for this endpoint or credential."));
  const endpointUnavailableReason =
    noContextReason ||
    (!generalSettings.endpoint_status_enabled
      ? t("Endpoint Status feature is disabled.")
      : (workspaceHealthError ? t(workspaceHealthError) : null) ||
        (!workspaceHealthLoading && workspaceHealth && workspaceHealth.endpoint_count === 0
          ? t("Endpoint Status has no endpoint data yet.")
          : null));
  const activityUnavailableReason = noContextReason || (activityError ? t(activityError) : null);
  const trafficUnavailableReason = noContextReason || (!trafficFeatureEnabled ? t("Traffic usage is not available for this context.") : trafficError ? t(trafficError) : null);
  const storageUsedBytes = metricsUnavailableReason ? null : stats?.total_bytes ?? null;
  const storageQuotaSizeGb = managerLimits?.quota_max_size_gb ?? null;
  const storageQuotaBytes =
    storageQuotaSizeGb != null
      ? storageQuotaSizeGb * 1024 ** 3
      : null;
  const objectCount = metricsUnavailableReason ? null : stats?.total_objects ?? null;
  const objectQuota = managerLimits?.quota_max_objects ?? null;
  const visibleBucketCount = bucketUnavailableReason ? null : bucketCount;
  const bucketQuota = managerLimits?.max_buckets ?? null;
  const iamUserCount = iamUnavailableReason ? null : iamOverview?.iam_users ?? stats?.total_iam_users ?? null;
  const iamGroupCount = iamUnavailableReason ? null : iamOverview?.iam_groups ?? stats?.total_iam_groups ?? null;
  const iamRoleCount = iamUnavailableReason ? null : iamOverview?.iam_roles ?? stats?.total_iam_roles ?? null;
  const iamPolicyCount = iamUnavailableReason ? null : iamOverview?.iam_policies ?? stats?.total_iam_policies ?? null;
  const userQuota = managerLimits?.max_users ?? null;
  const roleQuota = managerLimits?.max_roles ?? null;
  const groupQuota = managerLimits?.max_groups ?? null;
  const uploadBytes = trafficUnavailableReason ? null : trafficStats?.totals.bytes_in ?? null;
  const downloadBytes = trafficUnavailableReason ? null : trafficStats?.totals.bytes_out ?? null;
  const transferBytes = uploadBytes == null || downloadBytes == null ? null : uploadBytes + downloadBytes;
  const bucketRows = buildBucketRows(stats?.bucket_usage ?? []);
  const activityRows = activityUnavailableReason ? [] : buildActivityRows(activityLogs, t);
  const topBucketsUnavailableReason =
    metricsUnavailableReason ||
    (!loading && visibleBucketCount != null && visibleBucketCount > 0 && bucketRows.length === 0 ? t("Bucket storage ranking is not available.") : null);
  const healthEndpoint = workspaceHealth?.endpoints[0] ?? null;
  const storageTrend = usageTrends?.storage
    ? { ...usageTrends.storage, label: t(usageTrends.storage.label) }
    : usageTrends?.storage;
  const bucketTrend = usageTrends?.buckets
    ? { ...usageTrends.buckets, label: t(usageTrends.buckets.label) }
    : usageTrends?.buckets;
  const objectTrend = usageTrends?.objects
    ? { ...usageTrends.objects, label: t(usageTrends.objects.label) }
    : usageTrends?.objects;
  const localizedTrafficTrend = trafficTrend
    ? { ...trafficTrend, label: t(trafficTrend.label) }
    : trafficTrend;
  const accessCounts = [
    {
      label: t("Users"),
      value: iamUserCount,
      to: "/manager/users",
      tone: "blue" as DashboardTone,
      icon: <UserIcon className="h-4 w-4" />,
    },
    {
      label: t("Groups"),
      value: iamGroupCount,
      to: "/manager/groups",
      tone: "emerald" as DashboardTone,
      icon: <GroupIcon className="h-4 w-4" />,
    },
    {
      label: t("Roles"),
      value: iamRoleCount,
      to: "/manager/roles",
      tone: "amber" as DashboardTone,
      icon: <ShieldIcon className="h-4 w-4" />,
    },
    {
      label: t("Policies"),
      value: iamPolicyCount,
      to: "/manager/iam/policies",
      tone: "violet" as DashboardTone,
      icon: <FileIcon className="h-4 w-4" />,
    },
  ];
  const metrics = buildWorkspaceDashboardKpis({
    storage: {
      label: t("Storage used"),
      usedBytes: storageUsedBytes,
      quotaBytes: storageQuotaBytes,
      quotaOfLabel: t("of"),
      trendComparisonLabel: t("vs"),
      progressLabel: t("Storage used quota usage"),
      trendBaseline: metricsUnavailableReason ? null : storageTrend,
      icon: <BucketIcon className="h-7 w-7" />,
      to: "/manager/metrics",
      unavailableReason: metricsUnavailableReason,
    },
    spaces: {
      label: t("Buckets"),
      value: visibleBucketCount,
      quota: bucketQuota,
      unitLabel: t("buckets"),
      knownDetail: t("Buckets"),
      quotaOfLabel: t("of"),
      trendComparisonLabel: t("vs"),
      progressLabel: t("Buckets quota usage"),
      trendBaseline: bucketUnavailableReason ? null : bucketTrend,
      trendBaselineValue: usageTrends?.buckets?.bucket_count,
      tone: "emerald",
      icon: <BucketCollectionIcon className="h-7 w-7" />,
      to: "/manager/buckets",
      unavailableReason: bucketUnavailableReason,
    },
    objects: {
      label: t("Objects"),
      value: objectCount,
      quota: objectQuota,
      unitLabel: t("objects"),
      knownDetail: t("Objects"),
      quotaOfLabel: t("of"),
      trendComparisonLabel: t("vs"),
      progressLabel: t("Objects quota usage"),
      trendBaseline: metricsUnavailableReason ? null : objectTrend,
      trendBaselineValue: usageTrends?.objects?.used_objects,
      tone: "violet",
      icon: <FileIcon className="h-7 w-7" />,
      to: "/manager/metrics",
      unavailableReason: metricsUnavailableReason,
    },
    transfer: {
      label: t("Transfer"),
      bytes: transferBytes,
      loading: trafficLoading,
      trendSelection: trafficUnavailableReason ? null : localizedTrafficTrend,
      detailLabel: t("Last 24h"),
      trendComparisonLabel: t("vs"),
      icon: <TransferIcon className="h-7 w-7" />,
      to: "/manager/metrics",
      unavailableReason: trafficUnavailableReason,
    },
  });
  const quickActions: QuickAction[] = [
    {
      label: t("Create bucket"),
      to: "/manager/buckets",
      tone: "blue",
      icon: <FolderPlusIcon className="h-4 w-4" />,
      unavailableReason: noContextReason,
    },
    {
      label: t("Create user"),
      to: "/manager/users",
      tone: "blue",
      icon: <UserIcon className="h-4 w-4" />,
      unavailableReason: noContextReason || (!canManageIam ? t("IAM is disabled for this context.") : null),
    },
  ];
  const refreshing =
    loading ||
    iamLoading ||
    bucketCountLoading ||
    workspaceHealthLoading ||
    activityLoading ||
    trafficLoading ||
    usageTrendsLoading ||
    usageStatsLoading;

  const handleRefresh = () => {
    setLastUpdated(new Date());
    setRefreshNonce((current) => current + 1);
  };

  return (
    <div className="ui-dashboard-compact" data-testid="manager-dashboard">
      <PageHeader
        title={t("Manager dashboard")}
        description={formatManagerMessage(t("Overview of {account} storage account and resources."), { account: accountLabel })}
        breadcrumbs={localizedManagerPageBreadcrumbs("dashboard", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        rightContent={
          <div className="flex items-center gap-3">
            <span className={cx("hidden ui-caption sm:inline", uiMutedTextClass)}>
              {t("Updated")} {formatLocalDateTime(workspaceHealth?.generated_at ?? lastUpdated)}
            </span>
            <WorkspaceDashboardAction
              variant="secondary"
              type="button"
              onClick={handleRefresh}
              aria-label={t("Refresh manager dashboard")}
              title={t("Refresh")}
              className="ui-dashboard-action-icon"
              disabled={refreshing}
            >
              <RefreshIcon className={cx("h-4 w-4", refreshing && "animate-spin")} />
            </WorkspaceDashboardAction>
          </div>
        }
      />

      <KpiRow presentation="compact" metrics={metrics} />

      <div data-testid="manager-dashboard-overview-grid" className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <StorageOverviewCard
            usedBytes={storageUsedBytes}
            quotaBytes={storageQuotaBytes}
            trendBaseline={storageTrend ?? null}
            referenceDate={workspaceHealth?.generated_at ?? lastUpdated}
            unavailableReason={metricsUnavailableReason}
          />
        </div>
        <div
          className={cx("min-w-0", canLoadUsageStatsDataTypes ? "xl:col-span-5" : "xl:col-span-8")}
          data-testid="manager-dashboard-top-buckets-card"
        >
          <TopBucketsCard rows={bucketRows} unavailableReason={topBucketsUnavailableReason} />
        </div>
        {canLoadUsageStatsDataTypes && (
          <div className="min-w-0 xl:col-span-3">
            <BucketUsageStatsDataTypesCard presentation="compact"
              aggregate={usageStatsAggregate}
              loading={usageStatsLoading}
              data-testid="manager-dashboard-data-types"
            />
          </div>
        )}
      </div>

      <div
        className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.44fr)_minmax(0,0.9fr)] 2xl:grid-cols-[minmax(0,1.44fr)_minmax(0,0.72fr)_minmax(0,0.9fr)_minmax(280px,1fr)]"
        data-testid="manager-dashboard-resource-grid"
      >
        <QuotaStatusCard
          storageUsed={storageUsedBytes}
          storageQuota={storageQuotaBytes}
          objectCount={objectCount}
          objectQuota={objectQuota}
          bucketCount={visibleBucketCount}
          bucketQuota={bucketQuota}
          userCount={iamUserCount}
          userQuota={userQuota}
          roleCount={iamRoleCount}
          roleQuota={roleQuota}
          groupCount={iamGroupCount}
          groupQuota={groupQuota}
          unavailableReason={metricsUnavailableReason}
          bucketUnavailableReason={bucketUnavailableReason}
          iamUnavailableReason={iamUnavailableReason}
        />
        <QuickActionsCard actions={quickActions} />
        <AccessManagementCard counts={accessCounts} unavailableReason={iamUnavailableReason} />
        <BackendHealthCard endpoint={healthEndpoint} unavailableReason={endpointUnavailableReason} />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="manager-dashboard-activity-incidents-row">
        <div className="min-w-0" data-testid="manager-dashboard-recent-activity-card">
          <RecentActivityCard rows={activityRows} loading={activityLoading} unavailableReason={activityUnavailableReason} />
        </div>
        <IncidentStrip
          incidents={workspaceHealth?.incidents ?? []}
          unavailableReason={endpointUnavailableReason}
        />
      </div>
    </div>
  );
}
