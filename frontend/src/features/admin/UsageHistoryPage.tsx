/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useEffect, useMemo, useState } from "react";
import {
  collectUsageHistory,
  listUsageHistory,
  type UsageHistoryGranularity,
  type UsageHistoryRecord,
  type UsageHistoryResponse,
  type UsageHistorySortBy,
  type UsageHistorySortDir,
  type UsageHistorySubjectType,
} from "../../api/usageHistory";
import { listStorageEndpoints, type StorageEndpoint } from "../../api/storageEndpoints";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import ListPageSection from "../../components/list/ListPageSection";
import PageBanner from "../../components/PageBanner";
import InlineSummary from "../../components/InlineSummary";
import MobileTableSort from "../../components/list/MobileTableSort";
import PageShell from "../../components/PageShell";
import FullPageStatus from "../../components/FullPageStatus";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import { ListActionButton } from "../../components/list/ListControls";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import {
  cx,
  uiMutedTextClass,
  uiTitleTextClass,
} from "../../components/ui/styles";
import { RefreshIcon } from "../browser/browserIcons";
import { extractApiError } from "../../utils/apiError";
import { formatBytes, formatCompactNumber, formatPercentage } from "../../utils/format";
import {
  localizeAdminOperationsBreadcrumbs,
  type AdminOperationsLocale,
  useAdminOperationsText,
} from "./adminOperationsMessages";

const SUBJECT_TYPES: Array<{ value: UsageHistorySubjectType; label: string }> = [
  { value: "all", label: "All subjects" },
  { value: "account", label: "RGW Accounts" },
  { value: "s3_user", label: "RGW Users" },
];

const SORT_OPTIONS: Array<{ value: UsageHistorySortBy; label: string }> = [
  { value: "period", label: "Period" },
  { value: "subject", label: "Subject" },
  { value: "used_bytes", label: "Storage" },
  { value: "used_objects", label: "Objects" },
  { value: "ratio", label: "Quota ratio" },
];

