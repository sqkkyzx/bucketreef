/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { BucketUsageStatsSnapshot } from "../../api/bucketUsageStats";
import { MetricsCard, MetricsEmptyState } from "../../components/MetricsCard";
import PageBanner from "../../components/PageBanner";
import { cx, uiButtonBaseClass, uiButtonVariants } from "../../components/ui/styles";
import { useManagerBucketDetailText } from "../manager/managerBucketDetailMessages";
import { formatCompactNumber } from "../../utils/format";
import { formatLocalDateTime } from "../../utils/dateTime";
import { BucketUsageStatsCompositionVisuals } from "./BucketUsageStatsVisuals";

type BucketUsageStatsPanelProps = {
  snapshot?: BucketUsageStatsSnapshot | null;
  loading?: boolean;
  error?: string | null;
  recalculating?: boolean;
  onRefresh?: () => void;
  onRecalculate?: () => void;
};

export default function BucketUsageStatsPanel({
  snapshot,
  loading,
  error,
  recalculating,
  onRefresh,
  onRecalculate,
}: BucketUsageStatsPanelProps) {
  const { t } = useManagerBucketDetailText();

  return (
    <MetricsCard
      title={t("Usage stats")}
      description={t("Latest persisted calculation from object listings. Space ratios use logical object-version bytes.")}
      actions={
        <>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || recalculating}
              className={cx(uiButtonBaseClass, uiButtonVariants.secondary)}
            >
              {loading ? t("Loading...") : t("Refresh")}
            </button>
          )}
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={recalculating}
              className={cx(uiButtonBaseClass, uiButtonVariants.primary)}
            >
              {recalculating ? t("Calculating...") : t("Recalculate")}
            </button>
          )}
        </>
      }
    >

      {error && <PageBanner tone="error">{t(error)}</PageBanner>}
      {snapshot?.warnings?.map((warning) => (
        <PageBanner key={warning} tone="warning">{t(warning)}</PageBanner>
      ))}

      {loading && !snapshot ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-20 animate-pulse rounded-lg bg-[var(--ui-surface-muted)]" />
          ))}
        </div>
      ) : !snapshot ? (
        <MetricsEmptyState>
          <span className="block font-semibold text-[var(--ui-text)]">{t("No usage stats calculated yet.")}</span>
          <span className="block ui-caption">{t("Run a calculation to persist the latest bucket snapshot.")}</span>
        </MetricsEmptyState>
      ) : (
        <BucketUsageStatsCompositionVisuals
          stats={snapshot}
          finalMetric={{
            label: t("Delete markers"),
            value: formatCompactNumber(snapshot.delete_marker_count),
            hint: t({
              en: `Calculated ${formatLocalDateTime(snapshot.calculated_at)}`,
              zh: `计算时间：${formatLocalDateTime(snapshot.calculated_at)}`,
            }),
          }}
          showVersionListingWarning={!snapshot.version_listing_available}
        />
      )}
    </MetricsCard>
  );
}
