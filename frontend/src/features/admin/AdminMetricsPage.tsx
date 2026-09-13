/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate, useI18n } from "../../i18n";
import { infrastructureMessages } from "../../infrastructureMessages";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminUsageStatsAggregate,
  streamAdminUsageStatsAggregate,
  type BucketUsageStatsAggregate,
} from "../../api/bucketUsageStats";
import {
  AdminStats,
  AdminTrafficStats,
  TrafficWindow,
  fetchAdminStorage,
  fetchAdminTraffic,
} from "../../api/stats";
import { listStorageEndpoints, type StorageEndpoint } from "../../api/storageEndpoints";
import {
  fetchAdminUsageHistoryTrends,
  type UsageHistoryTrendResponse,
  type UsageHistoryTrendWindow,
} from "../../api/usageHistory";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import { MetricsCard } from "../../components/MetricsCard";
import MetricsTrafficOverview, { MetricsSnapshotCard, MetricsSummaryCard } from "../../components/MetricsTrafficOverview";
import MetricsUnavailableCard from "../../components/MetricsUnavailableCard";
import PageEmptyState from "../../components/PageEmptyState";
import PageHeader from "../../components/PageHeader";
import PageTabs, { PageTabPanel } from "../../components/PageTabs";
import { localizedAdminPageBreadcrumbs as adminPageBreadcrumbs } from "./adminBreadcrumbs";
import UsageBreakdown from "../../components/UsageBreakdown";
import UsageHistoryTrendsSection from "../../components/UsageHistoryTrendsSection";
import UiSelect from "../../components/ui/UiSelect";
import { extractApiError } from "../../utils/apiError";
import { formatBytes, formatCompactNumber } from "../../utils/format";
import BucketUsageStatsAggregateCard from "../shared/BucketUsageStatsAggregateCard";

type AdminMetricsTab = "storage" | "usage-composition" | "usage-history" | "traffic";

function extractError(err: unknown, fallback: string): string {
  return extractApiError(err, fallback);
}

