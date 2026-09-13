/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate, useI18n } from "../i18n";
import { infrastructureMessages } from "../infrastructureMessages";
import { type ReactNode, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageHistoryTrendResponse, UsageHistoryTrendWindow } from "../api/usageHistory";
import { formatBytes, formatBytesAxis, formatCompactNumber, formatPercentage } from "../utils/format";
import { MetricsCard, MetricsChartPanel } from "./MetricsCard";
import MetricsUnavailableCard from "./MetricsUnavailableCard";
import { MetricsSnapshotCard } from "./MetricsTrafficOverview";
import UiSegmentedControl from "./ui/UiSegmentedControl";
import { formatChartTooltipTimestamp, type ChartTooltipProps } from "./chartTooltip";
import {
  cx,
  uiMenuClass,
} from "./ui/styles";



type TrendPoint = UsageHistoryTrendResponse["points"][number] & {
  timestampMs: number;
};

type UsageHistoryTrendsSectionProps = {
  trends: UsageHistoryTrendResponse | null;
  window: UsageHistoryTrendWindow;
  onWindowChange: (value: UsageHistoryTrendWindow) => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  labels?: {
    unavailableDescription?: string;
    latestStorage?: string;
    latestStorageHint?: string;
    latestObjects?: string;
    latestObjectsHint?: string;
    maxQuotaRatio?: string;
    maxQuotaHint?: string;
    snapshots?: string;
    snapshotsHint?: string;
    storageChartTitle?: string;
    storageChartSubtitle?: string;
    inventoryChartTitle?: string;
    inventoryChartSubtitle?: string;
    storageLineName?: string;
    objectLineName?: string;
    bucketLineName?: string;
    emptyMessage?: string;
  };
};

