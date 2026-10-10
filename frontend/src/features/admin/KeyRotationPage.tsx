/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyRotationResponse,
  KeyRotationResultItem,
  KeyRotationType,
  rotateS3Keys,
} from "../../api/keyRotation";
import {
  StorageEndpoint,
  listStorageEndpoints,
} from "../../api/storageEndpoints";
import DataTableShell, {
  type DataTableColumn,
} from "../../components/list/DataTableShell";
import ListToolbar from "../../components/ListToolbar";
import PageBanner from "../../components/PageBanner";
import PageShell from "../../components/PageShell";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import { useAdminControlText } from "./adminControlMessages";
import UiBadge from "../../components/ui/UiBadge";
import {
  SettingsButton,
} from "../../components/settings/SettingsControls";
import SettingsNavigationGuard from "../../components/settings/SettingsNavigationGuard";
import {
  SettingsChoiceRow,
  SettingsSection,
  SettingsItem,
  SettingsSwitch,
} from "../../components/settings/SettingsLayout";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import { extractApiError } from "../../utils/apiError";

type RotationTypeOption = {
  value: KeyRotationType;
  label: string;
  description: string;
  manuallyProvisioned?: boolean;
};

type KeyRotationResultRow = KeyRotationResultItem & {
  rowKey: string;
};

const ROTATION_TYPE_OPTIONS: RotationTypeOption[] = [
  {
    value: "endpoint_admin",
    label: "Endpoint admin keys",
    description:
      "Rotate admin credentials configured on each selected endpoint.",
    manuallyProvisioned: true,
  },
  {
    value: "endpoint_runtime",
    label: "Runtime Read Ops",
    description: "Rotate managed credentials used for live read enrichment.",
  },
  {
    value: "endpoint_supervision",
    label: "Endpoint supervision keys",
    description:
      "Rotate supervision credentials used for usage and metrics collection.",
  },
  {
    value: "ceph_admin",
    label: "Ceph Admin keys",
    description:
      "Rotate the dedicated Ceph Admin credentials configured on each selected endpoint.",
    manuallyProvisioned: true,
  },
  {
    value: "account",
    label: "Account keys",
    description: "Rotate interface keys for managed RGW accounts.",
  },
  {
    value: "s3_user",
    label: "S3 user keys",
    description: "Rotate interface keys for managed standalone S3 users.",
  },
];

const KEY_TYPE_LABEL: Record<KeyRotationType, string> = {
  endpoint_admin: "Endpoint admin",
  endpoint_runtime: "Runtime Read Ops",
  endpoint_supervision: "Endpoint supervision",
  account: "Account",
  s3_user: "S3 user",
  ceph_admin: "Ceph-admin",
};

const ENV_MANAGED_ENDPOINT_KEY_TYPES: KeyRotationType[] = ["endpoint_admin", "ceph_admin"];
const TECHNICAL_TYPES: KeyRotationType[] = ["endpoint_runtime", "endpoint_supervision"];

function isEndpointEligible(endpoint: StorageEndpoint, types: KeyRotationType[]): boolean {
  if (endpoint.provider !== "ceph") return false;
  return types.some(type => {
    if (TECHNICAL_TYPES.includes(type)) {
      const kind = type === "endpoint_runtime" ? "runtime" : type === "endpoint_supervision" ? "supervision" : "ceph_admin";
      return endpoint.service_identities?.some(identity => identity.kind === kind && identity.mode === "managed" && (identity.status === "ready" || identity.rotation_pending)) ?? false;
    }
    if (type === "ceph_admin") {
      const identity = endpoint.service_identities?.find(candidate => candidate.kind === "ceph_admin");
      return Boolean(
        endpoint.is_editable !== false &&
        identity?.mode === "external" &&
        (identity.status === "ready" || identity.rotation_pending)
      );
    }
    return Boolean(endpoint.capabilities?.admin ?? endpoint.features?.admin?.enabled);
  });
}

