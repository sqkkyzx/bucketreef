/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListBadge } from "../../components/list/ListControls";
import { useMemo, useRef, useState } from "react";

import {
  streamManagerBucketDeleteWithPurge,
  streamCephAdminBucketPurge,
  streamManagerBucketPurge,
  streamStorageOpsBucketPurge,
  type BucketDeleteWithPurgePayload,
  type BucketPurgeBucketResult,
  type BucketPurgeFailure,
  type BucketPurgePayload,
  type BucketPurgeProgress,
  type BucketPurgeResult,
} from "../../api/bucketPurge";
import PageBanner from "../../components/PageBanner";
import BucketOperationResult, { BucketOperationFailures } from "./BucketOperationResult";
import WorkflowPage from "../../components/WorkflowPage";
import UiButton from "../../components/ui/UiButton";
import UiInput from "../../components/ui/UiInput";
import { cx, uiMutedTextClass } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { formatCompactNumber, formatNumber } from "../../utils/format";
import type { UiLanguage } from "../../components/language";
import { BucketOperationSetup, BucketOperationProgress, BucketOperationSummaryStat } from "./bucketOperationRunUi";
import {
  buildStorageOpsBucketTargets,
  type BucketOperationUiTarget,
} from "./bucketOpsSelectionModel";
import {
  CEPH_ADMIN_PAGE_CONTRACTS,
  MANAGER_PAGE_CONTRACTS,
  STORAGE_OPS_PAGE_CONTRACTS,
  buildWorkspacePageBreadcrumbs,
} from "../../navigation/workspacePages";
import { useManagerText } from "../manager/managerI18n";
import { managerBucketsZhMessages } from "../manager/managerBucketsMessages";

type ManagerTranslate = (message: string) => string;

type CommonProps = {
  targets: BucketOperationUiTarget[];
  onClose: () => void;
  onFinished?: (result: BucketPurgeResult) => void;
};

type BucketPurgeRunModalProps =
  | (CommonProps & {
      mode: "manager";
      contextId: string;
      contextName?: string | null;
    })
  | (CommonProps & {
      mode: "manager-delete";
      contextId: string;
      contextName?: string | null;
    })
  | (CommonProps & {
      mode: "ceph-admin";
      endpointId: number;
      endpointName?: string | null;
    })
  | (CommonProps & {
      mode: "storage-ops";
    });

function statusLabel(status: BucketPurgeResult["status"], t: ManagerTranslate): string {
  if (status === "completed") return t("Completed");
  if (status === "completed_with_errors") return t("Completed with errors");
  if (status === "canceled") return t("Canceled");
  return t("Failed");
}

function bucketStatusTone(status: BucketPurgeBucketResult["status"]): "success" | "warning" | "danger" {
  if (status === "completed") {
    return "success";
  }
  if (status === "completed_with_errors") {
    return "warning";
  }
  return "danger";
}

function surfaceLabel(props: BucketPurgeRunModalProps, t: ManagerTranslate): string {
  if (props.mode === "manager" || props.mode === "manager-delete") return t("Manager");
  if (props.mode === "ceph-admin") return t("Ceph Admin");
  return t("Storage Ops");
}

function contextLabel(props: BucketPurgeRunModalProps, t: ManagerTranslate): string {
  if (props.mode === "manager" || props.mode === "manager-delete") return props.contextName || props.contextId;
  if (props.mode === "ceph-admin") return props.endpointName || `${t("Endpoint")} ${props.endpointId}`;
  return t("All selected contexts");
}