export default function UsageHistoryTrendsSection({
  trends,
  window,
  onWindowChange,
  loading,
  error,
  title: titleOverride,
  description,
  labels,
}: UsageHistoryTrendsSectionProps) {
  const { locale } = useI18n();
  const title = titleOverride ?? translate(infrastructureMessages.usageHistory, locale);
const WINDOW_OPTIONS: { label: string; value: UsageHistoryTrendWindow; helper: string }[] = [
  { label: translate(infrastructureMessages.window24h, locale), value: "day", helper: translate(infrastructureMessages.hourlySnapshots, locale) },
  { label: translate(infrastructureMessages.window7d, locale), value: "week", helper: translate(infrastructureMessages.dailySnapshots, locale) },
  { label: translate(infrastructureMessages.window30d, locale), value: "month", helper: translate(infrastructureMessages.dailySnapshots, locale) },
];
  const chartData = useMemo<TrendPoint[]>(
    () =>
      (trends?.points ?? [])
        .map((point) => ({
          ...point,
          timestampMs: new Date(point.period_start).getTime(),
        }))
        .filter((point) => Number.isFinite(point.timestampMs))
        .sort((a, b) => a.timestampMs - b.timestampMs),
    [trends?.points]
  );
  const domain = useMemo(() => {
    if (!chartData.length) return undefined;
    const minTs = chartData[0]?.timestampMs;
    const maxTs = chartData[chartData.length - 1]?.timestampMs;
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return undefined;
    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const halfStep = window === "day" ? hourMs / 2 : dayMs / 2;
    return [minTs - halfStep, maxTs + halfStep] as [number, number];
  }, [chartData, window]);
  const summary = trends?.summary;
  const hasData = chartData.length > 0;
  const helper = WINDOW_OPTIONS.find((option) => option.value === window)?.helper ?? translate(infrastructureMessages.storedSnapshots, locale);
  const subtitle = description ?? `${helper} from collected quota usage history.`;

  if (error) {
    return (
      <MetricsUnavailableCard
        title={title}
        description={labels?.unavailableDescription ?? translate(infrastructureMessages.storedQuotaSnapshotsOverTime, locale)}
        message={error}
        tone="error"
      />
    );
  }

  if (trends && !trends.available) {
    return (
      <MetricsUnavailableCard
        title={title}
        description={labels?.unavailableDescription ?? translate(infrastructureMessages.storedQuotaSnapshotsOverTime, locale)}
        message={trends.unavailable_reason || translate(infrastructureMessages.usageHistoryTrendsAreUnavailableForThisContext, locale)}
      />
    );
  }

  return (
    <MetricsCard
      title={title}
      description={subtitle}
      actions={
        <UiSegmentedControl
          ariaLabel={`${title} window`}
          options={WINDOW_OPTIONS}
          value={window}
          onChange={onWindowChange}
        />
      }
    >

      <div className="grid gap-4 md:grid-cols-4">
        <MetricsSnapshotCard
          label={labels?.latestStorage ?? translate(infrastructureMessages.latestStorage, locale)}
          value={formatBytes(summary?.latest_used_bytes ?? 0)}
          hint={labels?.latestStorageHint ?? translate({ en: `${formatCompactNumber(summary?.subjects_count ?? 0)} subjects`, zh: `${formatCompactNumber(summary?.subjects_count ?? 0)} 个统计主体` }, locale)}
          loading={loading}
        />
        <MetricsSnapshotCard
          label={labels?.latestObjects ?? translate(infrastructureMessages.latestObjects, locale)}
          value={formatCompactNumber(summary?.latest_used_objects ?? 0)}
          hint={labels?.latestObjectsHint ?? translate({ en: `${formatCompactNumber(summary?.latest_bucket_count ?? 0)} buckets`, zh: `${formatCompactNumber(summary?.latest_bucket_count ?? 0)} 个存储桶` }, locale)}
          loading={loading}
        />
        <MetricsSnapshotCard
          label={labels?.maxQuotaRatio ?? translate(infrastructureMessages.maxQuotaRatio, locale)}
          value={formatPercentage(summary?.max_usage_ratio_pct)}
          hint={labels?.maxQuotaHint ?? translate(infrastructureMessages.highestPoint, locale)}
          loading={loading}
        />
        <MetricsSnapshotCard
          label={labels?.snapshots ?? translate(infrastructureMessages.snapshots, locale)}
          value={formatCompactNumber(summary?.total_records ?? 0)}
          hint={labels?.snapshotsHint ?? translate({ en: `${formatCompactNumber(summary?.points_count ?? 0)} periods`, zh: `${formatCompactNumber(summary?.points_count ?? 0)} 个时段` }, locale)}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={labels?.storageChartTitle ?? translate(infrastructureMessages.storageEvolution, locale)}
          subtitle={labels?.storageChartSubtitle ?? translate(infrastructureMessages.usedBytesOverTime, locale)}
          loading={loading}
          hasData={hasData}
          emptyMessage={labels?.emptyMessage}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="timestampMs"
                type="number"
                domain={domain ?? ["auto", "auto"]}
                scale="time"
                tickFormatter={(value) => formatAxisTimestamp(value, window)}
                stroke="#94A3B8"
                minTickGap={32}
              />
              <YAxis tickFormatter={(value) => formatBytesAxis(Number(value) || 0)} stroke="#94A3B8" />
              <Tooltip content={<UsageHistoryTooltip window={window} metric="storage" />} />
              <Area type="monotone" dataKey="used_bytes" name={labels?.storageLineName ?? translate(infrastructureMessages.storageText, locale)} stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.16} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={labels?.inventoryChartTitle ?? translate(infrastructureMessages.objectsBuckets, locale)}
          subtitle={labels?.inventoryChartSubtitle ?? translate(infrastructureMessages.inventorySnapshotsOverTime, locale)}
          loading={loading}
          hasData={hasData}
          emptyMessage={labels?.emptyMessage}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="timestampMs"
                type="number"
                domain={domain ?? ["auto", "auto"]}
                scale="time"
                tickFormatter={(value) => formatAxisTimestamp(value, window)}
                stroke="#94A3B8"
                minTickGap={32}
              />
              <YAxis tickFormatter={(value) => formatCompactNumber(Number(value) || 0)} stroke="#94A3B8" />
              <Tooltip content={<UsageHistoryTooltip window={window} metric="inventory" />} />
              <Legend />
              <Line type="monotone" dataKey="used_objects" name={labels?.objectLineName ?? translate(infrastructureMessages.objects, locale)} stroke="#0EA5E9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bucket_count" name={labels?.bucketLineName ?? translate(infrastructureMessages.buckets, locale)} stroke="#14B8A6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </MetricsCard>
  );
}

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  hasData?: boolean;
  emptyMessage?: string;
};

function ChartCard({ title, subtitle, children, loading, hasData, emptyMessage }: ChartCardProps) {
  const { locale } = useI18n();
  return (
    <MetricsChartPanel
      title={title}
      description={subtitle}
      loading={loading}
      hasData={hasData}
      emptyMessage={emptyMessage ?? translate(infrastructureMessages.noUsageHistorySnapshotsForThisWindowYet, locale)}
    >
      {children}
    </MetricsChartPanel>
  );
}

function formatAxisTimestamp(value: string | number, window: UsageHistoryTrendWindow) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (window === "day") {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(date);
}

type UsageHistoryTooltipProps = ChartTooltipProps & {
  window: UsageHistoryTrendWindow;
  metric: "storage" | "inventory";
};

function UsageHistoryTooltip({ payload, label, window, metric }: UsageHistoryTooltipProps) {
  if (!payload?.length) return null;
  const formatted = formatChartTooltipTimestamp(label, window === "day" ? "hourly" : "daily");
  return (
    <div className={cx(uiMenuClass, "px-3 py-2 ui-body")}>
      <p className="font-semibold">{formatted}</p>
      {payload.map((entry, index) => (
        <p key={entry.dataKey ?? entry.name ?? index} className="ui-caption">
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {String(entry.name ?? "")}: {formatTooltipValue(String(entry.name ?? ""), entry.value, metric)}
        </p>
      ))}
    </div>
  );
}

function formatTooltipValue(_name: string, value: unknown, metric: "storage" | "inventory") {
  const numeric = Number(value) || 0;
  if (metric === "storage") return formatBytes(numeric);
  return formatCompactNumber(numeric);
}