export default function AdminMetricsPage() {
  const { locale } = useI18n();
  const { generalSettings } = useGeneralSettings();
  const [activeTab, setActiveTab] = useState<AdminMetricsTab>("storage");
  const [storage, setStorage] = useState<AdminStats | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoading, setStorageLoading] = useState<boolean>(true);

  const [endpoints, setEndpoints] = useState<StorageEndpoint[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null);
  const [endpointLoading, setEndpointLoading] = useState<boolean>(true);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  const [traffic, setTraffic] = useState<AdminTrafficStats | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficLoading, setTrafficLoading] = useState<boolean>(false);

  const [window, setWindow] = useState<TrafficWindow>("week");
  const [usageHistoryWindow, setUsageHistoryWindow] = useState<UsageHistoryTrendWindow>("month");
  const [usageHistoryTrends, setUsageHistoryTrends] = useState<UsageHistoryTrendResponse | null>(null);
  const [usageHistoryLoading, setUsageHistoryLoading] = useState<boolean>(false);
  const [usageHistoryError, setUsageHistoryError] = useState<string | null>(null);
  const [usageStatsAggregate, setUsageStatsAggregate] = useState<BucketUsageStatsAggregate | null>(null);
  const [usageStatsLoading, setUsageStatsLoading] = useState(false);
  const [usageStatsError, setUsageStatsError] = useState<string | null>(null);
  const [usageStatsRecalculating, setUsageStatsRecalculating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadEndpoints() {
      setEndpointLoading(true);
      setEndpointError(null);
      try {
        const data = await listStorageEndpoints();
        if (cancelled) {
          return;
        }
        const cephEndpoints = data.filter((endpoint) => endpoint.provider === "ceph");
        setEndpoints(cephEndpoints);
        if (cephEndpoints.length === 0) {
          setSelectedEndpointId(null);
          setEndpointError(translate(infrastructureMessages.noCephEndpointAvailableForMetrics, locale));
        } else {
          const preferred = cephEndpoints.find((ep) => ep.is_default) || cephEndpoints[0];
          setSelectedEndpointId((current) => current ?? preferred.id);
        }
      } catch (err) {
        if (!cancelled) {
          setEndpoints([]);
          setSelectedEndpointId(null);
          setEndpointError(extractError(err, translate(infrastructureMessages.unableToRetrieveTheEndpointList, locale)));
        }
      } finally {
        if (!cancelled) {
          setEndpointLoading(false);
        }
      }
    }
    loadEndpoints();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    async function loadStorage() {
      if (endpointLoading) {
        return;
      }
      if (selectedEndpointId == null) {
        setStorage(null);
        setStorageLoading(false);
        return;
      }
      setStorage(null);
      setStorageLoading(true);
      setStorageError(null);
      try {
        const data = await fetchAdminStorage(selectedEndpointId);
        if (!cancelled) {
          setStorage(data);
        }
      } catch (err) {
        if (!cancelled) {
          setStorageError(extractError(err, translate(infrastructureMessages.unableToLoadAdminStorageMetrics, locale)));
          setStorage(null);
        }
      } finally {
        if (!cancelled) {
          setStorageLoading(false);
        }
      }
    }
    loadStorage();
    return () => {
      cancelled = true;
    };
  }, [endpointLoading, locale, selectedEndpointId]);

  useEffect(() => {
    let cancelled = false;
    async function loadTraffic() {
      if (endpointLoading) {
        return;
      }
      if (selectedEndpointId == null) {
        setTraffic(null);
        setTrafficLoading(false);
        return;
      }
      setTraffic(null);
      setTrafficLoading(true);
      setTrafficError(null);
      try {
        const data = await fetchAdminTraffic(window, selectedEndpointId);
        if (!cancelled) {
          setTraffic(data);
        }
      } catch (err) {
        if (!cancelled) {
          setTrafficError(extractError(err, translate(infrastructureMessages.unableToRetrieveRGWLogs, locale)));
          setTraffic(null);
        }
      } finally {
        if (!cancelled) {
          setTrafficLoading(false);
        }
      }
    }
    loadTraffic();
    return () => {
      cancelled = true;
    };
  }, [endpointLoading, locale, selectedEndpointId, window]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsageHistoryTrends() {
      if (!generalSettings.usage_history_enabled || endpointLoading) {
        setUsageHistoryTrends(null);
        setUsageHistoryLoading(false);
        setUsageHistoryError(null);
        return;
      }
      if (selectedEndpointId == null) {
        setUsageHistoryTrends(null);
        setUsageHistoryLoading(false);
        return;
      }
      setUsageHistoryTrends(null);
      setUsageHistoryLoading(true);
      setUsageHistoryError(null);
      try {
        const data = await fetchAdminUsageHistoryTrends({
          window: usageHistoryWindow,
          endpointId: selectedEndpointId,
          subjectType: "all",
        });
        if (!cancelled) {
          setUsageHistoryTrends(data);
        }
      } catch (err) {
        if (!cancelled) {
          setUsageHistoryTrends(null);
          setUsageHistoryError(extractError(err, translate(infrastructureMessages.unableToLoadUsageHistoryTrends, locale)));
        }
      } finally {
        if (!cancelled) {
          setUsageHistoryLoading(false);
        }
      }
    }
    loadUsageHistoryTrends();
    return () => {
      cancelled = true;
    };
  }, [endpointLoading, generalSettings.usage_history_enabled, locale, selectedEndpointId, usageHistoryWindow]);

  const loadUsageStatsAggregate = useCallback(async () => {
    if (endpointLoading || selectedEndpointId == null) {
      setUsageStatsAggregate(null);
      setUsageStatsLoading(false);
      setUsageStatsError(null);
      return;
    }
    setUsageStatsLoading(true);
    setUsageStatsError(null);
    try {
      const data = await getAdminUsageStatsAggregate(selectedEndpointId);
      setUsageStatsAggregate(data.aggregate);
    } catch (err) {
      setUsageStatsAggregate(null);
      setUsageStatsError(extractError(err, translate(infrastructureMessages.unableToLoadManagedAccountsUsageComposition, locale)));
    } finally {
      setUsageStatsLoading(false);
    }
  }, [endpointLoading, locale, selectedEndpointId]);

  useEffect(() => {
    void loadUsageStatsAggregate();
  }, [loadUsageStatsAggregate]);

  const handleRecalculateUsageStats = useCallback(async () => {
    if (selectedEndpointId == null) return;
    setUsageStatsRecalculating(true);
    setUsageStatsError(null);
    try {
      await streamAdminUsageStatsAggregate(selectedEndpointId, { parallelism: 8 });
      await loadUsageStatsAggregate();
    } catch (err) {
      setUsageStatsError(extractError(err, translate(infrastructureMessages.unableToRecalculateManagedAccountsUsageComposition, locale)));
    } finally {
      setUsageStatsRecalculating(false);
    }
  }, [loadUsageStatsAggregate, locale, selectedEndpointId]);

  const storageTotals = storage?.storage_totals;
  const accountUsageItems = useMemo(
    () =>
      (storage?.account_usage ?? []).map((account) => ({
        id: account.account_id,
        label: account.account_name || account.account_id,
        usedBytes: account.used_bytes ?? null,
        objectCount: account.object_count ?? null,
      })),
    [storage?.account_usage]
  );

  const userUsageItems = useMemo(
    () =>
      (storage?.s3_user_usage ?? []).map((user) => ({
        id: user.rgw_user_uid || `s3-user-${user.user_id}`,
        label: user.user_name || user.rgw_user_uid || translate({ en: `User #${user.user_id}`, zh: `用户 #${user.user_id}` }, locale),
        usedBytes: user.used_bytes ?? null,
        objectCount: user.object_count ?? null,
      })),
    [locale, storage?.s3_user_usage]
  );

  const missingTraffic = selectedEndpointId != null && !traffic && !trafficLoading && !trafficError;
  const showStorageMetrics = !storageError;
  const showUsageHistoryTrends = Boolean(generalSettings.usage_history_enabled) && selectedEndpointId != null;
  const metricsTabs = useMemo(
    () =>
      [
        { id: "storage" as const, label: translate(infrastructureMessages.storageText, locale) },
        { id: "usage-composition" as const, label: translate(infrastructureMessages.usageComposition, locale) },
        ...(showUsageHistoryTrends ? [{ id: "usage-history" as const, label: translate(infrastructureMessages.usageHistory, locale) }] : []),
        { id: "traffic" as const, label: translate(infrastructureMessages.trafficText, locale) },
      ],
    [locale, showUsageHistoryTrends]
  );
  const usageStatsAggregateSection = (
    <BucketUsageStatsAggregateCard
      title={translate(infrastructureMessages.managedAccountsUsageComposition, locale)}
      description={translate(infrastructureMessages.latestCalculatedBucketSnapshotsForS3AccountsManagedByThe, locale)}
      aggregate={usageStatsAggregate}
      loading={usageStatsLoading}
      error={usageStatsError}
      recalculating={usageStatsRecalculating}
      recalculateLabel={translate(infrastructureMessages.recalculateEndpoint, locale)}
      onRecalculate={handleRecalculateUsageStats}
    />
  );

  useEffect(() => {
    if (!metricsTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(metricsTabs[0]?.id ?? "storage");
    }
  }, [activeTab, metricsTabs]);

  return (
    <div className="space-y-4 ui-caption leading-relaxed">
      <PageHeader
        title={translate(infrastructureMessages.usageMetrics, locale)}
        description={translate(infrastructureMessages.managedAccountUsageCompositionPlatformStorageAndTrafficAnalytics, locale)}
        breadcrumbs={adminPageBreadcrumbs("metrics", locale)}
        rightContent={            <UiSelect
              label={translate(infrastructureMessages.cephEndpoint, locale)}
              value={selectedEndpointId ?? ""}
              onChange={(event) => setSelectedEndpointId(event.target.value ? Number(event.target.value) : null)}
              disabled={endpointLoading || endpoints.length === 0}
              fieldClassName="max-w-full sm:w-64"
              className="ui-list-control"
              size="compact"
            >
              {endpointLoading && <option value="">{translate(infrastructureMessages.loading, locale)}</option>}
              {!endpointLoading && endpoints.length === 0 && <option value="">{translate(infrastructureMessages.noCephEndpoint, locale)}</option>}
              {!endpointLoading &&
                endpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id} title={endpoint.endpoint_url}>
                    {endpoint.is_default ? translate({ en: `${endpoint.name} (default)`, zh: `${endpoint.name}（默认）` }, locale) : endpoint.name}
                  </option>
                ))}
            </UiSelect>}
      />

      {!endpointLoading && selectedEndpointId == null ? (
        <PageEmptyState
          title={translate(infrastructureMessages.noCephEndpointAvailableForMetricsText, locale)}
          description={endpointError || translate(infrastructureMessages.addOrEnableACephEndpointBeforeLoadingPlatformMetrics, locale)}
          primaryAction={{ label: translate(infrastructureMessages.openEndpoints, locale), to: "/admin/endpoints" }}
          tone="warning"
        />
      ) : null}

      {selectedEndpointId != null && (
        <>
          <PageTabs
            tabs={metricsTabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as AdminMetricsTab)}
            variant="line"
            ariaLabel={translate(infrastructureMessages.adminMetricsSections, locale)}
            idPrefix="admin-metrics"
          />

          <PageTabPanel idPrefix="admin-metrics" tabId={activeTab} className="space-y-4 pt-4">
          {activeTab === "storage" ? (
            storageError ? (
              <MetricsUnavailableCard
                title={translate(infrastructureMessages.storageSnapshot, locale)}
                description={translate(infrastructureMessages.aggregatedStatsAcrossKnownS3Accounts, locale)}
                message={storageError}
                tone="warning"
              />
            ) : (
              <>
                <MetricsSummaryCard
                  title={translate(infrastructureMessages.storageSnapshot, locale)}
                  description={translate(infrastructureMessages.aggregatedStatsAcrossKnownS3Accounts, locale)}
                  updatedAt={storage?.generated_at}
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricsSnapshotCard
                      label={translate(infrastructureMessages.storedVolume, locale)}
                      value={storageTotals?.used_bytes != null ? formatBytes(storageTotals.used_bytes) : "—"}
                      hint={translate(infrastructureMessages.sumOfKnownBuckets, locale)}
                      loading={storageLoading}
                    />
                    <MetricsSnapshotCard
                      label={translate(infrastructureMessages.objects, locale)}
                      value={storageTotals?.object_count != null ? formatCompactNumber(storageTotals.object_count) : "—"}
                      hint={translate(infrastructureMessages.instantCount, locale)}
                      loading={storageLoading}
                    />
                    <MetricsSnapshotCard
                      label={translate(infrastructureMessages.visibleBuckets, locale)}
                      value={storageTotals?.bucket_count != null ? formatCompactNumber(storageTotals.bucket_count) : "—"}
                      hint={translate(infrastructureMessages.basedOnRootCredentials, locale)}
                      loading={storageLoading}
                    />
                    <MetricsSnapshotCard
                      label={translate({ en: "S3 accounts", zh: "S3 账户" }, locale)}
                      value={storage ? formatCompactNumber(storage.total_accounts) : "—"}
                      hint={translate({ en: `${formatCompactNumber(storage?.total_s3_users ?? 0)} S3 users`, zh: `${formatCompactNumber(storage?.total_s3_users ?? 0)} 个 S3 用户` }, locale)}
                      loading={storageLoading}
                    />
                  </div>
                </MetricsSummaryCard>

                {showStorageMetrics && (
                  <MetricsCard
                    title={translate(infrastructureMessages.storageBreakdown, locale)}
                    description={translate(infrastructureMessages.accountsAndS3UsersByVolumeAndObjectCount, locale)}
                  >
                    <div className="grid gap-6 xl:grid-cols-2">
                      <UsageBreakdown
                        title={translate(infrastructureMessages.accountsVolume, locale)}
                        loading={storageLoading}
                        metric="bytes"
                        items={accountUsageItems}
                        emptyMessage={translate(infrastructureMessages.noVolumeDataAvailable, locale)}
                      />
                      <UsageBreakdown
                        title={translate(infrastructureMessages.accountsObjects, locale)}
                        loading={storageLoading}
                        metric="objects"
                        items={accountUsageItems}
                        emptyMessage={translate(infrastructureMessages.noObjectDataAvailable, locale)}
                      />
                    </div>
                    <div className="grid gap-6 xl:grid-cols-2">
                      <UsageBreakdown
                        title={translate({ en: "S3 users (volume)", zh: "S3 用户（容量）" }, locale)}
                        loading={storageLoading}
                        metric="bytes"
                        items={userUsageItems}
                        emptyMessage={translate(infrastructureMessages.noS3UsersWithMetrics, locale)}
                      />
                      <UsageBreakdown
                        title={translate({ en: "S3 users (objects)", zh: "S3 用户（对象数）" }, locale)}
                        loading={storageLoading}
                        metric="objects"
                        items={userUsageItems}
                        emptyMessage={translate(infrastructureMessages.noS3UsersWithMetrics, locale)}
                      />
                    </div>
                  </MetricsCard>
                )}
              </>
            )
          ) : null}

          {activeTab === "usage-composition" ? usageStatsAggregateSection : null}

          {activeTab === "usage-history" && showUsageHistoryTrends && (
            <UsageHistoryTrendsSection
              trends={usageHistoryTrends}
              window={usageHistoryWindow}
              onWindowChange={setUsageHistoryWindow}
              loading={usageHistoryLoading}
              error={usageHistoryError}
              description={translate(infrastructureMessages.storedQuotaSnapshotsAcrossAccountsAndS3UsersForThe, locale)}
            />
          )}

          {activeTab === "traffic" ? (
            <MetricsTrafficOverview
              traffic={traffic}
              window={window}
              onWindowChange={setWindow}
              loading={trafficLoading}
              error={trafficError}
              showEmpty={missingTraffic}
            />
          ) : null}
          </PageTabPanel>
        </>
      )}
    </div>
  );
}
