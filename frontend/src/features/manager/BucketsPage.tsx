/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import TableSortControls from "../../components/list/TableSortControls";
import { ListActions, ListBadge, ListActionButton, ListActionLink } from "../../components/list/ListControls";
import { isApiError } from "../../api/client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import ListPageSection from "../../components/list/ListPageSection";
import PageEmptyState from "../../components/PageEmptyState";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import { cx, uiButtonBaseClass, uiButtonVariants, uiCheckboxClass } from "../../components/ui/styles";
import {
  createBucket,
  deleteBucket,
  listBuckets,
} from "../../api/managerBuckets";
import {
  getBucketCors,
  getBucketLogging,
  getBucketNotifications,
  getBucketPolicy,
  getBucketProperties,
  getBucketWebsite,
} from "../../api/bucketDetails";
import type {
  Bucket,
  BucketFeatureStatus,
  BucketProperties,
  BucketTag,
} from "../../api/bucketContracts";
import { S3AccountSelector } from "../../api/accountParams";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import PageHeader from "../../components/PageHeader";
import PageBanner from "../../components/PageBanner";
import WorkflowPage, { workflowPageHostClass } from "../../components/WorkflowPage";
import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import DataTableShell, {
  dataTableDefaultActionProps,
  type DataTableColumn,
} from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import UiMeterBar from "../../components/ui/UiMeterBar";

import ColumnVisibilityMenu from "../../components/ColumnVisibilityMenu";
import PropertySummaryChip from "../../components/PropertySummaryChip";
import {
  S3_BUCKET_NAME_MAX_LENGTH,
  isValidS3BucketName,
  normalizeS3BucketName,
  normalizeS3BucketNameInput,
} from "../../utils/s3BucketName";
import { extractApiError } from "../../utils/apiError";
import { formatBytes, formatNumber } from "../../utils/format";
import { stableSignature } from "../../utils/stableSignature";
import { compareByNullableField, nextSortState, type SortableField } from "../../utils/sortValues";
import { getManagerToolAccess, readStoredUser } from "../../utils/workspaces";
import {
  readSessionJsonFromKey,
  writeSessionJsonToKey,
} from "../../utils/clientStorage";
import { formatAccountLabel } from "../shared/storageEndpointLabel";
import BucketPurgeRunModal from "../shared/BucketPurgeRunModal";
import { BucketFeatureSummaryChip, BucketSummaryTooltip } from "../shared/BucketFeatureSummaryTooltip";
import type { BucketFeatureTooltipState } from "../shared/BucketFeatureSummaryTooltip";
import {
  buildBucketPolicySummaryLines,
  buildBucketTagSummaryLines,
  buildCorsRuleSummaryLines,
  buildLifecycleRuleSummaryLines,
  buildLoggingSummaryLines,
  buildNotificationSummaryLines,
  buildObjectLockSummaryLines,
  buildPublicAccessBlockSummaryLines,
  buildVersioningSummaryLines,
  buildWebsiteSummaryLines,
} from "../shared/bucketFeatureSummaries";
import ManagerToolbarSearch from "./ManagerToolbarSearch";
import { useManagerText } from "./managerI18n";
import {
  managerBucketCountLabel,
  managerBucketDeleteConflict,
  managerBucketDeleteFallback,
  managerBucketDeleteNotEmptyMessage,
  managerBucketFeatureState,
  managerBucketPurgeFinishedMessage,
  managerBucketsZhMessages,
} from "./managerBucketsMessages";

type BucketForm = {
  name: string;
  locationConstraint: string;
  versioning: boolean;
};

const defaultForm: BucketForm = {
  name: "",
  locationConstraint: "",
  versioning: false,
};

const buildDefaultForm = (): BucketForm => ({
  ...defaultForm,
});
const extractError = (err: unknown, fallback: string): string => extractApiError(err, fallback);

function QuotaBar({ usedBytes, quotaBytes }: { usedBytes?: number | null; quotaBytes?: number | null }) {
  const { t } = useManagerText(managerBucketsZhMessages);
  if (!quotaBytes || quotaBytes <= 0) {
    return <span className="ui-body text-slate-500 dark:text-slate-400">-</span>;
  }
  const used = usedBytes ?? 0;
  const ratio = Math.min(100, Math.round((used / quotaBytes) * 100));
  const usedDisplay = formatBytes(used);
  const quotaDisplay = formatBytes(quotaBytes);
  return (
    <div className="flex items-center gap-2" title={`${usedDisplay} / ${quotaDisplay}`}>
      <UiMeterBar
        value={ratio}
        label={t("Storage quota usage")}
        className="h-2.5 flex-1 overflow-hidden bg-slate-200 dark:bg-slate-800"
        barClassName="bg-primary-500"
      />
      <span className="ui-caption font-semibold text-slate-600 dark:text-slate-300">{ratio}%</span>
    </div>
  );
}

function QuotaObjectsBar({ usedObjects, quotaObjects }: { usedObjects?: number | null; quotaObjects?: number | null }) {
  const { locale, t } = useManagerText(managerBucketsZhMessages);
  if (!quotaObjects || quotaObjects <= 0) {
    return <span className="ui-body text-slate-500 dark:text-slate-400">-</span>;
  }
  const used = usedObjects ?? 0;
  const ratio = Math.min(100, Math.round((used / quotaObjects) * 100));
  return (
    <div
      className="flex items-center gap-2"
      title={locale === "zh"
        ? `${formatNumber(used)} / ${formatNumber(quotaObjects)} 个对象`
        : `${formatNumber(used)} / ${formatNumber(quotaObjects)} objects`}
    >
      <UiMeterBar
        value={ratio}
        label={t("Object quota usage")}
        className="h-2.5 flex-1 overflow-hidden bg-slate-200 dark:bg-slate-800"
        barClassName="bg-primary-500"
      />
      <span className="ui-caption font-semibold text-slate-600 dark:text-slate-300">{ratio}%</span>
    </div>
  );
}

