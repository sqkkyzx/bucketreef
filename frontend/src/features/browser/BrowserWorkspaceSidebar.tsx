import { useI18n, type I18nMessage } from "../../i18n";
/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { Ref } from "react";
import {
  toolbarCompactButtonClasses,
  toolbarCompactInputClasses,
} from "../../components/toolbarControlClasses";
import UiMeterBar from "../../components/ui/UiMeterBar";
import StorageSpaceIcon from "../../components/StorageSpaceIcon";
import { cx } from "../../components/ui/styles";
import type { BrowserBucket, BrowserUsageSummary } from "../../api/browserContracts";
import { formatBytes } from "../../utils/format";
import {
  BucketCollectionIcon,
  BucketIcon,
  OpenIcon,
  RefreshIcon,
  SearchIcon,
} from "./browserIcons";
import type { BucketAccessEntry, BucketAccessStatus } from "./browserBucketsPanelHelpers";

type BrowserWorkspaceSidebarBucketRow = {
  bucket: BrowserBucket;
  access: BucketAccessEntry;
};

type BrowserWorkspaceSidebarProps = {
  compact: boolean;
  variant: "desktop" | "mobile";
  isPortalContext: boolean;
  rows: BrowserWorkspaceSidebarBucketRow[];
  activeBucketName: string;
  bucketFilter: string;
  loadingBuckets: boolean;
  bucketError: string | null;
  bucketManagementEnabled: boolean;
  canLoadMore: boolean;
  bucketMenuLoadingMore: boolean;
  bucketMenuTotal: number;
  bucketTotalCount: number;
  usageSummary: BrowserUsageSummary | null;
  usageLoading: boolean;
  usageError: string | null;
  panelViewportRef?: Ref<HTMLDivElement>;
  loadMoreSentinelRef?: Ref<HTMLDivElement>;
  closeMobile: () => void;
  onBucketFilterChange: (value: string) => void;
  onRetryBuckets: () => void;
  onCreateBucket: () => void;
  onSelectBucket: (bucketName: string) => void;
  onLoadMore: () => void;
  workspaceAccountAction?: {
    label: string;
    title: string;
    onClick: () => void;
  };
};

const accessIndicatorClasses: Record<BucketAccessStatus, string> = {
  unknown: "border-slate-300 bg-slate-200 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300",
  checking:
    "border-sky-300 bg-sky-200 text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/30 dark:text-sky-100",
  available:
    "border-emerald-300 bg-emerald-200 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/30 dark:text-emerald-100",
  unavailable:
    "border-amber-300 bg-amber-200 text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/30 dark:text-amber-100",
};

const accessLabel: Record<BucketAccessStatus, I18nMessage> = {
  unknown: {
    en: "Idle",
    fr: "En attente",
    de: "Inaktiv",
    zh: "待检查",
  },
  checking: {
    en: "Checking",
    fr: "Vérification",
    de: "Wird geprüft",
    zh: "正在检查",
  },
  available: {
    en: "Ready",
    fr: "Prêt",
    de: "Bereit",
    zh: "就绪",
  },
  unavailable: {
    en: "No list access",
    fr: "Liste inaccessible",
    de: "Kein Listenzugriff",
    zh: "无列表访问权限",
  },
};
const unavailableBucketTitle = {
  en: "Listing not allowed with current credentials.",
  fr: "Les identifiants actuels ne permettent pas de lister le contenu.",
  de: "Die aktuellen Zugangsdaten erlauben kein Auflisten.",
  zh: "当前凭据无权列出内容。",
};

function getBucketDisplayName(bucket: BrowserBucket, isPortalContext: boolean): string {
  if (isPortalContext) {
    return bucket.display_name?.trim() || bucket.workspace_label?.trim() || bucket.name;
  }
  return bucket.display_name?.trim() || bucket.name;
}

function formatUsagePercent(summary: BrowserUsageSummary): number | null {
  const used = summary.used_bytes;
  const quota = summary.quota_max_size_bytes;
  if (used == null || quota == null || quota <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, (used / quota) * 100));
}