function dateDaysAgo(days: number): string {
  const now = new Date();
  const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function todayDate(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

function formatDateTime(value: string | null | undefined, locale: AdminOperationsLocale): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale === "zh" ? "zh-CN" : undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSubjectType(value: UsageHistoryRecord["subject_type"], locale: AdminOperationsLocale): string {
  if (locale === "zh") return value === "account" ? "账户" : "S3 用户";
  return value === "account" ? "Account" : "S3 user";
}

function collectionMessage(
  result: Awaited<ReturnType<typeof collectUsageHistory>>,
  locale: AdminOperationsLocale,
): string {
  if (result.status === "skipped" && result.reason) {
    return result.reason;
  }
  const processed = result.subjects_processed ?? 0;
  const hourly = result.history_hourly_upserts ?? 0;
  const daily = result.history_daily_upserts ?? 0;
  if (locale === "zh") return `采集完成：已处理 ${processed} 个主体，写入 ${hourly} 个每小时快照和 ${daily} 个每日快照。`;
  return `Collection completed: ${processed} subject${processed === 1 ? "" : "s"} processed, ${hourly} hourly and ${daily} daily snapshot${daily === 1 ? "" : "s"}.`;
}

function describeCollectionIssue(issue: unknown, fallback: string): string {
  if (typeof issue === "string") return issue;
  if (issue && typeof issue === "object") {
    const record = issue as Record<string, unknown>;
    const detail = record.error ?? record.warning ?? record.message;
    if (detail != null) return String(detail);
  }
  if (issue != null) return String(issue);
  return fallback;
}

function collectionIssueMessage(
  kind: "error" | "warning",
  issues: unknown[] | undefined,
  locale: AdminOperationsLocale,
): string | null {
  if (!issues?.length) return null;
  const first = describeCollectionIssue(issues[0], locale === "zh" ? (kind === "error" ? "未知错误" : "未知警告") : `Unknown ${kind}`);
  const label = kind === "error" ? "error" : "warning";
  if (locale === "zh") {
    const labelZh = kind === "error" ? "错误" : "警告";
    return `采集完成，但有 ${issues.length} 个${labelZh}。首个${labelZh}：${first}`;
  }
  return `Collection finished with ${issues.length} ${label}${issues.length === 1 ? "" : "s"}. First ${label}: ${first}`;
}

function buildHistoryTableColumns(
  locale: AdminOperationsLocale,
  t: (message: string) => string,
): Array<DataTableColumn<UsageHistoryRecord, UsageHistorySortBy>> {
  return [
  {
    id: "period",
    label: t("Period"),
    field: "period",
    primary: true,
    render: (item) => (
      <>
        <div className={cx("font-medium", uiTitleTextClass)}>{formatDateTime(item.period_start, locale)}</div>
        <div className={cx("ui-caption", uiMutedTextClass)}>
          {locale === "zh" ? t(item.granularity === "daily" ? "Daily" : "Hourly") : item.granularity}
        </div>
      </>
    ),
  },
  {
    id: "endpoint",
    label: t("Endpoint"),
    render: (item) => (
      <>
        <div className={cx("font-medium", uiTitleTextClass)}>{item.endpoint_name}</div>
        <div className={cx("ui-caption", uiMutedTextClass)}>#{item.storage_endpoint_id}</div>
      </>
    ),
  },
  {
    id: "subject",
    label: t("Subject"),
    field: "subject",
    render: (item) => (
      <>
        <div className={cx("font-medium", uiTitleTextClass)}>{item.subject_name}</div>
        <div className={cx("ui-caption", uiMutedTextClass)}>
          {formatSubjectType(item.subject_type, locale)}
          {item.subject_identifier ? ` - ${item.subject_identifier}` : ""}
        </div>
      </>
    ),
  },
  {
    id: "storage",
    label: t("Storage"),
    field: "used_bytes",
    render: (item) => (
      <>
        <div className={cx("font-medium", uiTitleTextClass)}>{formatBytes(item.used_bytes)}</div>
        {item.quota_size_bytes != null ? (
          <div className={cx("ui-caption", uiMutedTextClass)}>{t("Quota")} {formatBytes(item.quota_size_bytes)}</div>
        ) : null}
      </>
    ),
  },
  {
    id: "objects",
    label: t("Objects"),
    field: "used_objects",
    render: (item) => (
      <>
        <div className={cx("font-medium", uiTitleTextClass)}>{formatCompactNumber(item.used_objects)}</div>
        {item.quota_objects != null ? (
          <div className={cx("ui-caption", uiMutedTextClass)}>{t("Quota")} {formatCompactNumber(item.quota_objects)}</div>
        ) : null}
      </>
    ),
  },
  {
    id: "ratio",
    label: t("Quota ratio"),
    field: "ratio",
    render: (item) => formatPercentage(item.usage_ratio_pct),
  },
  {
    id: "samples",
    label: t("Samples"),
    align: "right",
    render: (item) => item.samples_count ?? (item.granularity === "hourly" ? "1" : "-"),
  },
  {
    id: "collected",
    label: t("Collected"),
    render: (item) => formatDateTime(item.collected_at, locale),
  },
  ];
}

export default function UsageHistoryPage() {
  const { locale, t } = useAdminOperationsText();
  const { generalSettings } = useGeneralSettings();
  const [granularity, setGranularity] = useState<UsageHistoryGranularity>("daily");
  const [subjectType, setSubjectType] = useState<UsageHistorySubjectType>("all");
  const [sortBy, setSortBy] = useState<UsageHistorySortBy>("period");
  const [sortDir, setSortDir] = useState<UsageHistorySortDir>("desc");
  const [startDate, setStartDate] = useState<string>(dateDaysAgo(14));
  const [endDate, setEndDate] = useState<string>(todayDate());
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [endpoints, setEndpoints] = useState<StorageEndpoint[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(false);
  const [endpointsError, setEndpointsError] = useState<string | null>(null);

  const [history, setHistory] = useState<UsageHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [collectLoading, setCollectLoading] = useState(false);
  const [collectSuccess, setCollectSuccess] = useState<string | null>(null);
  const [collectWarning, setCollectWarning] = useState<string | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEndpoints() {
      if (!generalSettings.usage_history_enabled) return;
      setEndpointsLoading(true);
      setEndpointsError(null);
      try {
        const data = await listStorageEndpoints();
        if (!cancelled) {
          setEndpoints(data);
        }
      } catch (err) {
        if (!cancelled) {
          setEndpoints([]);
          setEndpointsError(extractApiError(err, "Unable to load endpoints."));
        }
      } finally {
        if (!cancelled) {
          setEndpointsLoading(false);
        }
      }
    }
    void loadEndpoints();
    return () => {
      cancelled = true;
    };
  }, [generalSettings.usage_history_enabled]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!generalSettings.usage_history_enabled) return;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const data = await listUsageHistory({
          granularity,
          endpointId: selectedEndpointId,
          subjectType,
          start: startDate,
          end: endDate,
          page: 1,
          pageSize: 100,
          sortBy,
          sortDir,
        });
        if (!cancelled) {
          setHistory(data);
        }
      } catch (err) {
        if (!cancelled) {
          setHistory(null);
          setHistoryError(extractApiError(err, "Unable to load usage history."));
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [
    endDate,
    generalSettings.usage_history_enabled,
    granularity,
    reloadToken,
    selectedEndpointId,
    sortBy,
    sortDir,
    startDate,
    subjectType,
  ]);

  const tableStatus = resolveListTableStatus({
    loading: historyLoading,
    error: historyError,
    rowCount: history?.items.length ?? 0,
  });
  const localizedSortOptions = useMemo(
    () => SORT_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  );
  const historyTableColumns = useMemo(
    () => buildHistoryTableColumns(locale, t),
    [locale, t],
  );

  async function handleCollect() {
    setCollectLoading(true);
    setCollectSuccess(null);
    setCollectWarning(null);
    setCollectError(null);
    try {
      const result = await collectUsageHistory();
      const message = collectionMessage(result, locale);
      const errorMessage = collectionIssueMessage("error", result.errors, locale);
      const warningMessage = collectionIssueMessage("warning", result.warnings, locale);
      if (errorMessage) {
        setCollectError(`${message} ${errorMessage}`);
      } else {
        setCollectSuccess(message);
        setCollectWarning(warningMessage);
      }
      setReloadToken((current) => current + 1);
    } catch (err) {
      setCollectError(extractApiError(err, "Unable to trigger usage history collection."));
    } finally {
      setCollectLoading(false);
    }
  }

  function handleTableSort(field: UsageHistorySortBy) {
    if (field === sortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir("desc");
  }

  if (!generalSettings.usage_history_enabled) {
    return (
      <FullPageStatus
        title={t("Usage history disabled")}
        description={t("This feature has been disabled by an administrator. Contact your admin if you need access restored.")}
        primaryAction={{ label: t("Back to home"), to: "/", variant: "primary" }}
        secondaryAction={{ label: t("Switch account"), to: "/login" }}
      />
    );
  }

  return (
    <PageShell actionPresentation="listing"
      title={t("Usage history")}
      description={t("Review quota usage trends for RGW accounts and users.")}
      breadcrumbs={localizeAdminOperationsBreadcrumbs(adminPageBreadcrumbs("usage-history"), locale)}
      breadcrumbLabel={t("Breadcrumb")}
      rightContent={
        <ListActionButton
          variant="primary"
          onClick={() => void handleCollect()}
          disabled={collectLoading}
          loading={collectLoading}
        >
          <RefreshIcon aria-hidden="true" className={cx("h-3.5 w-3.5", collectLoading && "animate-spin")} />
          {collectLoading ? t("Collecting...") : t("Collect usage")}
        </ListActionButton>
      }
    >

      {endpointsError ? <PageBanner tone="warning">{t(endpointsError)}</PageBanner> : null}

      {collectSuccess ? <PageBanner tone="success">{collectSuccess}</PageBanner> : null}
      {collectWarning ? <PageBanner tone="warning">{collectWarning}</PageBanner> : null}
      {collectError ? <PageBanner tone="error">{t(collectError)}</PageBanner> : null}
      {historyError ? <PageBanner tone="error">{t(historyError)}</PageBanner> : null}

      <ListPageSection variant="page"
        title={t("Snapshots")}
        mobileSort={<MobileTableSort options={localizedSortOptions} field={sortBy} direction={sortDir} onFieldChange={setSortBy} onDirectionChange={setSortDir} labels={{ sortBy: t("Sort by"), direction: t("Direction"), ascending: t("Ascending"), descending: t("Descending") }} />}
        countLabel={locale === "zh" ? `${history?.total ?? 0} 条记录` : `${history?.total ?? 0} record${history?.total === 1 ? "" : "s"}`}
        filters={
          <>
            <UiSelect
              label={t("Granularity")}
              title={t("Daily keeps the latest usage per day; hourly keeps each collected quota snapshot.")}
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as UsageHistoryGranularity)}
              size="compact"
            >
              <option value="daily">{t("Daily")}</option>
              <option value="hourly">{t("Hourly")}</option>
            </UiSelect>
            <UiSelect
              label={t("Endpoint")}
              value={selectedEndpointId ?? ""}
              onChange={(event) => setSelectedEndpointId(event.target.value ? Number(event.target.value) : null)}
              disabled={endpointsLoading}
              size="compact"
            >
              <option value="">{endpointsLoading ? t("Loading...") : t("All endpoints")}</option>
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
                </option>
              ))}
            </UiSelect>
            <UiSelect
              label={t("Subject")}
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value as UsageHistorySubjectType)}
              size="compact"
            >
              {SUBJECT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </UiSelect>
            <UiInput
              label={t("Start")}
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              size="compact"
            />
            <UiInput
              label={t("End")}
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              size="compact"
            />

          </>
        }
        actions={<ListActionButton variant="secondary" onClick={() => setReloadToken((current) => current + 1)} disabled={historyLoading}>{t("Refresh")}</ListActionButton>}
        secondaryContent={
          <InlineSummary items={[
            { label: t("Latest collection"), value: historyLoading ? t("Loading...") : formatDateTime(history?.summary.latest_collected_at, locale) },
            { label: t("Max quota ratio"), value: historyLoading ? t("Loading...") : formatPercentage(history?.summary.max_usage_ratio_pct) },
          ]} />
        }
      >
        <DataTableShell
          columns={historyTableColumns}
          rows={history?.items ?? []}
          rowKey={(item) => `${item.granularity}-${item.id}`}
          status={tableStatus}
          loadingMessage={t("Loading usage history...")}
          errorMessage={t("Unable to load usage history.")}
          emptyMessage={t("No usage history for this scope.")}
          primaryColumnId="period"
          sort={{
            field: sortBy,
            direction: sortDir,
            onSort: handleTableSort,
          }}
          responsiveCards
          tableClassName="ui-data-table"
          rowClassName="bg-white/80 hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-900/50"
        />
      </ListPageSection>
    </PageShell>
  );
}