type BucketListRow = Bucket & {
  tags?: BucketTag[] | null;
  features?: Record<string, BucketFeatureStatus> | null;
};
type SortField = SortableField<BucketListRow>;

type ColumnId =
  | "used_bytes"
  | "object_count"
  | "quota_max_size_bytes"
  | "quota_max_objects"
  | "creation_date"
  | "tags"
  | "versioning"
  | "object_lock"
  | "block_public_access"
  | "lifecycle_rules"
  | "static_website"
  | "bucket_policy"
  | "cors"
  | "access_logging"
  | "notifications"
  | "quota_status";

type ManagerFeatureKey =
  | "versioning"
  | "object_lock"
  | "block_public_access"
  | "lifecycle_rules"
  | "static_website"
  | "bucket_policy"
  | "cors"
  | "access_logging"
  | "notifications";

const MANAGER_FEATURE_LABELS: Record<ManagerFeatureKey, string> = {
  versioning: "Versioning",
  object_lock: "Object Lock",
  block_public_access: "Block public access",
  lifecycle_rules: "Lifecycle rules",
  static_website: "Static website",
  bucket_policy: "Bucket policy",
  cors: "CORS",
  access_logging: "Access logging",
  notifications: "Notifications",
};

const COLUMNS_STORAGE_KEY = "manager.bucket_list.columns.session.v1";
const defaultVisibleColumns: ColumnId[] = ["used_bytes", "object_count"];

const loadVisibleColumns = (): ColumnId[] => {
  const parsed = readSessionJsonFromKey<unknown>(COLUMNS_STORAGE_KEY);
  if (!Array.isArray(parsed)) return defaultVisibleColumns;
  const allowed = new Set<ColumnId>([
    "used_bytes",
    "object_count",
    "quota_max_size_bytes",
    "quota_max_objects",
    "creation_date",
    "tags",
    "versioning",
    "object_lock",
    "block_public_access",
    "lifecycle_rules",
    "static_website",
    "bucket_policy",
    "cors",
    "access_logging",
    "notifications",
    "quota_status",
  ]);
  const cleaned = parsed.filter((v) => typeof v === "string" && allowed.has(v as ColumnId)) as ColumnId[];
  return cleaned.length > 0 ? cleaned : defaultVisibleColumns;
};

const persistVisibleColumns = (value: ColumnId[]) => {
  writeSessionJsonToKey(COLUMNS_STORAGE_KEY, value);
};