function buildResultTableColumns(t: (message: string | { en?: string; fr?: string; de?: string; zh?: string }) => string): Array<DataTableColumn<KeyRotationResultRow>> {
  return [
  {
    id: "endpoint",
    label: t("Endpoint"),
    primary: true,
    render: (item) => item.endpoint_name,
  },
  {
    id: "type",
    label: t("Type"),
    render: (item) => t(KEY_TYPE_LABEL[item.key_type]),
  },
  {
    id: "target",
    label: t("Target"),
    render: (item) => item.target_label || item.target_type,
  },
  {
    id: "status",
    label: t("Status"),
    render: (item) => (
      <UiBadge
        tone={
          item.status === "rotated"
            ? "success"
            : item.status === "failed"
              ? "danger"
              : "neutral"
        }
      >
        {t(item.status)}
      </UiBadge>
    ),
  },
  {
    id: "details",
    label: t("Details"),
    render: (item) => (
      <>
        {item.message}
        {item.rotation_pending && <p>{t({ en: "Rotation pending", zh: "轮换等待中" })} · {item.rotation_phase}. {t({ en: "Retry the same category to resume.", zh: "请重试相同类别以继续。" })}</p>}
        {item.old_access_key && item.new_access_key ? (
          <details className="text-[var(--ui-text-muted)]">
            <summary className="cursor-pointer">{t("Key identifiers")}</summary>
            <span className="break-all font-mono text-xs">
              {item.old_access_key} → {item.new_access_key}
            </span>
          </details>
        ) : null}
      </>
    ),
  },
  ];
}

