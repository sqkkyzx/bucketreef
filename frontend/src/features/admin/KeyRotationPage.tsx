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
import { localizedAdminPageBreadcrumbs } from "./adminBreadcrumbs";
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
import { useAdminControlText } from "./adminControlMessages";

type RotationTypeOption = {
  value: KeyRotationType;
  label: string;
  description: string;
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
  },
  {
    value: "endpoint_supervision",
    label: "Endpoint supervision keys",
    description:
      "Rotate supervision credentials used for usage and metrics collection.",
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
  {
    value: "ceph_admin",
    label: "Ceph-admin keys",
    description:
      "Rotate dedicated Ceph Admin credentials configured on endpoints.",
  },
];

const KEY_TYPE_LABEL: Record<KeyRotationType, string> = {
  endpoint_admin: "Endpoint admin",
  endpoint_supervision: "Endpoint supervision",
  account: "Account",
  s3_user: "S3 user",
  ceph_admin: "Ceph-admin",
};

const ENV_MANAGED_ENDPOINT_KEY_TYPES: KeyRotationType[] = [
  "endpoint_admin",
  "endpoint_supervision",
  "ceph_admin",
];

function isEndpointEligible(endpoint: StorageEndpoint): boolean {
  if (endpoint.provider !== "ceph") return false;
  const adminEnabled =
    endpoint.capabilities?.admin ?? endpoint.features?.admin?.enabled ?? false;
  return Boolean(adminEnabled);
}