function failureTarget(failure: BucketPurgeFailure, t: ManagerTranslate): string {
  if (failure.key) return failure.key;
  if (failure.stage === "delete_bucket") return t("Bucket deletion");
  return failure.stage === "list" ? t("Bucket listing") : t("DeleteObjects batch");
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function progressDeletedEntries(progress: BucketPurgeProgress): number {
  return progress.deleted_objects + progress.deleted_versions;
}

function progressListedEntries(progress: BucketPurgeProgress): number {
  return progress.listed_objects + progress.listed_versions;
}

function progressTotalEntries(progress: BucketPurgeProgress): number | null {
  const discoveredTotal = Math.max(progressListedEntries(progress), progressDeletedEntries(progress));
  const estimatedTotal = progress.total_entries_estimate ?? null;
  if (estimatedTotal === null) return discoveredTotal > 0 ? discoveredTotal : null;
  return Math.max(estimatedTotal, discoveredTotal);
}

function progressEntriesLabel(progress: BucketPurgeProgress, locale: UiLanguage): string {
  const deletedTotal = progressDeletedEntries(progress);
  const totalEntries = progressTotalEntries(progress);
  if (totalEntries === null) {
    return locale === "zh"
      ? `已删除 ${formatCompactNumber(deletedTotal)} 个条目`
      : `${formatCompactNumber(deletedTotal)} entries deleted`;
  }
  const totalLabel = progress.total_entries_final
    ? formatCompactNumber(totalEntries)
    : locale === "zh"
      ? `至少 ${formatCompactNumber(totalEntries)}`
      : `at least ${formatCompactNumber(totalEntries)}`;
  return locale === "zh"
    ? `已删除 ${formatCompactNumber(deletedTotal)} / ${totalLabel} 个条目`
    : `${formatCompactNumber(deletedTotal)} / ${totalLabel} entries deleted`;
}

function operationResultMessage(
  isDeleteMode: boolean,
  status: BucketPurgeResult["status"],
  locale: UiLanguage,
): string {
  if (locale !== "zh") {
    const operation = isDeleteMode ? "Bucket deletion" : "Purge";
    const statusText = status === "completed"
      ? "Completed"
      : status === "completed_with_errors"
        ? "Completed with errors"
        : status === "canceled"
          ? "Canceled"
          : "Failed";
    return `${operation} ${statusText.toLowerCase()}.`;
  }
  const operation = isDeleteMode ? "存储桶删除" : "清理";
  if (status === "completed") return `${operation}已完成。`;
  if (status === "completed_with_errors") return `${operation}已完成，但出现错误。`;
  if (status === "canceled") return `${operation}已取消。`;
  return `${operation}失败。`;
}

export default function BucketPurgeRunModal(props: BucketPurgeRunModalProps) {
  const { locale, t } = useManagerText(managerBucketsZhMessages);
  const [parallelism, setParallelism] = useState(10);
  const [confirmation, setConfirmation] = useState("");
  const [progress, setProgress] = useState<BucketPurgeProgress | null>(null);
  const [result, setResult] = useState<BucketPurgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const targetCount = props.targets.length;
  const isDeleteMode = props.mode === "manager-delete";
  const deleteTarget = isDeleteMode ? props.targets[0]?.bucketName ?? "" : "";
  const expectedConfirmation = isDeleteMode ? `DELETE BUCKET ${deleteTarget}` : `PURGE ${targetCount} BUCKETS`;
  const confirmationValid = confirmation === expectedConfirmation;
  const targetLabel = isDeleteMode
    ? t("Delete bucket")
    : locale === "zh"
      ? `${targetCount.toLocaleString("zh-CN")} 个存储桶`
      : `${targetCount} bucket${targetCount > 1 ? "s" : ""}`;
  const progressPercent = useMemo(() => {
    if (!progress) return null;
    const totalEntries = progressTotalEntries(progress);
    const deletedTotal = progressDeletedEntries(progress);
    if (totalEntries !== null && totalEntries > 0) {
      const rawPercent = Math.max(0, Math.min(100, Math.round((deletedTotal / totalEntries) * 100)));
      return progress.total_entries_final ? rawPercent : Math.min(rawPercent, 96);
    }
    if (progress.total_buckets > 0) {
      const rawPercent = Math.max(0, Math.min(100, Math.round((progress.completed_buckets / progress.total_buckets) * 100)));
      return progress.total_entries_final ? rawPercent : Math.min(rawPercent, 96);
    }
    return null;
  }, [progress]);

  const buildPayload = (): BucketPurgePayload | BucketDeleteWithPurgePayload => {
    const basePayload = {
      parallelism: Math.max(1, Math.min(64, Math.trunc(parallelism || 10))),
      confirmation,
    };
    if (isDeleteMode) {
      if (!deleteTarget) {
        throw new Error(t("Missing bucket to delete."));
      }
      return basePayload;
    }
    const purgePayload: BucketPurgePayload = {
      ...basePayload,
      include_versions: true,
    };
    if (props.mode === "storage-ops") {
      return { ...purgePayload, targets: buildStorageOpsBucketTargets(props.targets) };
    }
    return {
      ...purgePayload,
      buckets: props.targets.map((target) => target.bucketName),
    };
  };

  const runPurge = async () => {
    if (running || targetCount === 0 || !confirmationValid) return;
    setError(null);
    setMessage(null);
    setResult(null);
    setProgress(null);
    let payload: BucketPurgePayload | BucketDeleteWithPurgePayload;
    try {
      payload = buildPayload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Invalid options."));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    try {
      const streamOptions = {
        signal: controller.signal,
        onProgress: (event: BucketPurgeProgress) => setProgress(event),
      };
      const nextResult =
        props.mode === "manager-delete"
          ? await streamManagerBucketDeleteWithPurge(props.contextId, deleteTarget, payload as BucketDeleteWithPurgePayload, streamOptions)
          : props.mode === "manager"
          ? await streamManagerBucketPurge(props.contextId, payload as BucketPurgePayload, streamOptions)
          : props.mode === "ceph-admin"
            ? await streamCephAdminBucketPurge(props.endpointId, payload as BucketPurgePayload, streamOptions)
            : await streamStorageOpsBucketPurge(payload as BucketPurgePayload, streamOptions);
      setResult(nextResult);
      props.onFinished?.(nextResult);
      setMessage(operationResultMessage(isDeleteMode, nextResult.status, locale));
    } catch (err) {
      if (isAbortError(err)) {
        setMessage(isDeleteMode ? t("Bucket deletion canceled.") : t("Purge canceled."));
      } else {
        setError(
          extractApiError(
            err,
            isDeleteMode ? t("Bucket deletion failed.") : t("Bucket purge failed."),
          ),
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancelPurge = () => {
    abortRef.current?.abort();
  };

  const closeModal = () => {
    abortRef.current?.abort();
    props.onClose();
  };

  const workflowLabel = isDeleteMode ? t("Purge and delete") : t("Purge");
  const baseBreadcrumbs =
    props.mode === "manager" || props.mode === "manager-delete"
      ? buildWorkspacePageBreadcrumbs("manager", MANAGER_PAGE_CONTRACTS.buckets, { label: workflowLabel })
      : props.mode === "ceph-admin"
        ? buildWorkspacePageBreadcrumbs("ceph-admin", CEPH_ADMIN_PAGE_CONTRACTS.buckets, { label: workflowLabel })
        : buildWorkspacePageBreadcrumbs("storage-ops", STORAGE_OPS_PAGE_CONTRACTS.buckets, { label: workflowLabel });
  const breadcrumbs = locale === "zh"
    ? baseBreadcrumbs.map((breadcrumb, index) => ({
        ...breadcrumb,
        label: index === 0 ? surfaceLabel(props, t) : index === 1 ? t("Buckets") : breadcrumb.label,
      }))
    : baseBreadcrumbs;

  return (
    <WorkflowPage
      title={isDeleteMode ? t("Purge and delete bucket") : t("Purge buckets")}
      description={
        isDeleteMode
          ? t("Review the target, confirm the destructive operation and follow deletion through completion.")
          : t("Review the selected buckets, confirm the destructive operation and keep progress visible through completion.")
      }
      breadcrumbs={breadcrumbs}
      breadcrumbLabel={t("Breadcrumb")}
      onBack={closeModal}
      backLabel={running ? t("Stop and return") : t("Back to buckets")}
      contentClassName="min-w-0"
    >
      <div className="space-y-4">
        {error && <PageBanner tone="error">{error}</PageBanner>}
        {message && (
          <PageBanner tone={result?.status === "completed" ? "success" : result?.status === "failed" ? "error" : "warning"}>
            {message}
          </PageBanner>
        )}

        <BucketOperationSetup
          targetLabel={targetLabel}
          contextLabel={`${surfaceLabel(props, t)} - ${contextLabel(props, t)}`}
          actions={running ? (
            <UiButton type="button" onClick={cancelPurge} variant="danger" size="sm">
              {t("Cancel")}
            </UiButton>
          ) : (
            <UiButton
              type="button"
              onClick={runPurge}
              disabled={targetCount === 0 || !confirmationValid}
              variant="danger"
              size="sm"
            >
              {isDeleteMode ? t("Delete bucket") : t("Start purge")}
            </UiButton>
          )}
        >
          {isDeleteMode ? (
            <PageBanner tone="warning">
              {t("This deletes current objects, historical versions, and delete markers, then removes the bucket and its S3 configuration.")}
            </PageBanner>
          ) : (
            <PageBanner tone="warning">
              {t("This empties the selected buckets by deleting current objects, historical versions, and delete markers. Buckets and bucket configuration are kept.")}
            </PageBanner>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,360px)]">
            <div className="min-w-0 rounded-md border border-[color:var(--ui-border-soft)] md:col-span-2 xl:col-span-1">
              <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                <p className="ui-caption font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {t("Targets")}
                </p>
              </div>
              <div className="max-h-48 overflow-auto divide-y divide-slate-200 dark:divide-slate-800">
                {props.targets.map((target) => (
                  <div key={`${target.contextId ?? ""}:${target.bucketName}`} className="px-3 py-2">
                    <p className="break-all ui-body font-semibold text-slate-900 dark:text-slate-100">{target.bucketName}</p>
                    {(target.contextName || target.contextId) && (
                      <p className={cx("ui-caption", uiMutedTextClass)}>{target.contextName || target.contextId}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <UiInput
              size="compact"
              label={t("Parallelism")}
              type="number"
              min={1}
              max={64}
              value={parallelism}
              disabled={running}
              onChange={(event) => setParallelism(Number(event.target.value))}
            />

            <UiInput
              size="compact"
              label={`${t("Type")} ${expectedConfirmation}`}
              type="text"
              value={confirmation}
              disabled={running}
              onChange={(event) => setConfirmation(event.target.value)}
              className="font-mono"
            />
          </div>
        </BucketOperationSetup>

        {progress && (
          <BucketOperationProgress
            label={t("Bucket purge progress")}
            value={progressPercent}
            stage={progress.bucket_name ? `${progress.bucket_name} - ${progress.stage}` : progress.stage}
            metrics={<>{progressEntriesLabel(progress, locale)}</>}
            destructive
          >
            {locale === "zh" ? (
              <>
                已完成 {formatCompactNumber(progress.completed_buckets)} / {formatCompactNumber(progress.total_buckets)} 个存储桶
                {" - "}
                已删除 {formatCompactNumber(progress.deleted_objects)} 个当前对象、{" "}
                {formatCompactNumber(progress.deleted_versions)} 个版本/删除标记条目
                {!progress.total_entries_final ? ` - ${t("Total still being discovered")}` : ""}
                {progress.failed_count > 0 ? ` - ${formatCompactNumber(progress.failed_count)} 个错误` : ""}
              </>
            ) : (
              <>
                {formatCompactNumber(progress.completed_buckets)} / {formatCompactNumber(progress.total_buckets)} buckets completed
                {" - "}
                {formatCompactNumber(progress.deleted_objects)} current object(s),{" "}
                {formatCompactNumber(progress.deleted_versions)} version/delete marker entries
                {!progress.total_entries_final ? " - Total still being discovered" : ""}
                {progress.failed_count > 0 ? ` - ${formatCompactNumber(progress.failed_count)} error(s)` : ""}
              </>
            )}
          </BucketOperationProgress>
        )}

        {result && (
          <div className="space-y-3">
            <div className={`grid gap-2 ${isDeleteMode ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
              <BucketOperationSummaryStat label={t("Objects deleted")} value={formatNumber(result.deleted_objects)} />
              <BucketOperationSummaryStat label={t("Versions/delete markers deleted")} value={formatNumber(result.deleted_versions)} />
              <BucketOperationSummaryStat
                label={t("Buckets completed")}
                value={`${formatNumber(result.completed_buckets)} / ${formatNumber(result.total_buckets)}`}
              />
              <BucketOperationSummaryStat label={t("Errors")} value={formatNumber(result.failed_count)} />
              {isDeleteMode && (
                <BucketOperationSummaryStat
                  label={t("Bucket")}
                  value={result.bucket_deleted ? t("Deleted") : t("Not deleted")}
                />
              )}
            </div>

            <div className="space-y-2">
              {result.buckets.map((bucket) => (
                <BucketOperationResult
                  key={`${bucket.context_id ?? ""}:${bucket.bucket_name}`}
                  bucketName={bucket.bucket_name}
                  contextLabel={bucket.context_name || bucket.context_id}
                  status={<ListBadge tone={bucketStatusTone(bucket.status)}>{statusLabel(bucket.status, t)}</ListBadge>}
                  durationSeconds={bucket.duration_seconds}
                  durationLabel={t("Duration")}
                  metrics={[
                    { label: t("Objects"), value: formatNumber(bucket.deleted_objects) },
                    { label: t("Versions"), value: formatNumber(bucket.deleted_versions) },
                    { label: t("Errors"), value: formatNumber(bucket.failed_count) },
                  ]}
                >
                  <BucketOperationFailures
                    bucketName={bucket.bucket_name}
                    title={t("Purge errors")}
                    targetLabel={t("Target")}
                    total={bucket.failed_count}
                    showCount
                    visibleErrorSummary={locale === "zh"
                      ? `${formatNumber(bucket.failures_sample.length)} 条可见 / 共 ${formatNumber(bucket.failed_count)} 条错误`
                      : undefined}
                    partialErrorMessage={locale === "zh"
                      ? `仅显示 ${formatNumber(bucket.failures_sample.length)} / ${formatNumber(bucket.failed_count)} 条错误。`
                      : undefined}
                    stageLabel={t("Stage")}
                    versionLabel={t("Version")}
                    countLabel={t("Count")}
                    messageLabel={t("Message")}
                    unavailableMessage={t("Error details are unavailable for this bucket.")}
                    failures={bucket.failures_sample.map((failure) => ({
                      stage: failure.stage,
                      target: failureTarget(failure, t),
                      version: failure.version_id,
                      count: failure.count,
                      message: failure.message,
                    }))}
                    emptyMessage={t("No purge error reported for this bucket.")}
                  />
                </BucketOperationResult>
              ))}
            </div>
          </div>
        )}
      </div>
    </WorkflowPage>
  );
}