export default function KeyRotationPage() {
  const { t } = useAdminControlText();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [result, setResult] = useState<KeyRotationResponse | null>(null);
  const [endpoints, setEndpoints] = useState<StorageEndpoint[]>([]);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<KeyRotationType[]>([
    "endpoint_admin",
    "endpoint_runtime",
    "endpoint_supervision",
    "ceph_admin",
    "account",
    "s3_user",
  ]);
  const [previousResult, setPreviousResult] = useState(false);
  const [deactivateOnly, setDeactivateOnly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedEndpoints = await listStorageEndpoints();
        if (!mounted) return;
        setEndpoints(loadedEndpoints);
        const eligibleIds = loadedEndpoints
          .filter((endpoint) => isEndpointEligible(endpoint, ROTATION_TYPE_OPTIONS.map(option => option.value)))
          .map((endpoint) => endpoint.id);
        setSelectedEndpointIds(eligibleIds);
      } catch (err) {
        if (!mounted) return;
        setError(extractApiError(err, t("Unable to run key rotation.")));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [t]);

  const eligibleEndpoints = useMemo(
    () => endpoints.filter((endpoint) => isEndpointEligible(endpoint, selectedTypes)),
    [endpoints, selectedTypes],
  );
  const selectedEnvManagedEndpoints = useMemo(
    () =>
      eligibleEndpoints.filter(
        (endpoint) =>
          selectedEndpointIds.includes(endpoint.id) &&
          endpoint.is_editable === false,
      ),
    [eligibleEndpoints, selectedEndpointIds],
  );
  const hasSelectedEnvManagedEndpointKeys =
    selectedEnvManagedEndpoints.length > 0 &&
    selectedTypes.some((type) => ENV_MANAGED_ENDPOINT_KEY_TYPES.includes(type));
  const resultRows = useMemo<KeyRotationResultRow[]>(
    () =>
      (result?.results ?? []).map((item, index) => ({
        ...item,
        rowKey: `${item.endpoint_id}-${item.key_type}-${item.target_id ?? "none"}-${index}`,
      })),
    [result?.results],
  );
  const resultTableStatus = resolveListTableStatus({
    loading: false,
    error: null,
    rowCount: resultRows.length,
  });
  const resultTableColumns = useMemo(() => buildResultTableColumns(t), [t]);

  const technicalSelected = selectedTypes.some(type => TECHNICAL_TYPES.includes(type));
  useEffect(() => { if (technicalSelected) setDeactivateOnly(false); }, [technicalSelected]);

  const runDisabled =
    running || !eligibleEndpoints.some(endpoint => selectedEndpointIds.includes(endpoint.id)) || selectedTypes.length === 0;

  const toggleEndpoint = (endpointId: number) => {
    setSelectedEndpointIds((prev) =>
      prev.includes(endpointId)
        ? prev.filter((id) => id !== endpointId)
        : [...prev, endpointId],
    );
  };

  const toggleType = (type: KeyRotationType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((entry) => entry !== type)
        : [...prev, type],
    );
  };

  const selectAllEndpoints = () => {
    setSelectedEndpointIds(eligibleEndpoints.map((endpoint) => endpoint.id));
  };

  const clearAllEndpoints = () => {
    setSelectedEndpointIds([]);
  };

  const selectAllTypes = () => {
    setSelectedTypes(ROTATION_TYPE_OPTIONS.map((option) => option.value));
  };

  const clearAllTypes = () => {
    setSelectedTypes([]);
  };

  const runRotation = async () => {
    if (runDisabled || pending.current) return;
    pending.current = true;
    setConfirmOpen(false);
    setPreviousResult(Boolean(result));
    setRunning(true);
    setError(null);
    setActionMessage(null);
    try {
      const response = await rotateS3Keys({
        endpoint_ids: selectedEndpointIds.filter(id => eligibleEndpoints.some(endpoint => endpoint.id === id)),
        key_types: selectedTypes,
        deactivate_only: deactivateOnly,
      });
      if (!active.current) return;
      setResult(response);
      setPreviousResult(false);
      if (response.summary.failed > 0) {
        setActionMessage(
          t("Rotation completed with errors. Review details below."),
        );
      } else if (response.summary.skipped > 0) {
        setActionMessage(
          t("Rotation completed with skipped items. Review details below."),
        );
      } else {
        setActionMessage(t("Rotation completed successfully."));
      }
    } catch (err) {
      if (active.current)
        setError(
          `${extractApiError(err, t("Unable to run key rotation."))} ${t({ en: "The outcome may be incomplete. Retry the same categories to resume their persisted rotations.", zh: "结果可能不完整。请重试相同类别以继续已保存的轮换。" })}`,
        );
    } finally {
      pending.current = false;
      if (active.current) setRunning(false);
    }
  };

  return (
    <PageShell actionPresentation="listing"
      title={t("S3 key rotation")}
      description={t("Replace managed RGW keys on selected Ceph endpoints.")}
      breadcrumbs={adminPageBreadcrumbs("key-rotation")}
    >
      <div className="settings-compact">
        {loading && <PageBanner tone="info">{t("Loading endpoints...")}</PageBanner>}
        {error && <PageBanner tone="error">{error}</PageBanner>}
        {actionMessage && (
          <PageBanner
            tone={
              result?.summary.failed || result?.summary.skipped
                ? "warning"
                : "success"
            }
          >
            {actionMessage}
          </PageBanner>
        )}
        <fieldset disabled={running || loading} className="min-w-0">
          <SettingsSection
            presentation="compact"
            title={t("Endpoints")}
            description={t({ en: "Select endpoints eligible for at least one selected category. Ready managed service identities do not require the Admin feature.", zh: "选择至少符合一个所选类别的端点。就绪的托管服务身份不要求启用 Admin 功能。" })}
          >
            <div className="flex flex-wrap justify-end gap-2">
              <SettingsButton variant="ghost" onClick={selectAllEndpoints}>
                {t("Select all endpoints")}
              </SettingsButton>
              <SettingsButton variant="ghost" onClick={clearAllEndpoints}>
                {t("Clear endpoints")}
              </SettingsButton>
            </div>
            {endpoints.map((endpoint) => (
              <SettingsChoiceRow
                key={endpoint.id}
                title={endpoint.name}
                description={`${endpoint.endpoint_url} · ${endpoint.provider}`}
                checked={selectedEndpointIds.includes(endpoint.id)}
                disabled={!isEndpointEligible(endpoint, selectedTypes)}
                onChange={() => toggleEndpoint(endpoint.id)}
              >
                {!isEndpointEligible(endpoint, selectedTypes) ? (
                  <span className="block text-amber-700 dark:text-amber-300">
                    {t({ en: "Unavailable for the selected categories.", zh: "所选类别不可用。" })}
                  </span>
                ) : endpoint.is_editable === false ? (
                  <span className="block text-[var(--ui-text-muted)]">
                    {t({ en: "Admin Ops credentials are managed by ENV_STORAGE_ENDPOINTS. Managed service keys remain stored in the database.", zh: "Admin Ops 凭据由 ENV_STORAGE_ENDPOINTS 管理。托管服务密钥仍保存在数据库中。" })}
                  </span>
                ) : null}
              </SettingsChoiceRow>
            ))}
            {!loading && !endpoints.length && (
              <p className="settings-readonly">{t({ en: "No storage endpoints found.", zh: "未找到存储端点。" })}</p>
            )}
            {!loading && !selectedEndpointIds.length && (
              <p className="text-sm text-[var(--ui-text-muted)]">
                {t({ en: "Select at least one eligible endpoint.", zh: "至少选择一个符合条件的端点。" })}
              </p>
            )}
          </SettingsSection>
          <SettingsSection
            presentation="compact"
            title={t("Key categories")}
            description={t({ en: "Only the selected categories will be processed.", zh: "只会处理所选类别。" })}
          >
            <div className="flex flex-wrap justify-end gap-2">
              <SettingsButton variant="ghost" onClick={selectAllTypes}>
                {t("Select all categories")}
              </SettingsButton>
              <SettingsButton variant="ghost" onClick={clearAllTypes}>
                {t("Clear categories")}
              </SettingsButton>
            </div>
            {ROTATION_TYPE_OPTIONS.map((option) => (
              <SettingsChoiceRow
                key={option.value}
                title={t(option.label)}
                description={t(option.description)}
                checked={selectedTypes.includes(option.value)}
                onChange={() => toggleType(option.value)}
              >
                {option.manuallyProvisioned && (
                  <span className="block text-[var(--ui-text-muted)]">
                    {t({ en: "Manually provisioned keys may also be used outside BucketReef.", zh: "手动配置的密钥也可能在 BucketReef 外部使用。" })}
                  </span>
                )}
              </SettingsChoiceRow>
            ))}
            {!selectedTypes.length && (
              <p className="settings-readonly">
                {t({ en: "Select at least one key category.", zh: "至少选择一个密钥类别。" })}
              </p>
            )}
          </SettingsSection>
          <SettingsSection presentation="compact" title={t("Previous keys")}>
            <SettingsItem
              compact
              title={t("Disable old keys only")}
              description={
                technicalSelected
                  ? t({ en: "Managed technical identities require deletion of previous keys. Deselect these categories to use disable mode.", zh: "托管技术身份要求删除旧密钥。取消选择这些类别即可使用停用模式。" })
                  : deactivateOnly
                  ? t({ en: "Keep old keys in an inactive state after replacement.", zh: "替换后保留旧密钥但将其停用。" })
                  : t({ en: "Delete old keys after replacement. This cannot be undone.", zh: "替换后删除旧密钥，此操作无法撤销。" })
              }
              action={
                <SettingsSwitch
                  ariaLabel={t("Disable old keys only")}
                  disabled={technicalSelected}
                  checked={deactivateOnly}
                  onChange={value => { if (!technicalSelected) setDeactivateOnly(value); }}
                />
              }
            />
          </SettingsSection>
        </fieldset>
        <SettingsSection
          presentation="compact"
          title={t("Execution")}
          description={t({ en: "Review the scope before starting. Rotation can return partial results.", zh: "开始前请检查范围。轮换可能返回部分结果。" })}
        >
          {hasSelectedEnvManagedEndpointKeys && (
            <PageBanner tone="warning">
              {t({ en: "Admin Ops and Ceph Admin keys supplied by ENV_STORAGE_ENDPOINTS will be skipped. Rotate them externally and update the environment values. Managed service identities, account keys and S3 user keys remain eligible. Other external service identities are rotated by their operator.", zh: "ENV_STORAGE_ENDPOINTS 提供的 Admin Ops 和 Ceph Admin 密钥将被跳过。请在外部轮换它们并更新环境变量值。托管服务身份、账户密钥和 S3 用户密钥仍可轮换。其他外部服务身份由其操作方轮换。" })}
            </PageBanner>
          )}
          <SettingsItem
            compact
            title={running ? t({ en: "Rotation in progress", zh: "轮换进行中" }) : selectedEndpointIds.length && selectedTypes.length ? t({ en: "Ready to review", zh: "可以检查" }) : t({ en: "Choose rotation scope", zh: "选择轮换范围" })}
            description={
              running
                ? t({ en: "The operation continues on the server. Wait for its results before starting another rotation.", zh: "操作会在服务器上继续。请等待结果后再开始下一次轮换。" })
                : `${selectedEndpointIds.length} ${t({ en: "endpoint(s)", zh: "个端点" })} · ${selectedTypes.length} ${t({ en: "key categories", zh: "个密钥类别" })} · ${deactivateOnly ? t({ en: "disable", zh: "停用" }) : t({ en: "delete", zh: "删除" })} ${t({ en: "previous keys", zh: "旧密钥" })}`
            }
            action={
              <SettingsButton
                disabled={runDisabled || loading}
                onClick={() => setConfirmOpen(true)}
              >
                {running ? t({ en: "Rotating...", zh: "正在轮换…" }) : t({ en: "Run rotation", zh: "执行轮换" })}
              </SettingsButton>
            }
          />
        </SettingsSection>
        {result && (
          <section
            aria-label={t({ en: "Rotation results", zh: "轮换结果" })}
            className="border-t border-[var(--ui-border-soft)] pt-5"
          >
            <ListToolbar variant="section"
              title={
                previousResult
                  ? t({ en: "Previous execution summary", zh: "上一次执行摘要" })
                  : t({ en: "Execution summary", zh: "执行摘要" })
              }
              description={`${t({ en: "Mode:", zh: "模式：" })} ${result.mode === "deactivate_old_keys" ? t({ en: "Deactivate old keys", zh: "停用旧密钥" }) : t({ en: "Delete old keys", zh: "删除旧密钥" })}`}
              countLabel={`${result.results.length} ${t({ en: result.results.length === 1 ? "detailed result" : "detailed results", zh: "条详细结果" })}`}
            />
            <div className="my-3 flex flex-wrap gap-2">
              <UiBadge>{t({ en: "Total:", zh: "总计：" })} {result.summary.total}</UiBadge>
              <UiBadge tone="success">
                {t({ en: "Rotated:", zh: "已轮换：" })} {result.summary.rotated}
              </UiBadge>
              <UiBadge tone="danger">{t({ en: "Failed:", zh: "失败：" })} {result.summary.failed}</UiBadge>
              <UiBadge>{t({ en: "Skipped:", zh: "已跳过：" })} {result.summary.skipped}</UiBadge>
              <UiBadge>
                {t({ en: "Old keys deleted:", zh: "已删除旧密钥：" })} {result.summary.deleted_old_keys}
              </UiBadge>
              <UiBadge>
                {t({ en: "Old keys disabled:", zh: "已停用旧密钥：" })} {result.summary.disabled_old_keys}
              </UiBadge>
            </div>
            <DataTableShell
              columns={resultTableColumns}
              rows={resultRows}
              rowKey={(item) => item.rowKey}
              status={resultTableStatus}
              loadingMessage={t({ en: "Loading rotation results...", zh: "正在加载轮换结果…" })}
              errorMessage={t({ en: "Unable to load rotation results.", zh: "无法加载轮换结果。" })}
              emptyMessage={t({ en: "No details returned by the backend.", zh: "后端未返回详细结果。" })}
              primaryColumnId="endpoint"
              responsiveCards
              tableClassName="ui-data-table"
            />
          </section>
        )}
      </div>
      {confirmOpen && (
        <ConfirmActionDialog
          title={t({ en: "Run key rotation?", zh: "执行密钥轮换？" })}
          description={t({ en: "New keys will replace the selected managed credentials. Applications using old keys may lose access.", zh: "新密钥将替换所选的托管凭据。使用旧密钥的应用可能会失去访问权限。" })}
          confirmLabel={t({ en: "Confirm rotation", zh: "确认轮换" })}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void runRotation()}
          details={[
            {
              label: t("Endpoints"),
              value: eligibleEndpoints
                .filter((endpoint) => selectedEndpointIds.includes(endpoint.id))
                .map((endpoint) => endpoint.name)
                .join(", "),
            },
            {
              label: t("Key categories"),
              value: selectedTypes
                .map((type) => t(KEY_TYPE_LABEL[type]))
                .join(", "),
            },
            {
              label: t("Previous keys"),
              value: deactivateOnly
                ? t({ en: "Disable after replacement", zh: "替换后停用" })
                : t({ en: "Permanently delete after replacement", zh: "替换后永久删除" }),
            },
          ]}
          warning={
            hasSelectedEnvManagedEndpointKeys
              ? t({ en: "ENV Admin Ops and external service identities will be skipped. Managed service identities, account and S3 user keys remain eligible.", zh: "环境变量中的 Admin Ops 和外部服务身份将被跳过。托管服务身份、账户密钥和 S3 用户密钥仍可轮换。" })
              : undefined
          }
        />
      )}
      <SettingsNavigationGuard
        dirty={running}
        title={t({ en: "Leave this rotation?", zh: "离开此次轮换？" })}
        description={t({ en: "The server operation will continue. You may lose access to its detailed results on this page.", zh: "服务器操作会继续，但你可能无法在此页面查看详细结果。" })}
        confirmLabel={t({ en: "Leave page", zh: "离开页面" })}
        cancelLabel={t({ en: "Wait for results", zh: "等待结果" })}
      />
    </PageShell>
  );
}
