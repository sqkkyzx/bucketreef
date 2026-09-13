/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getManagerUsageStatsAggregate,
  streamManagerUsageStatsAggregate,
  type BucketUsageStatsAggregate,
} from "../../api/bucketUsageStats";
import {
  fetchManagerUsageHistoryTrends,
  type UsageHistoryTrendResponse,
  type UsageHistoryTrendWindow,
} from "../../api/usageHistory";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import PageShell from "../../components/PageShell";
import PageTabs, { PageTabPanel } from "../../components/PageTabs";
import MetricsUnavailableCard from "../../components/MetricsUnavailableCard";
import PageEmptyState from "../../components/PageEmptyState";
import UsageBreakdown from "../../components/UsageBreakdown";
import UsageHistoryTrendsSection from "../../components/UsageHistoryTrendsSection";
import { extractApiError } from "../../utils/apiError";
import BucketUsageStatsAggregateCard from "../shared/BucketUsageStatsAggregateCard";
import TrafficAnalytics from "./TrafficAnalytics";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { managerDashboardZhMessages } from "./managerDashboardMessages";
import { useManagerText } from "./managerI18n";
import { useManagerStats } from "./useManagerStats";

type ManagerMetricsTab = "storage" | "usage-composition" | "usage-history" | "traffic";