function buildResultTableColumns(t: (message: string) => string): Array<DataTableColumn<KeyRotationResultRow>> {
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
  const { locale, t } = useAdminControlText();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [result, setResult] = useState<KeyRotationResponse | null>(null);
  const [endpoints, setEndpoints] = useState<StorageEndpoint[]>([]);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<KeyRotationType[]>([
    "endpoint_admin",
    "endpoint_supervision",
    "account",
    "s3_user",
    "ceph_admin",
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
          .filter((endpoint) => isEndpointEligible(endpoint))
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
    () => endpoints.filter((endpoint) => isEndpointEligible(endpoint)),
    [endpoints],
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
  const resultTableColumns = useMemo(() => buildResultTableColumns(t), [t]);
  const resultTableStatus = resolveListTableStatus({
    loading: false,
    error: null,
    rowCount: resultRows.length,
  });

  const runDisabled =
    running || selectedEndpointIds.length === 0 || selectedTypes.length === 0;

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
        endpoint_ids: selectedEndpointIds,
        key_types: selectedTypes,
        deactivate_only: deactivateOnly,
      });
      if (!active.current) return;
      setResult(response);
      setPreviousResult(false);
      if (response.summary.failed > 0) {
        setActionMessage(t("Rotation completed with errors. Review details below."));
      } else if (response.summary.skipped > 0) {
        setActionMessage(t("Rotation completed with skipped items. Review details below."));
      } else {
        setActionMessage(t("Rotation completed successfully."));
      }
    } catch (err) {
      if (active.current)
        setError(
          `${extractApiError(err, t("Unable to run key rotation."))} ${t("The outcome may be incomplete. Review the existing keys before starting another rotation.")}`,
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
      breadcrumbs={localizedAdminPageBreadcrumbs("key-rotation", locale)}
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
            description={t("Select Ceph endpoints with the admin API enabled.")}
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
                disabled={!isEndpointEligible(endpoint)}
                onChange={() => toggleEndpoint(endpoint.id)}
              >
                {!isEndpointEligible(endpoint) ? (
                  <span className="block text-amber-700 dark:text-amber-300">
                    {t("Unavailable: requires Ceph with the admin API enabled.")}
                  </span>
                ) : endpoint.is_editable === false ? (
                  <span className="block text-[var(--ui-text-muted)]">
                    {t("Endpoint credentials are managed by ENV_STORAGE_ENDPOINTS.")}
                  </span>
                ) : null}
              </SettingsChoiceRow>
            ))}
            {!loading && !endpoints.length && (
              <p className="settings-readonly">{t("No storage endpoints found.")}</p>
            )}
            {!loading && !selectedEndpointIds.length && (
              <p className="text-sm text-[var(--ui-text-muted)]">
                {t("Select at least one eligible endpoint.")}
              </p>
            )}
          </SettingsSection>
          <SettingsSection
            presentation="compact"
            title={t("Key categories")}
            description={t("Only the selected categories will be processed.")}
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
              />
            ))}
            {!selectedTypes.length && (
              <p className="settings-readonly">
                {t("Select at least one key category.")}
              </p>
            )}
          </SettingsSection>
          <SettingsSection presentation="compact" title={t("Previous keys")}>
            <SettingsItem
              compact
              title={t("Disable old keys only")}
              description={
                deactivateOnly
                  ? t("Keep old keys in an inactive state after replacement.")
                  : t("Delete old keys after replacement. This cannot be undone.")
              }
              action={
                <SettingsSwitch
                  ariaLabel={t("Disable old keys only")}
                  checked={deactivateOnly}
                  onChange={setDeactivateOnly}
                />
              }
            />
          </SettingsSection>
        </fieldset>
        <SettingsSection
          presentation="compact"
          title={t("Execution")}
          description={t("Review the scope before starting. Rotation can return partial results.")}
        >
          {hasSelectedEnvManagedEndpointKeys && (
            <PageBanner tone="warning">
              {t("Endpoint admin, supervision, and Ceph-admin keys managed by ENV_STORAGE_ENDPOINTS will be skipped. Rotate them externally and redeploy with the updated environment values. Account and S3 user keys remain eligible.")}
            </PageBanner>
          )}
          <SettingsItem
            compact
            title={running ? t("Rotation in progress") : selectedEndpointIds.length && selectedTypes.length ? t("Ready to review") : t("Choose rotation scope")}
            description={
              running
                ? t("The operation continues on the server. Wait for its results before starting another rotation.")
                : locale === "zh"
                  ? `${selectedEndpointIds.length} 个端点 · ${selectedTypes.length} 个密钥类别 · ${deactivateOnly ? "停用" : "删除"}旧密钥`
                  : `${selectedEndpointIds.length} endpoint(s) · ${selectedTypes.length} key categories · ${deactivateOnly ? "disable" : "delete"} previous keys`
            }
            action={
              <SettingsButton
                disabled={runDisabled || loading}
                onClick={() => setConfirmOpen(true)}
              >
                {running ? t("Rotating...") : t("Run rotation")}
              </SettingsButton>
            }
          />
        </SettingsSection>
        {result && (
          <section
            aria-label={t("Rotation results")}
            className="border-t border-[var(--ui-border-soft)] pt-5"
          >
            <ListToolbar variant="section"
              title={
                previousResult
                  ? t("Previous execution summary")
                  : t("Execution summary")
              }
              description={locale === "zh"
                ? `${t("Mode")}：${result.mode === "deactivate_old_keys" ? t("Deactivate old keys") : t("Delete old keys")}`
                : `Mode: ${result.mode === "deactivate_old_keys" ? t("Deactivate old keys") : t("Delete old keys")}`}
              countLabel={locale === "zh" ? `${result.results.length} 条详细结果` : `${result.results.length} detailed result${result.results.length === 1 ? "" : "s"}`}
            />
            <div className="my-3 flex flex-wrap gap-2">
              <UiBadge>{t("Total:")} {result.summary.total}</UiBadge>
              <UiBadge tone="success">
                {t("Rotated:")} {result.summary.rotated}
              </UiBadge>
              <UiBadge tone="danger">{t("Failed:")} {result.summary.failed}</UiBadge>
              <UiBadge>{t("Skipped:")} {result.summary.skipped}</UiBadge>
              <UiBadge>
                {t("Old keys deleted:")} {result.summary.deleted_old_keys}
              </UiBadge>
              <UiBadge>
                {t("Old keys disabled:")} {result.summary.disabled_old_keys}
              </UiBadge>
            </div>
            <DataTableShell
              columns={resultTableColumns}
              rows={resultRows}
              rowKey={(item) => item.rowKey}
              status={resultTableStatus}
              loadingMessage={t("Loading rotation results...")}
              errorMessage={t("Unable to load rotation results.")}
              emptyMessage={t("No details returned by the backend.")}
              primaryColumnId="endpoint"
              responsiveCards
              tableClassName="ui-data-table"
            />
          </section>
        )}
      </div>
      {confirmOpen && (
        <ConfirmActionDialog
          title={t("Run key rotation?")}
          description={t("New keys will replace the selected managed credentials. Applications using old keys may lose access.")}
          confirmLabel={t("Confirm rotation")}
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
                ? t("Disable after replacement")
                : t("Permanently delete after replacement"),
            },
          ]}
          warning={
            hasSelectedEnvManagedEndpointKeys
              ? t("Environment-managed endpoint credentials will be skipped. Account and S3 user keys remain eligible.")
              : undefined
          }
        />
      )}
      <SettingsNavigationGuard
        dirty={running}
        title={t("Leave this rotation?")}
        description={t("The server operation will continue. You may lose access to its detailed results on this page.")}
        confirmLabel={t("Leave page")}
        cancelLabel={t("Wait for results")}
      />
    </PageShell>
  );
}