export default function BucketsPage() {
  const { locale, t } = useManagerText(managerBucketsZhMessages);
  const {
    accounts,
    selectedS3AccountId,
    requiresS3AccountSelection,
    sessionS3AccountName,
    accountIdForApi,
  } = useS3AccountContext();
  const { generalSettings } = useGeneralSettings();
  const storedUser = readStoredUser();
  const managerToolAccess = getManagerToolAccess(storedUser);
  const [buckets, setBuckets] = useState<BucketListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseLoadFailed, setBaseLoadFailed] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null);
  const [pendingDeleteBucketName, setPendingDeleteBucketName] = useState<string | null>(null);
  const [pendingDeleteWithPurgeBucketName, setPendingDeleteWithPurgeBucketName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [useCustomLocationConstraint, setUseCustomLocationConstraint] = useState(false);
  const [bucketForm, setBucketForm] = useState<BucketForm>(buildDefaultForm);
  const [wizardInitialSignature, setWizardInitialSignature] = useState(() =>
    stableSignature({ bucketForm: buildDefaultForm(), useCustomLocationConstraint: false })
  );
  const [filter, setFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(loadVisibleColumns);
  const fetchRequestRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const lastFetchContextRef = useRef<string | null>(null);
  const [activeFeatureTooltipKey, setActiveFeatureTooltipKey] = useState<string | null>(null);
  const [featureTooltipState, setFeatureTooltipState] = useState<Record<string, BucketFeatureTooltipState>>({});
  const featureTooltipInflightRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const bucketPropertiesCacheRef = useRef<Record<string, BucketProperties>>({});
  const bucketPropertiesInflightRef = useRef<Record<string, Promise<BucketProperties>>>({});
  const [activeTagsTooltipKey, setActiveTagsTooltipKey] = useState<string | null>(null);
  const [sort, setSort] = useState<{ field: SortField; direction: "asc" | "desc" }>({
    field: "used_bytes",
    direction: "desc",
  });
  const [enrichingColumns, setEnrichingColumns] = useState(false);
  const invalidBucketNameMessage = t(
    "Invalid name. 3-63 characters, lowercase letters, numbers, dots or hyphens.",
  );

  const selectedS3Account = useMemo(
    () => accounts.find((a) => a.id === selectedS3AccountId),
    [accounts, selectedS3AccountId]
  );
  const endpointCaps = selectedS3Account?.storage_endpoint_capabilities ?? null;
  const usageFeatureEnabled = endpointCaps ? endpointCaps.metrics !== false : true;
  const snsFeatureEnabled = endpointCaps ? endpointCaps.sns !== false : true;
  const staticWebsiteFeatureEnabled = endpointCaps?.static_website === true;
  const quotaFeatureEnabled = selectedS3Account?.endpoint_provider === "ceph";
  const metricColumnOptions = useMemo(
    () => [
      { id: "used_bytes" as const, label: t("Used") },
      { id: "object_count" as const, label: t("Objects") },
      ...(quotaFeatureEnabled
        ? ([
            { id: "quota_max_size_bytes" as const, label: t("Quota") },
            { id: "quota_max_objects" as const, label: t("Object quota") },
            { id: "quota_status" as const, label: t("Quota status") },
          ] as const)
        : []),
      { id: "creation_date" as const, label: t("Created on") },
      { id: "tags" as const, label: t("Tags") },
    ],
    [quotaFeatureEnabled, t]
  );
  const featureColumnOptions = useMemo(
    () =>
      ([
        { id: "versioning", label: t("Versioning"), key: "versioning" },
        { id: "object_lock", label: t("Object Lock"), key: "object_lock" },
        { id: "block_public_access", label: t("Block public access"), key: "block_public_access" },
        { id: "lifecycle_rules", label: t("Lifecycle rules"), key: "lifecycle_rules" },
        { id: "static_website", label: t("Static website"), key: "static_website" },
        { id: "bucket_policy", label: t("Bucket policy"), key: "bucket_policy" },
        { id: "cors", label: t("CORS"), key: "cors" },
        { id: "access_logging", label: t("Access logging"), key: "access_logging" },
        { id: "notifications", label: t("Notifications"), key: "notifications" },
      ].filter(
        (option) =>
          (option.id !== "static_website" || staticWebsiteFeatureEnabled) &&
          (option.id !== "notifications" || snsFeatureEnabled)
      ) as Array<{ id: ManagerFeatureKey; label: string; key: ManagerFeatureKey }>),
    [snsFeatureEnabled, staticWebsiteFeatureEnabled, t]
  );
  const accountLabel = selectedS3Account
    ? formatAccountLabel(selectedS3Account, true, locale)
    : requiresS3AccountSelection
      ? t("Not selected")
      : sessionS3AccountName || t("S3 session");
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const canDeleteBucketWithPurge =
    Boolean(generalSettings.bucket_purge_enabled) && Boolean(managerToolAccess?.bucket_purge);

  const includeParams = useMemo(() => {
    const include: string[] = [];
    if (visibleColumns.includes("tags")) include.push("tags");
    featureColumnOptions.forEach(({ id }) => {
      if (visibleColumns.includes(id)) include.push(id);
    });
    return include;
  }, [featureColumnOptions, visibleColumns]);

  const requiresStats = useMemo(
    () =>
      usageFeatureEnabled &&
      (visibleColumns.includes("used_bytes") ||
        visibleColumns.includes("object_count") ||
        (quotaFeatureEnabled &&
          (visibleColumns.includes("quota_max_size_bytes") ||
            visibleColumns.includes("quota_max_objects") ||
            visibleColumns.includes("quota_status")))),
    [usageFeatureEnabled, visibleColumns, quotaFeatureEnabled]
  );

  type ColumnDef = DataTableColumn<BucketListRow, SortField>;

  const quotaConfigured = (bucket: BucketListRow) =>
    Boolean((bucket.quota_max_size_bytes ?? 0) > 0 || (bucket.quota_max_objects ?? 0) > 0);

  const bucketTooltipCacheKey = (bucket: BucketListRow) => bucket.name;
  const featureTooltipCacheKey = (bucket: BucketListRow, featureKey: ManagerFeatureKey) =>
    `${bucketTooltipCacheKey(bucket)}:${featureKey}:${locale}`;
  const tagsTooltipCacheKey = (bucketName: string) => `${bucketName}:tags`;

  const getBucketPropertiesCached = async (bucket: BucketListRow): Promise<BucketProperties> => {
    const bucketKey = bucketTooltipCacheKey(bucket);
    const cached = bucketPropertiesCacheRef.current[bucketKey];
    if (cached) return cached;
    const inflight = bucketPropertiesInflightRef.current[bucketKey];
    if (inflight) return inflight;
    const accountId = accountIdForApi ?? null;
    const promise = getBucketProperties(accountId, bucket.name)
      .then((properties) => {
        bucketPropertiesCacheRef.current[bucketKey] = properties;
        return properties;
      })
      .finally(() => {
        delete bucketPropertiesInflightRef.current[bucketKey];
      });
    bucketPropertiesInflightRef.current[bucketKey] = promise;
    return promise;
  };

  const buildFeatureTooltipLines = async (bucket: BucketListRow, featureKey: ManagerFeatureKey): Promise<string[]> => {
    const accountId = accountIdForApi ?? null;

    if (featureKey === "versioning") {
      const properties = await getBucketPropertiesCached(bucket);
      return buildVersioningSummaryLines(properties.versioning_status, locale);
    }

    if (featureKey === "object_lock") {
      const properties = await getBucketPropertiesCached(bucket);
      return buildObjectLockSummaryLines(properties.object_lock_enabled, properties.object_lock, locale);
    }

    if (featureKey === "block_public_access") {
      const properties = await getBucketPropertiesCached(bucket);
      return buildPublicAccessBlockSummaryLines(
        properties.public_access_block as Record<string, unknown> | null | undefined,
        locale,
      );
    }

    if (featureKey === "lifecycle_rules") {
      const properties = await getBucketPropertiesCached(bucket);
      return buildLifecycleRuleSummaryLines(properties.lifecycle_rules as unknown[], locale);
    }

    if (featureKey === "cors") {
      const properties = await getBucketPropertiesCached(bucket);
      const inlineRules = Array.isArray(properties.cors_rules) ? properties.cors_rules : null;
      if (inlineRules) return buildCorsRuleSummaryLines(inlineRules, locale);
      const cors = await getBucketCors(accountId, bucket.name);
      return buildCorsRuleSummaryLines(cors.rules, locale);
    }

    if (featureKey === "static_website") {
      const website = await getBucketWebsite(accountId, bucket.name);
      return buildWebsiteSummaryLines(website as Record<string, unknown>, locale);
    }

    if (featureKey === "bucket_policy") {
      const policy = await getBucketPolicy(accountId, bucket.name);
      return buildBucketPolicySummaryLines(policy.policy, locale);
    }

    if (featureKey === "access_logging") {
      const logging = await getBucketLogging(accountId, bucket.name);
      return buildLoggingSummaryLines(logging as Record<string, unknown>, locale);
    }

    if (featureKey === "notifications") {
      const notifications = await getBucketNotifications(accountId, bucket.name);
      return buildNotificationSummaryLines(notifications.configuration, locale);
    }

    return [t("No additional details available.")];
  };

  const loadFeatureTooltip = (bucket: BucketListRow, featureKey: ManagerFeatureKey) => {
    if (needsS3AccountSelection) return;
    const key = featureTooltipCacheKey(bucket, featureKey);
    const current = featureTooltipState[key];
    if (current?.status === "ready" || current?.status === "loading") return;
    if (featureTooltipInflightRef.current[key]) return;

    const work = (async () => {
      setFeatureTooltipState((prev) => ({ ...prev, [key]: { status: "loading" } }));
      try {
        const lines = await buildFeatureTooltipLines(bucket, featureKey);
        setFeatureTooltipState((prev) => ({ ...prev, [key]: { status: "ready", lines } }));
      } catch (err) {
        setFeatureTooltipState((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            message: extractError(err, t("Unable to load bucket feature details.")),
          },
        }));
      } finally {
        delete featureTooltipInflightRef.current[key];
      }
    })();
    featureTooltipInflightRef.current[key] = work;
  };

  const renderTagList = (tags?: BucketTag[] | null, bucketName = "bucket") => {
    const safeTags = Array.isArray(tags) ? tags.filter((t) => (t.key ?? "").trim()) : [];
    if (safeTags.length === 0) return <span className="ui-body text-slate-500 dark:text-slate-400">-</span>;
    const maxShown = 3;
    const shown = safeTags.slice(0, maxShown);
    const remaining = safeTags.length - shown.length;
    const tagKey = tagsTooltipCacheKey(bucketName);
    const tooltip: BucketFeatureTooltipState = {
      status: "ready",
      lines: buildBucketTagSummaryLines(safeTags, locale),
    };
    return (
      <BucketSummaryTooltip
        label={t("S3 tags")}
        tooltip={tooltip}
        open={activeTagsTooltipKey === tagKey}
        onOpen={() => setActiveTagsTooltipKey(tagKey)}
        onClose={() => setActiveTagsTooltipKey((prev) => (prev === tagKey ? null : prev))}
        cacheKey={tagKey}
        buttonClassName="inline-flex max-w-full cursor-default text-left"
      >
        <div className="flex flex-wrap gap-1.5">
          {shown.map((t) => (
            <ListBadge
              key={`${t.key}:${t.value}`}
              tone="neutral"
            >
              {t.key}={t.value}
            </ListBadge>
          ))}
          {remaining > 0 && (
            <ListBadge tone="neutral">
              +{remaining}
            </ListBadge>
          )}
        </div>
      </BucketSummaryTooltip>
    );
  };

  const renderFeatureChip = (featureKey: ManagerFeatureKey, bucket: BucketListRow) => {
    const status = bucket.features?.[featureKey] ?? null;
    if (!status) return <span className="ui-body text-slate-500 dark:text-slate-400">-</span>;
    const tooltipKey = featureTooltipCacheKey(bucket, featureKey);
    return (
      <BucketFeatureSummaryChip
        label={t(MANAGER_FEATURE_LABELS[featureKey])}
        state={managerBucketFeatureState(locale, status.state)}
        tone={status.tone}
        tooltip={featureTooltipState[tooltipKey]}
        open={activeFeatureTooltipKey === tooltipKey}
        onOpen={() => {
          setActiveFeatureTooltipKey(tooltipKey);
          loadFeatureTooltip(bucket, featureKey);
        }}
        onClose={() => setActiveFeatureTooltipKey((prev) => (prev === tooltipKey ? null : prev))}
        cacheKey={tooltipKey}
      />
    );
  };

  const fetchBuckets = useCallback(async (accountId: S3AccountSelector) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;
    setError(null);
    setLoading(true);
    setEnrichingColumns(false);
    try {
      const baseData = await listBuckets(accountId, {
        with_stats: requiresStats,
        signal: controller.signal,
      });
      if (fetchRequestRef.current !== requestId || controller.signal.aborted) return;
      setBuckets(baseData);
      setBaseLoadFailed(false);
      setDataStale(false);
      setLastUpdatedAt(new Date());
      setLoading(false);

      if (includeParams.length === 0) return;

      setEnrichingColumns(true);
      try {
        const enrichedData = await listBuckets(accountId, {
          include: includeParams,
          with_stats: requiresStats,
          signal: controller.signal,
        });
        if (fetchRequestRef.current !== requestId || controller.signal.aborted) return;
        setBuckets(enrichedData);
      } catch (err) {
        if (fetchRequestRef.current !== requestId) return;
        setError(extractError(err, t("Unable to update selected bucket details.")));
      } finally {
        if (fetchRequestRef.current === requestId) {
          setEnrichingColumns(false);
        }
      }
    } catch (err) {
      if (fetchRequestRef.current !== requestId || controller.signal.aborted) return;
      setError(extractError(err, t("Unable to load buckets from the storage endpoint.")));
      setBaseLoadFailed(true);
      setDataStale(true);
      setEnrichingColumns(false);
    } finally {
      if (fetchRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [includeParams, requiresStats, t]);

  useEffect(() => {
    fetchAbortRef.current?.abort();
    if (needsS3AccountSelection) {
      fetchRequestRef.current += 1;
      setLoading(false);
      setEnrichingColumns(false);
      setBuckets([]);
      setDataStale(false);
      setLastUpdatedAt(null);
      setBaseLoadFailed(false);
      lastFetchContextRef.current = null;
      return;
    }
    const contextKey = accountIdForApi == null ? "session" : String(accountIdForApi);
    if (lastFetchContextRef.current !== contextKey) {
      setBuckets([]);
      setDataStale(false);
      setLastUpdatedAt(null);
      setBaseLoadFailed(false);
      lastFetchContextRef.current = contextKey;
    }
    fetchBuckets(accountIdForApi ?? null);
    return () => fetchAbortRef.current?.abort();
  }, [accountIdForApi, fetchBuckets, needsS3AccountSelection]);

  useEffect(() => {
    setActiveFeatureTooltipKey(null);
    setFeatureTooltipState({});
    featureTooltipInflightRef.current = {};
    bucketPropertiesCacheRef.current = {};
    bucketPropertiesInflightRef.current = {};
    setActiveTagsTooltipKey(null);
  }, [accountIdForApi, locale]);

  useEffect(() => {
    persistVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = prev.filter((column) => {
        if (column === "static_website" && !staticWebsiteFeatureEnabled) return false;
        if (column === "notifications" && !snsFeatureEnabled) return false;
        if (
          (column === "quota_max_size_bytes" || column === "quota_max_objects" || column === "quota_status") &&
          !quotaFeatureEnabled
        ) {
          return false;
        }
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [quotaFeatureEnabled, snsFeatureEnabled, staticWebsiteFeatureEnabled]);

  const filteredBuckets = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const items = q ? buckets.filter((b) => b.name.toLowerCase().includes(q)) : buckets;
    const sorted = [...items].sort((a, b) => {
      return compareByNullableField(a, b, sort.field, sort.direction);
    });
    return sorted;
  }, [buckets, filter, sort]);

  const toggleSort = (field: SortField) => {
    setSort((current) => nextSortState(current, field, "desc"));
  };

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const resetColumns = () => {
    setVisibleColumns(defaultVisibleColumns);
  };

  const performCreate = async (
    name: string,
    versioning: boolean,
    locationConstraint?: string
  ): Promise<{ created: boolean }> => {
    if (needsS3AccountSelection) {
      setActionError(t("Select an account before creating a bucket."));
      return { created: false };
    }
    setCreating(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await createBucket(name, accountIdForApi, {
        versioning,
        locationConstraint,
      });
      setActionMessage(t("Bucket created"));
      await fetchBuckets(accountIdForApi ?? null);
      return { created: true };
    } catch (err) {
      setActionError(extractError(err, t("Unable to create the bucket.")));
      return { created: false };
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (needsS3AccountSelection) {
      setActionError(t("Select an account before creating a bucket."));
      return;
    }
    const normalizedBucketName = normalizeS3BucketName(bucketForm.name);
    if (!normalizedBucketName) {
      setActionError(t("Bucket name is required."));
      return;
    }
    if (!isValidS3BucketName(normalizedBucketName)) {
      setActionError(invalidBucketNameMessage);
      return;
    }
    const locationConstraint = useCustomLocationConstraint ? bucketForm.locationConstraint.trim() || undefined : undefined;
    const result = await performCreate(normalizedBucketName, bucketForm.versioning, locationConstraint);
    if (result.created) {
      setBucketForm(buildDefaultForm());
      setShowWizard(false);
      setWizardStep(0);
      setUseCustomLocationConstraint(false);
    }
  };

  const requestDelete = (name: string) => {
    if (needsS3AccountSelection) return;
    const targetBucket = buckets.find((b) => b.name === name);
    const objectCount = targetBucket?.object_count;
    if ((objectCount ?? 0) > 0) {
      if (canDeleteBucketWithPurge) {
        setActionError(null);
        setActionMessage(null);
        setPendingDeleteWithPurgeBucketName(name);
        return;
      }
      setActionMessage(null);
      setActionError(managerBucketDeleteNotEmptyMessage(locale, name, objectCount ?? 0));
      return;
    }
    setActionError(null);
    setActionMessage(null);
    setPendingDeleteBucketName(name);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteBucketName) return;
    const name = pendingDeleteBucketName;
    setDeletingBucket(name);
    setActionError(null);
    setActionMessage(null);
    try {
      await deleteBucket(name, accountIdForApi);
      setActionMessage(t("Bucket deleted"));
      await fetchBuckets(accountIdForApi ?? null);
      return;
    } catch (err) {
      const msg = extractError(err, managerBucketDeleteFallback(locale, name));
      const notEmpty = msg.toLowerCase().includes("not empty");
      const conflict = isApiError(err) && err.response?.status === 409;
      if (notEmpty || conflict) {
        setActionError(managerBucketDeleteConflict(locale, name));
        return;
      }
      setActionError(msg);
    } finally {
      setDeletingBucket(null);
      setPendingDeleteBucketName(null);
    }
  };

  const handleDeleteWithPurgeFinished = async (result: { bucket_deleted?: boolean; deleted_objects?: number; deleted_versions?: number }) => {
    if (!result.bucket_deleted) return;
    const deletedEntries = (result.deleted_objects ?? 0) + (result.deleted_versions ?? 0);
    setActionError(null);
    setActionMessage(managerBucketPurgeFinishedMessage(locale, deletedEntries));
    await fetchBuckets(accountIdForApi ?? null);
  };

  const bucketTableColumns: ColumnDef[] = (() => {
    const cols: ColumnDef[] = [
      {
        id: "name",
        label: t("Name"),
        field: "name",
        primary: true,
        mobileRole: "primary",
        render: (bucket) => <span className="block truncate">{bucket.name}</span>,
      },
    ];

    const visible = new Set(visibleColumns);
    if (visible.has("used_bytes")) {
      cols.push({
        id: "used_bytes",
        label: t("Used"),
        field: "used_bytes",
        render: (bucket) => formatBytes(bucket.used_bytes),
      });
    }
    if (quotaFeatureEnabled && visible.has("quota_max_size_bytes")) {
      cols.push({
        id: "quota_max_size_bytes",
        label: t("Quota"),
        field: "quota_max_size_bytes",
        render: (bucket) => <QuotaBar usedBytes={bucket.used_bytes} quotaBytes={bucket.quota_max_size_bytes ?? null} />,
      });
    }
    if (visible.has("object_count")) {
      cols.push({
        id: "object_count",
        label: t("Objects"),
        field: "object_count",
        render: (bucket) => formatNumber(bucket.object_count),
      });
    }
    if (quotaFeatureEnabled && visible.has("quota_max_objects")) {
      cols.push({
        id: "quota_max_objects",
        label: t("Object quota"),
        field: "quota_max_objects",
        render: (bucket) => <QuotaObjectsBar usedObjects={bucket.object_count} quotaObjects={bucket.quota_max_objects ?? null} />,
      });
    }
    if (visible.has("creation_date")) {
      cols.push({
        id: "creation_date",
        label: t("Created on"),
        field: null,
        render: (bucket) => (
          bucket.creation_date
            ? new Date(bucket.creation_date).toLocaleDateString(locale === "zh" ? "zh-CN" : undefined)
            : "-"
        ),
      });
    }
    if (visible.has("tags")) {
      cols.push({
        id: "tags",
        label: t("Tags"),
        field: null,
        render: (bucket) => renderTagList(bucket.tags, bucket.name),
      });
    }

    featureColumnOptions.forEach((c) => {
      if (!visible.has(c.id)) return;
      cols.push({
        id: c.id,
        label: c.label,
        field: null,
        render: (bucket) => renderFeatureChip(c.key, bucket),
      });
    });

    if (quotaFeatureEnabled && visible.has("quota_status")) {
      cols.push({
        id: "quota_status",
        label: t("Quota status"),
        field: null,
        render: (bucket) => (
          <PropertySummaryChip
            compact
            state={quotaConfigured(bucket) ? t("Configured") : t("Not set")}
            tone={quotaConfigured(bucket) ? "active" : "inactive"}
            title={`${t("Quota")}: ${quotaConfigured(bucket) ? t("Configured") : t("Not set")}`}
          />
        ),
      });
    }

    cols.push({
      id: "actions",
      label: t("Actions"),
      field: null,
      align: "right",
      headerClassName: "min-w-[13rem]",
      cellClassName: "min-w-[13rem]",
      mobileRole: "actions",
      render: (bucket) => {
        const objectCount = bucket.object_count;
        const containsObjects = (objectCount ?? 0) > 0;
        const deleteDisabledReason =
          containsObjects && !canDeleteBucketWithPurge
            ? t("Bucket is not empty. Empty it first, or enable bucket purge access to delete it from Manager.")
            : null;
        const deleteLabel = containsObjects && canDeleteBucketWithPurge ? t("Purge and Delete") : t("Delete");
        const deleteButton = (
          <ListActionButton
            onClick={() => requestDelete(bucket.name)}
             variant="danger" className={`whitespace-nowrap`}
            disabled={deletingBucket === bucket.name || Boolean(deleteDisabledReason)}
          >
            {deletingBucket === bucket.name ? t("Deleting...") : deleteLabel}
          </ListActionButton>
        );
        return (
          <ListActions className="flex-nowrap">
            <ListActionLink
              to={`/manager/buckets/${encodeURIComponent(bucket.name)}`}
               className={`whitespace-nowrap`}
              {...dataTableDefaultActionProps}
            >
              {t("Configure")}
            </ListActionLink>
            {deleteDisabledReason ? <span title={deleteDisabledReason}>{deleteButton}</span> : deleteButton}
          </ListActions>
        );
      },
    });

    return cols;
  })();
  const stepTitles = [t("General"), t("Protection")];
  const isBucketNameValid = !bucketForm.name || isValidS3BucketName(bucketForm.name);
  const wizardCurrentSignature = useMemo(
    () => stableSignature({ bucketForm, useCustomLocationConstraint }),
    [bucketForm, useCustomLocationConstraint]
  );
  const closeWizard = () => {
    setShowWizard(false);
    setBucketForm(buildDefaultForm());
    setWizardStep(0);
    setUseCustomLocationConstraint(false);
    setWizardInitialSignature(stableSignature({ bucketForm: buildDefaultForm(), useCustomLocationConstraint: false }));
  };
  const wizardCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: showWizard && wizardCurrentSignature !== wizardInitialSignature,
    onClose: closeWizard,
    disabled: creating,
    title: t("Discard changes?"),
    description: t("You have unapplied changes. Closing this dialog will discard them."),
    cancelLabel: t("Keep editing"),
    confirmLabel: t("Discard changes"),
    closeLabel: t("Close"),
  });
  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: filteredBuckets.length,
  });

  const openAdvancedModal = () => {
    setActionError(null);
    setBucketForm(buildDefaultForm());
    setWizardStep(0);
    setUseCustomLocationConstraint(false);
    setWizardInitialSignature(stableSignature({ bucketForm: buildDefaultForm(), useCustomLocationConstraint: false }));
    setShowWizard(true);
  };

  return (
    <div className={workflowPageHostClass(Boolean(showWizard || pendingDeleteWithPurgeBucketName))}>
      <PageHeader actionPresentation="listing"
        title={t("Buckets")}
        description={t("Bucket inventory and configuration for the active manager context.")}
        breadcrumbs={localizedManagerPageBreadcrumbs("buckets", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        actions={[
          {
            label: t("Create bucket"),
            onClick: openAdvancedModal,
            disabled: baseLoadFailed || (loading && buckets.length === 0),
          },
        ]}
      />

      {error && (
        <PageBanner tone={buckets.length > 0 || !baseLoadFailed ? "warning" : "error"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {buckets.length > 0 && dataStale ? t("Showing the last available bucket list. ") : ""}
              {error}
              {lastUpdatedAt
                ? locale === "zh"
                  ? ` 上次更新时间：${lastUpdatedAt.toLocaleTimeString("zh-CN")}。`
                  : ` Last updated ${lastUpdatedAt.toLocaleTimeString()}.`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => fetchBuckets(accountIdForApi ?? null)}
              className="font-semibold underline underline-offset-2"
            >
              {t("Retry")}
            </button>
          </div>
        </PageBanner>
      )}
      {actionError && <PageBanner tone="error">{actionError}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{actionMessage}</PageBanner>}

      {needsS3AccountSelection ? (
        <PageEmptyState
          title={t("Select an account before managing buckets")}
          description={t("The bucket list, quota details, and destructive actions stay disabled until a manager execution context is selected.")}
          primaryAction={{ label: t("Open dashboard"), to: "/manager" }}
          secondaryAction={{ label: t("Open browser"), to: "/manager/browser" }}
          tone="warning"
        />
      ) : (
        <ListPageSection
          variant="page"
          mobileSort={(
            <TableSortControls
              columns={bucketTableColumns}
              sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }}
              labels={{
                sortBy: t("Sort by"),
                direction: t("Direction"),
                ascending: t("Ascending"),
                descending: t("Descending"),
              }}
            />
          )}
            title={t("Buckets")}
            countLabel={
              buckets.length === 0 && (loading || baseLoadFailed)
                ? t("— buckets")
                : managerBucketCountLabel(locale, filteredBuckets.length)
            }
            search={
              <ManagerToolbarSearch
                value={filter}
                onChange={setFilter}
                placeholder={t("Search by name")}
                className="w-full sm:w-64 md:w-72"
              />
            }
            columns={
              <>
                {enrichingColumns ? (
                  <span className="ui-caption text-slate-500 dark:text-slate-400">
                    {t("Updating selected columns...")}
                  </span>
                ) : null}
                <ColumnVisibilityMenu
                  selectedCount={visibleColumns.length}
                  onReset={resetColumns}
                  resetDisabled={visibleColumns.length === defaultVisibleColumns.length && defaultVisibleColumns.every((id) => visibleColumns.includes(id))}
                  coreGroups={[
                    { id: "metrics", label: t("Metrics"), options: metricColumnOptions },
                    { id: "features", label: t("Features"), options: featureColumnOptions },
                  ].map((group) => ({
                    ...group,
                    options: group.options.map((option) => ({
                      ...option,
                      checked: visibleColumns.includes(option.id),
                      onToggle: () => toggleColumn(option.id),
                    })),
                  }))}
                  footerNote={t("Feature checks run only when their column is enabled.")}
                />
              </>
            }
        >
          <DataTableShell
            columns={bucketTableColumns}
            rows={filteredBuckets}
            rowKey={(bucket) => bucket.name}
            responsiveCards
            tableClassName="w-full min-w-[760px]"
            tableLayout="fixed"
            sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }}
            status={tableStatus}
            loadingMessage={t("Loading buckets...")}
            errorMessage={t("Unable to load buckets.")}
            emptyMessage={t("No buckets.")}
          />
        </ListPageSection>
      )}

      {pendingDeleteBucketName && (
        <ConfirmActionDialog
          title={t("Delete bucket")}
          description={t("This permanently removes the bucket after server-side checks confirm it is empty.")}
          confirmLabel={t("Delete bucket")}
          closeLabel={t("Close")}
          details={[
            { label: t("Bucket"), value: pendingDeleteBucketName, mono: true },
            { label: t("Context"), value: accountLabel },
          ]}
          impacts={[
            t("Deletion is irreversible once the bucket is removed."),
            t("The bucket must remain empty until the operation completes."),
          ]}
          loading={deletingBucket === pendingDeleteBucketName}
          onCancel={() => setPendingDeleteBucketName(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}

      {pendingDeleteWithPurgeBucketName && accountIdForApi && (
        <BucketPurgeRunModal
          mode="manager-delete"
          contextId={String(accountIdForApi)}
          contextName={accountLabel}
          targets={[{ bucketName: pendingDeleteWithPurgeBucketName }]}
          onFinished={(result) => void handleDeleteWithPurgeFinished(result)}
          onClose={() => setPendingDeleteWithPurgeBucketName(null)}
        />
      )}

      {showWizard && (
        <WorkflowPage
          title={t("Create bucket")}
          description={t("Define the bucket identity and initial protection settings for the active manager context.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("buckets", locale, { label: t("Create") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to buckets")}
          onBack={wizardCloseGuard.requestClose}
          width="narrow"
        >
          {actionError && <PageBanner tone="error">{actionError}</PageBanner>}
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="flex items-center gap-3">
              {stepTitles.map((title, index) => (
                <div key={title} className="flex items-center gap-2 ui-body">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ui-caption font-semibold ${
                      index === wizardStep
                        ? "border-primary bg-primary-100/70 text-primary-800 dark:border-primary-500 dark:bg-primary-500/20 dark:text-primary-100"
                        : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={index === wizardStep ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                    {title}
                  </span>
                  {index < stepTitles.length - 1 && <span className="text-slate-400 dark:text-slate-600">—</span>}
                </div>
              ))}
            </div>

            {wizardStep === 0 && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="ui-body font-medium text-slate-700 dark:text-slate-200">
                    {t("Bucket name")}
                  </label>
                  <input
                    value={bucketForm.name}
                    onChange={(e) => {
                      const value = normalizeS3BucketNameInput(e.target.value);
                      setBucketForm((prev) => ({ ...prev, name: value }));
                    }}
                    maxLength={S3_BUCKET_NAME_MAX_LENGTH}
                    title={!bucketForm.name || isBucketNameValid ? undefined : invalidBucketNameMessage}
                    className={`rounded-md border px-3 py-2 ui-body focus:outline-none focus:ring-2 ${
                      !bucketForm.name || isBucketNameValid
                        ? "border-slate-200 focus:border-primary focus:ring-primary/30 dark:border-slate-700 dark:text-slate-100"
                        : "border-rose-400 text-rose-700 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500 dark:text-rose-200 dark:focus:ring-rose-900/50"
                    } dark:bg-slate-900`}
                    placeholder={t("ex: backups-prod")}
                    required
                  />
                  {bucketForm.name && !isBucketNameValid && (
                    <p className="ui-caption font-semibold text-rose-600 dark:text-rose-300">{invalidBucketNameMessage}</p>
                  )}
                  <p className="ui-caption text-slate-500 dark:text-slate-400">
                    {t("DNS compatible, lowercase, numbers, dots, and hyphens. The selected account will be used.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 ui-caption text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={useCustomLocationConstraint}
                      onChange={(e) => setUseCustomLocationConstraint(e.target.checked)}
                      className={uiCheckboxClass}
                    />
                    <span>{t("Custom LocationConstraint")}</span>
                  </label>
                  {useCustomLocationConstraint && (
                    <div className="flex flex-col gap-2">
                      <input
                        value={bucketForm.locationConstraint}
                        onChange={(e) => setBucketForm((prev) => ({ ...prev, locationConstraint: e.target.value }))}
                        className="rounded-md border border-slate-200 px-3 py-2 ui-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        placeholder={t("ex: eu-west-1")}
                      />
                      <p className="ui-caption text-slate-500 dark:text-slate-400">
                        {t("Optional. Empty value uses the endpoint default region/placement.")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 ui-body text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
                  <span>
                    {t("Versioning")}
                    <span className="block ui-caption text-slate-500 dark:text-slate-400">
                      {t("Enables version retention.")}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={bucketForm.versioning}
                    onChange={(e) => setBucketForm((prev) => ({ ...prev, versioning: e.target.checked }))}
                    className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                  />
                </label>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="ui-caption text-slate-500 dark:text-slate-400">
                {t("S3 account")}: {accountLabel}
              </div>
              <div className="flex items-center gap-3">
                {wizardStep > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setWizardStep((prev) => Math.max(prev - 1, 0));
                    }}
                    className="rounded-md border border-slate-200 px-4 py-2 ui-body font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {t("Previous")}
                  </button>
                )}
                {wizardStep < stepTitles.length - 1 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      if (!bucketForm.name.trim()) {
                        setActionError(t("Bucket name is required."));
                        return;
                      }
                      if (!isBucketNameValid) {
                        setActionError(invalidBucketNameMessage);
                        return;
                      }
                      setActionError(null);
                      setWizardStep((prev) => Math.min(prev + 1, stepTitles.length - 1));
                    }}
                    disabled={!bucketForm.name.trim() || !isBucketNameValid}
                    className={cx(uiButtonBaseClass, uiButtonVariants.primary, "rounded-md px-4 py-2 ui-body")}
                  >
                    {t("Continue")}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating}
                    className={cx(uiButtonBaseClass, uiButtonVariants.primary, "rounded-md px-4 py-2 ui-body")}
                  >
                    {creating ? t("Creating...") : t("Create bucket")}
                  </button>
                )}
              </div>
            </div>
          </form>
          {wizardCloseGuard.confirmationDialog}
        </WorkflowPage>
      )}
    </div>
  );
}