export default function ManagerMetricsPage() {
  const { locale, t } = useManagerText(managerDashboardZhMessages);
  const { generalSettings } = useGeneralSettings();
  const [activeTab, setActiveTab] = useState<ManagerMetricsTab>("storage");
  const {
    accounts,
    selectedS3AccountId,
    hasS3AccountContext,
    requiresS3AccountSelection,
    accountIdForApi,
    accessMode,
    managerStatsEnabled,
    managerStatsMessage,
  } = useS3AccountContext();

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedS3AccountId),
    [accounts, selectedS3AccountId]
  );
  const hasContext = hasS3AccountContext;
  const endpointCaps = selected?.storage_endpoint_capabilities ?? null;
  const usageFeatureEnabled = Boolean(managerStatsEnabled) && (endpointCaps ? endpointCaps.metrics !== false : true);
  const metricsFeatureEnabled = Boolean(managerStatsEnabled) && (endpointCaps ? endpointCaps.usage !== false : true);
  const canLoadUsageStatsAggregate =
    hasContext &&
    Boolean(requiresS3AccountSelection) &&
    Boolean(generalSettings.bucket_usage_stats_enabled);
  const canShowUsageBreakdowns = usageFeatureEnabled && hasContext;
  const showTrafficAnalytics = metricsFeatureEnabled && hasContext;
  const showMetricsDisabledBanner = hasContext && !usageFeatureEnabled && !metricsFeatureEnabled;
  const showUsageDisabledBanner = hasContext && managerStatsEnabled && !usageFeatureEnabled && metricsFeatureEnabled;
  const showTrafficDisabledBanner = hasContext && managerStatsEnabled && usageFeatureEnabled && !metricsFeatureEnabled;
  const managerMetricsMessage =
    hasContext && !managerStatsEnabled
      ? t(managerStatsMessage || "Metrics are unavailable for this context.")
      : null;

  const { stats, loading, error } = useManagerStats(
    accountIdForApi,
    canShowUsageBreakdowns,
    accessMode ?? "default"
  );
  const [usageHistoryWindow, setUsageHistoryWindow] = useState<UsageHistoryTrendWindow>("month");
  const [usageHistoryTrends, setUsageHistoryTrends] = useState<UsageHistoryTrendResponse | null>(null);
  const [usageHistoryLoading, setUsageHistoryLoading] = useState(false);
  const [usageHistoryError, setUsageHistoryError] = useState<string | null>(null);
  const [usageStatsAggregate, setUsageStatsAggregate] = useState<BucketUsageStatsAggregate | null>(null);
  const [usageStatsLoading, setUsageStatsLoading] = useState(false);
  const [usageStatsError, setUsageStatsError] = useState<string | null>(null);
  const [usageStatsRecalculating, setUsageStatsRecalculating] = useState(false);
  const showUsageBreakdowns = canShowUsageBreakdowns && !error;
  const showUsageHistoryTrends =
    Boolean(generalSettings.usage_history_enabled) &&
    hasContext &&
    !managerMetricsMessage &&
    !showMetricsDisabledBanner;
  const showFullPageMetricsUnavailable =
    Boolean(managerMetricsMessage) &&
    !showUsageBreakdowns &&
    !showTrafficAnalytics &&
    !canLoadUsageStatsAggregate;
  const showFullPageMetricsDisabled = showMetricsDisabledBanner && !canLoadUsageStatsAggregate;

  const loadUsageStatsAggregate = useCallback(async () => {
    if (!canLoadUsageStatsAggregate) {
      setUsageStatsAggregate(null);
      setUsageStatsLoading(false);
      setUsageStatsError(null);
      return;
    }
    setUsageStatsLoading(true);
    setUsageStatsError(null);
    try {
      const data = await getManagerUsageStatsAggregate(accountIdForApi);
      setUsageStatsAggregate(data.aggregate);
    } catch (err) {
      setUsageStatsAggregate(null);
      setUsageStatsError(extractApiError(err, "Unable to load usage composition."));
    } finally {
      setUsageStatsLoading(false);
    }
  }, [accountIdForApi, canLoadUsageStatsAggregate]);

  useEffect(() => {
    void loadUsageStatsAggregate();
  }, [loadUsageStatsAggregate]);

  const handleRecalculateUsageStats = useCallback(async () => {
    if (!canLoadUsageStatsAggregate) return;
    setUsageStatsRecalculating(true);
    setUsageStatsError(null);
    try {
      await streamManagerUsageStatsAggregate(accountIdForApi, { parallelism: 8 });
      await loadUsageStatsAggregate();
    } catch (err) {
      setUsageStatsError(extractApiError(err, "Unable to recalculate usage composition."));
    } finally {
      setUsageStatsRecalculating(false);
    }
  }, [accountIdForApi, canLoadUsageStatsAggregate, loadUsageStatsAggregate]);

  useEffect(() => {
    if (!showUsageHistoryTrends) {
      setUsageHistoryTrends(null);
      setUsageHistoryLoading(false);
      setUsageHistoryError(null);
      return;
    }
    let cancelled = false;
    setUsageHistoryLoading(true);
    setUsageHistoryError(null);
    fetchManagerUsageHistoryTrends(accountIdForApi, usageHistoryWindow)
      .then((data) => {
        if (!cancelled) setUsageHistoryTrends(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setUsageHistoryTrends(null);
          setUsageHistoryError(extractApiError(err, "Unable to load usage history trends."));
        }
      })
      .finally(() => {
        if (!cancelled) setUsageHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountIdForApi, showUsageHistoryTrends, usageHistoryWindow]);

  const localizedUsageStatsAggregate = useMemo(
    () => usageStatsAggregate
      ? { ...usageStatsAggregate, warnings: usageStatsAggregate.warnings.map((warning) => t(warning)) }
      : usageStatsAggregate,
    [t, usageStatsAggregate]
  );
  const localizedUsageHistoryTrends = useMemo(
    () => usageHistoryTrends
      ? {
          ...usageHistoryTrends,
          unavailable_reason: usageHistoryTrends.unavailable_reason
            ? t(usageHistoryTrends.unavailable_reason)
            : usageHistoryTrends.unavailable_reason,
        }
      : usageHistoryTrends,
    [t, usageHistoryTrends]
  );

  const usageStatsAggregateSection = canLoadUsageStatsAggregate ? (
    <BucketUsageStatsAggregateCard
      title={t("Account usage composition")}
      description={t("Latest calculated bucket snapshots for the active account context.")}
      aggregate={localizedUsageStatsAggregate}
      loading={usageStatsLoading}
      error={usageStatsError ? t(usageStatsError) : usageStatsError}
      recalculating={usageStatsRecalculating}
      recalculateLabel={t("Recalculate account")}
      onRecalculate={handleRecalculateUsageStats}
    />
  ) : null;
  const metricsTabs = useMemo(
    () =>
      [
        { id: "storage" as const, label: t("Storage") },
        ...(canLoadUsageStatsAggregate ? [{ id: "usage-composition" as const, label: t("Usage composition") }] : []),
        ...(showUsageHistoryTrends ? [{ id: "usage-history" as const, label: t("Usage history") }] : []),
        { id: "traffic" as const, label: t("Traffic") },
      ],
    [canLoadUsageStatsAggregate, showUsageHistoryTrends, t]
  );

  useEffect(() => {
    if (!metricsTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(metricsTabs[0]?.id ?? "storage");
    }
  }, [activeTab, metricsTabs]);

  return (
    <PageShell
      title={t("Usage & Metrics")}
      description={t("Logical usage composition, storage analytics, and traffic analytics for the active execution context.")}
      breadcrumbs={localizedManagerPageBreadcrumbs("metrics", locale)}
      breadcrumbLabel={t("Breadcrumb")}
    >
      {!hasContext ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account to view usage and metrics")}
          description={t("Usage composition and Manager metrics depend on an execution context. Choose an account to load bucket usage, storage, and traffic analytics.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : showFullPageMetricsUnavailable ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Metrics are unavailable for this context")}
          description={managerMetricsMessage ?? t("Metrics are unavailable for this context.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : showFullPageMetricsDisabled ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Metrics are disabled for this endpoint")}
          description={t("Neither storage analytics nor traffic analytics are enabled on the selected endpoint.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : (
        <>
          <PageTabs
            tabs={metricsTabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as ManagerMetricsTab)}
            variant="line"
            ariaLabel={t("Manager metrics sections")}
            idPrefix="manager-metrics"
          />

          <PageTabPanel idPrefix="manager-metrics" tabId={activeTab} className="space-y-4 pt-4">
          {activeTab === "storage" ? (
            <>
              {managerMetricsMessage && !showUsageBreakdowns && (
                <MetricsUnavailableCard
                  eyebrow={t("Metrics")}
                  title={t("Storage analytics")}
                  description={t("Bucket volume and object counts for the active context.")}
                  message={managerMetricsMessage}
                  tone="warning"
                />
              )}
              {!managerMetricsMessage && showMetricsDisabledBanner && (
                <MetricsUnavailableCard
                  eyebrow={t("Metrics")}
                  title={t("Storage analytics")}
                  description={t("Bucket volume and object counts for the active context.")}
                  message={t("Neither storage analytics nor traffic analytics are enabled on the selected endpoint.")}
                  tone="warning"
                />
              )}
              {!managerMetricsMessage && !showMetricsDisabledBanner && showUsageDisabledBanner && (
                <MetricsUnavailableCard
                  title={t("Storage analytics")}
                  description={t("Bucket volume and object counts for the active context.")}
                  message={t("Storage analytics are disabled for this endpoint.")}
                />
              )}
              {!managerMetricsMessage && !showMetricsDisabledBanner && error && (
                <MetricsUnavailableCard
                  title={t("Storage analytics")}
                  description={t("Bucket volume and object counts for the active context.")}
                  message={t(error)}
                  tone="error"
                />
              )}
              {!managerMetricsMessage && !showMetricsDisabledBanner && showUsageBreakdowns && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <UsageBreakdown
                    title={t("Bucket breakdown (storage)")}
                    loading={loading}
                    metric="bytes"
                    items={(stats?.bucket_usage ?? []).map((bucket) => ({
                      id: bucket.name,
                      label: bucket.name,
                      usedBytes: bucket.used_bytes ?? null,
                      objectCount: bucket.object_count ?? null,
                    }))}
                    emptyMessage={t("No bucket storage metrics available.")}
                    objectUnitLabel={t("objects")}
                  />
                  <UsageBreakdown
                    title={t("Bucket breakdown (objects)")}
                    loading={loading}
                    metric="objects"
                    items={(stats?.bucket_usage ?? []).map((bucket) => ({
                      id: bucket.name,
                      label: bucket.name,
                      usedBytes: bucket.used_bytes ?? null,
                      objectCount: bucket.object_count ?? null,
                    }))}
                    emptyMessage={t("No bucket object metrics available.")}
                    objectUnitLabel={t("objects")}
                  />
                </div>
              )}
            </>
          ) : null}

          {activeTab === "usage-composition" && canLoadUsageStatsAggregate ? usageStatsAggregateSection : null}

          {activeTab === "usage-history" && showUsageHistoryTrends && (
            <UsageHistoryTrendsSection
              trends={localizedUsageHistoryTrends}
              window={usageHistoryWindow}
              onWindowChange={setUsageHistoryWindow}
              loading={usageHistoryLoading}
              error={usageHistoryError ? t(usageHistoryError) : usageHistoryError}
              description={t("Stored usage snapshots for the active execution context.")}
            />
          )}

          {activeTab === "traffic" && managerMetricsMessage && !showTrafficAnalytics ? (
            <MetricsUnavailableCard
              eyebrow={t("Metrics")}
              title={t("Traffic")}
              description={t("Ingress/egress volume, request types, and busiest buckets.")}
              message={managerMetricsMessage}
              tone="warning"
            />
          ) : null}
          {activeTab === "traffic" && !managerMetricsMessage && showMetricsDisabledBanner ? (
            <MetricsUnavailableCard
              eyebrow={t("Metrics")}
              title={t("Traffic")}
              description={t("Ingress/egress volume, request types, and busiest buckets.")}
              message={t("Neither storage analytics nor traffic analytics are enabled on the selected endpoint.")}
              tone="warning"
            />
          ) : null}
          {activeTab === "traffic" && !managerMetricsMessage && !showMetricsDisabledBanner && showTrafficDisabledBanner ? (
            <MetricsUnavailableCard
              title={t("Traffic")}
              description={t("Ingress/egress volume, request types, and busiest buckets.")}
              message={t("Traffic analytics are disabled for this endpoint.")}
            />
          ) : null}
          {showTrafficAnalytics && (
            <TrafficAnalytics
              accountId={accountIdForApi}
              enabled={showTrafficAnalytics}
              visible={activeTab === "traffic"}
            />
          )}
          </PageTabPanel>
        </>
      )}
    </PageShell>
  );
}
