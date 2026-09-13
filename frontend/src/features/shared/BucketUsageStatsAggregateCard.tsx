/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate, useI18n } from "../../i18n";
import { infrastructureMessages } from "../../infrastructureMessages";
import type { BucketUsageStatsAggregate } from "../../api/bucketUsageStats";
import { MetricsCard, MetricsEmptyState } from "../../components/MetricsCard";
import PageBanner from "../../components/PageBanner";
import {
  cx,
  uiButtonBaseClass,
  uiButtonVariants,
  uiMutedTextClass,
  uiTitleTextClass,
} from "../../components/ui/styles";
import { formatLocalDateTime } from "../../utils/dateTime";
import {
  BucketUsageStatsCompositionVisuals,
  type BucketUsageStatsCompositionLabels,
} from "./BucketUsageStatsVisuals";

type BucketUsageStatsAggregateCardProps = {
  title: string;
  description: string;
  aggregate?: BucketUsageStatsAggregate | null;
  loading?: boolean;
  error?: string | null;
  recalculating?: boolean;
  recalculateLabel: string;
  onRecalculate?: () => void;
  className?: string;
  coverageItemLabel?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  compositionLabels?: BucketUsageStatsCompositionLabels;
};

export default function BucketUsageStatsAggregateCard({
  title,
  description,
  aggregate,
  loading,
  error,
  recalculating,
  recalculateLabel,
  onRecalculate,
  className,
  coverageItemLabel: coverageItemLabelOverride,
  emptyDescription,
  emptyTitle: emptyTitleOverride,
  compositionLabels,
}: BucketUsageStatsAggregateCardProps) {
  const { locale } = useI18n();
  const emptyTitle = emptyTitleOverride ?? translate(infrastructureMessages.noUsageStatsCalculatedYet, locale);
  const coverageItemLabel = coverageItemLabelOverride ?? (locale === "zh" ? "个存储桶" : "buckets");
  const hasSnapshot = Boolean(aggregate && aggregate.buckets_with_snapshot > 0);
  const coverageLabel = aggregate
    ? locale === "zh" ? `已覆盖 ${aggregate.buckets_with_snapshot} / ${aggregate.bucket_count} ${coverageItemLabel}` : `${aggregate.buckets_with_snapshot} / ${aggregate.bucket_count} ${coverageItemLabel} covered`
    : "";
  const lastCalculated = aggregate?.newest_snapshot_at ? `${locale === "zh" ? "最新" : "Latest"} ${formatLocalDateTime(aggregate.newest_snapshot_at)}` : undefined;
  const accountCoverage =
    aggregate?.managed_account_count != null
      ? locale === "zh" ? `已列出 ${aggregate.accounts_with_listed_buckets ?? 0} / ${aggregate.managed_account_count} 个托管账户` : `${aggregate.accounts_with_listed_buckets ?? 0} / ${aggregate.managed_account_count} managed accounts listed`
      : undefined;
  const coverageHint = accountCoverage ? `${accountCoverage}${lastCalculated ? ` · ${lastCalculated}` : ""}` : lastCalculated;

  return (
    <MetricsCard
      title={title}
      description={description}
      className={className}
      actions={
        onRecalculate ? (
          <button
            type="button"
            onClick={onRecalculate}
            disabled={loading || recalculating}
            className={cx(uiButtonBaseClass, uiButtonVariants.secondary, "shrink-0")}
          >
            {recalculating ? translate(infrastructureMessages.calculating, locale) : recalculateLabel}
          </button>
        ) : null
      }
    >

      {error && <PageBanner tone="error">{error}</PageBanner>}

      {loading && !aggregate ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-md bg-[var(--ui-surface-muted)]" />
          ))}
        </div>
      ) : !aggregate || !hasSnapshot ? (
        <MetricsEmptyState>
          <span className={cx("block font-semibold", uiTitleTextClass)}>{emptyTitle}</span>
          <span className={cx("block ui-caption", uiMutedTextClass)}>
            {emptyDescription ??
              (aggregate?.bucket_count
                ? locale === "zh" ? `已覆盖 0 / ${aggregate.bucket_count} ${coverageItemLabel}。` : `0 / ${aggregate.bucket_count} ${coverageItemLabel} covered.`
                : translate(infrastructureMessages.runACalculationToCreateTheFirstSnapshot, locale))}
          </span>
        </MetricsEmptyState>
      ) : (
        <>
          {aggregate.warnings.map((warning) => (
            <PageBanner key={warning} tone="warning">{warning}</PageBanner>
          ))}

          <BucketUsageStatsCompositionVisuals
            stats={aggregate}
            finalMetric={{ label: translate(infrastructureMessages.coverage, locale), value: coverageLabel, hint: coverageHint }}
            currentVsNoncurrentEmptyMessage={translate(infrastructureMessages.currentnoncurrentUnavailable, locale)}
            labels={compositionLabels}
          />
        </>
      )}
    </MetricsCard>
  );
}