export default function BrowserWorkspaceSidebar({
  compact,
  variant,
  isPortalContext,
  rows,
  activeBucketName,
  bucketFilter,
  loadingBuckets,
  bucketError,
  bucketManagementEnabled,
  canLoadMore,
  bucketMenuLoadingMore,
  bucketMenuTotal,
  bucketTotalCount,
  usageSummary,
  usageLoading,
  usageError,
  panelViewportRef,
  loadMoreSentinelRef,
  closeMobile,
  onBucketFilterChange,
  onRetryBuckets,
  onCreateBucket,
  onSelectBucket,
  onLoadMore,
  workspaceAccountAction,
}: BrowserWorkspaceSidebarProps) {
  const { t } = useI18n();
  const title = isPortalContext ? t({
    en: "Storage Spaces",
    fr: "Espaces de stockage",
    de: "Speicherbereiche",
    zh: "存储空间",
  }) : t({
    en: "Buckets",
    fr: "Buckets",
    de: "Buckets",
    zh: "存储桶",
  });
  const searchPlaceholder = isPortalContext ? t({
    en: "Search storage spaces",
    fr: "Rechercher des espaces de stockage",
    de: "Speicherbereiche suchen",
    zh: "搜索存储空间",
  }) : t({
    en: "Search buckets",
    fr: "Rechercher des buckets",
    de: "Buckets suchen",
    zh: "搜索存储桶",
  });
  const hasUsageGauge =
    usageSummary?.available === true && usageSummary.used_bytes != null;
  const usagePercent = usageSummary ? formatUsagePercent(usageSummary) : null;
  const usageUsedLabel =
    usageSummary?.used_bytes == null ? null : formatBytes(usageSummary.used_bytes);
  const usageQuotaLabel =
    usageSummary?.quota_max_size_bytes != null && usageSummary.quota_max_size_bytes > 0
      ? formatBytes(usageSummary.quota_max_size_bytes)
      : null;
  const totalLabel = t({ en: bucketTotalCount === 1 ? "1 item" : `${bucketTotalCount} items`, fr: `${bucketTotalCount} élément${bucketTotalCount === 1 ? "" : "s"}`, de: `${bucketTotalCount} Eintr${bucketTotalCount === 1 ? "ag" : "äge"}`, zh: `${bucketTotalCount} 项` });
  const filteredLabel =
    bucketFilter.trim().length > 0 && bucketMenuTotal !== bucketTotalCount
      ? t({ en: `${bucketMenuTotal} result${bucketMenuTotal === 1 ? "" : "s"}`, fr: `${bucketMenuTotal} résultat${bucketMenuTotal === 1 ? "" : "s"}`, de: `${bucketMenuTotal} Ergebnis${bucketMenuTotal === 1 ? "" : "se"}`, zh: `${bucketMenuTotal} 个结果` })
      : totalLabel;
  const emptyListLabel = bucketError
    ? isPortalContext
      ? t({
        en: "Storage Spaces list unavailable.",
        fr: "Liste des espaces de stockage indisponible.",
        de: "Speicherbereichsliste nicht verfügbar.",
        zh: "存储空间列表不可用。",
      })
      : t({
        en: "Bucket list unavailable.",
        fr: "Liste des buckets indisponible.",
        de: "Bucket-Liste nicht verfügbar.",
        zh: "存储桶列表不可用。",
      })
    : bucketFilter.trim()
      ? t({
        en: "No matching item.",
        fr: "Aucun élément correspondant.",
        de: "Keine passenden Einträge.",
        zh: "没有匹配项。",
      })
      : isPortalContext ? t({ en: "No storage spaces available.", fr: "Aucun espace de stockage disponible.", de: "Keine Speicherbereiche verfügbar.", zh: "没有可用的存储空间。" }) : t({ en: "No buckets available.", fr: "Aucun bucket disponible.", de: "Keine Buckets verfügbar.", zh: "没有可用的存储桶。" });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label={title}
      data-testid="browser-workspace-sidebar"
    >
      {!compact && (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--shell-border-soft)] px-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BucketCollectionIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[var(--shell-text)]">{title}</p>
            <p className="truncate text-[11px] font-medium text-[var(--shell-muted-text)]">{filteredLabel}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--shell-muted-text)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRetryBuckets}
            disabled={loadingBuckets}
            aria-label={isPortalContext ? t({ en: "Refresh storage spaces", fr: "Actualiser les espaces de stockage", de: "Speicherbereiche aktualisieren", zh: "刷新存储空间" }) : t({ en: "Refresh buckets", fr: "Actualiser les buckets", de: "Buckets aktualisieren", zh: "刷新存储桶" })}
            title={loadingBuckets ? t({
              en: "Refreshing",
              fr: "Actualisation",
              de: "Wird aktualisiert",
              zh: "正在刷新",
            }) : t({
              en: "Refresh",
              fr: "Actualiser",
              de: "Aktualisieren",
              zh: "刷新",
            })}
          >
            <RefreshIcon className={cx("h-3.5 w-3.5", loadingBuckets ? "animate-spin" : "")} />
          </button>
        </div>
      )}

      {!compact && (
        <div className="shrink-0 space-y-2 border-b border-[color:var(--shell-border-soft)] px-3 py-3">
          <label className="block">
            <span className="sr-only">{searchPlaceholder}</span>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={bucketFilter}
                onChange={(event) => onBucketFilterChange(event.target.value)}
                placeholder={searchPlaceholder}
                className={cx(toolbarCompactInputClasses, "w-full py-2 ui-list-control-with-icon font-medium")}
                spellCheck={false}
              />
            </div>
          </label>
          {bucketManagementEnabled && (
            <div className="flex items-center gap-1.5">
              <button type="button" className={toolbarCompactButtonClasses} onClick={onCreateBucket}>
                {t({
                  en: "+ Bucket",
                  fr: "+ Bucket",
                  de: "+ Bucket",
                  zh: "+ 存储桶",
                })}</button>
            </div>
          )}
        </div>
      )}

      <div
        ref={panelViewportRef}
        className={`shell-sidebar-scroll min-h-0 flex-1 overflow-y-auto ${compact ? "px-2 py-2" : "px-2.5 py-3"}`}
      >
        <div className="space-y-1.5">
          {rows.map(({ bucket, access }) => {
            const isActive = bucket.name === activeBucketName;
            const displayName = getBucketDisplayName(bucket, isPortalContext);
            const description = isPortalContext ? bucket.description?.trim() : "";
            const rowTitle =
              access.status === "unavailable"
                ? t(unavailableBucketTitle)
                : isPortalContext
                  ? displayName
                  : bucket.name;
            const rowClasses = compact
              ? `relative flex h-9 w-full items-center justify-center rounded-md transition ${
                  isActive ? "shell-sidebar-item-active" : "shell-sidebar-item"
                }`
              : `relative flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-medium leading-4 transition ${
                  isActive
                    ? "shell-sidebar-item-active before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-primary"
                    : "shell-sidebar-item"
                }`;
            return (
              <button
                key={bucket.name}
                type="button"
                className={rowClasses}
                onClick={() => {
                  onSelectBucket(bucket.name);
                  if (variant === "mobile") {
                    closeMobile();
                  }
                }}
                title={rowTitle}
                aria-current={isActive ? "page" : undefined}
                data-bucket-panel-name={bucket.name}
              >
                {isPortalContext ? (
                  <StorageSpaceIcon
                    icon={bucket.icon}
                    name={displayName}
                    size="sidebar"
                    decorative
                  />
                ) : (
                  <BucketIcon className="h-4 w-4 shrink-0" />
                )}
                {!compact && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{displayName}</span>
                      {isPortalContext && description && (
                        <span
                          className="block truncate text-[11px] font-medium text-[var(--shell-muted-text)]"
                          title={description}
                        >
                          {description}
                        </span>
                      )}
                      {!isPortalContext && bucket.workspace_label && (
                        <span className="block truncate text-[11px] font-medium text-[var(--shell-muted-text)]">
                          {bucket.workspace_label}
                        </span>
                      )}
                    </span>
                    <span
                      className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full border ${accessIndicatorClasses[access.status]}`}
                      aria-label={t(accessLabel[access.status])}
                      title={
                        access.status === "unavailable"
                          ? t(unavailableBucketTitle)
                          : t(accessLabel[access.status])
                      }
                    >
                      <span className="sr-only">{t(accessLabel[access.status])}</span>
                    </span>
                  </>
                )}
              </button>
            );
          })}
          {loadingBuckets && rows.length === 0 && !compact && (
            <p className="px-2 py-2 ui-caption text-[var(--shell-muted-text)]">{t({
              en: "Loading...",
              fr: "Chargement…",
              de: "Wird geladen…",
              zh: "正在加载…",
            })}</p>
          )}
          {!loadingBuckets && rows.length === 0 && !compact && (
            <p className="px-2 py-2 ui-caption text-[var(--shell-muted-text)]">
              {emptyListLabel}
            </p>
          )}
          {canLoadMore && !compact && (
            <button
              type="button"
              className={cx(toolbarCompactButtonClasses, "mx-1 mt-2 w-[calc(100%-0.5rem)] justify-center")}
              onClick={onLoadMore}
              disabled={bucketMenuLoadingMore}
            >
              {bucketMenuLoadingMore ? t({
                en: "Loading...",
                fr: "Chargement…",
                de: "Wird geladen…",
                zh: "正在加载…",
              }) : t({
                en: "Load more",
                fr: "Charger plus",
                de: "Mehr laden",
                zh: "加载更多",
              })}
            </button>
          )}
          {loadMoreSentinelRef && <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-1" />}
        </div>
      </div>

      <div className={`sticky bottom-0 shrink-0 border-t border-[color:var(--shell-border-soft)] bg-[var(--shell-bg)] ${compact ? "px-2 py-2" : "space-y-2 px-3 py-3"}`}>
        {workspaceAccountAction && (
          <button
            type="button"
            className={
              compact
                ? "flex h-9 w-full items-center justify-center rounded-md shell-sidebar-item"
                : cx(toolbarCompactButtonClasses, "inline-flex w-full items-center justify-center gap-2")
            }
            onClick={workspaceAccountAction.onClick}
            aria-label={workspaceAccountAction.label}
            title={workspaceAccountAction.title}
          >
            <OpenIcon className="h-3.5 w-3.5" />
            {!compact && <span>{workspaceAccountAction.label}</span>}
          </button>
        )}
        {!compact && usageLoading && (
          <p className="ui-caption text-[var(--shell-muted-text)]">{t({
            en: "Loading usage...",
            fr: "Chargement de l’utilisation…",
            de: "Auslastung wird geladen…",
            zh: "正在加载用量…",
          })}</p>
        )}
        {!compact && usageError && (
          <p className="ui-caption font-semibold text-amber-700 dark:text-amber-200">{usageError}</p>
        )}
        {!compact && hasUsageGauge && usageSummary && (
          <div className="space-y-2" aria-label={t({
            en: "Usage summary",
            fr: "Résumé de l’utilisation",
            de: "Auslastungsübersicht",
            zh: "用量概览",
          })}>
            {usagePercent != null && (
              <UiMeterBar
                value={usagePercent}
                label={t({
                  en: "Storage usage",
                  fr: "Utilisation du stockage",
                  de: "Speicherauslastung",
                  zh: "存储用量",
                })}
                className="h-2 bg-slate-200 shadow-inner dark:bg-slate-800"
                barClassName="bg-primary transition-[width]"
              />
            )}
            <p className="truncate text-[13px] font-medium text-[var(--shell-text)]">
              <span className="text-[var(--shell-muted-text)]">{t({
                en: "Usage:",
                fr: "Utilisation :",
                de: "Auslastung:",
                zh: "用量：",
              })}</span>
              <span className="font-semibold">{usageUsedLabel}</span>
              {usageQuotaLabel && (
                <>
                  <span className="text-[var(--shell-muted-text)]"> {" "}{t({
                    en: "of",
                    fr: "sur",
                    de: "von",
                    zh: "/",
                  })}{" "}</span>
                  <span className="font-semibold">{usageQuotaLabel}</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
