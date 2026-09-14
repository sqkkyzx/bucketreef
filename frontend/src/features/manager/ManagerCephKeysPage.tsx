/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import UiInput from "../../components/ui/UiInput";
import { ListActions, ListBadge, ListActionButton } from "../../components/list/ListControls";
import { useCallback, useEffect, useState } from "react";

import {
  createManagerCephAccessKey,
  deleteManagerCephAccessKey,
  listManagerCephAccessKeys,
  ManagerCephAccessKey,
  ManagerCephGeneratedAccessKey,
  updateManagerCephAccessKeyStatus,
} from "../../api/managerCephKeys";
import ListPageSection from "../../components/list/ListPageSection";
import OneTimeSecretPanel from "../../components/OneTimeSecretPanel";
import PageBanner from "../../components/PageBanner";
import PageEmptyState from "../../components/PageEmptyState";
import PageShell from "../../components/PageShell";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";

import { cx } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { formatLocalDateTime } from "../../utils/dateTime";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import CreateManagedPrivateAccessModal from "./CreateManagedPrivateAccessModal";
import { useManagerText } from "./managerI18n";
import type { I18nMessage } from "../../i18n";
import {
  localizeManagerCephKeysError,
  managerCephKeyResultCount,
  managerCephKeysZhMessages,
  managerPrivateConnectionCreatedMessage,
} from "./managerCephKeysMessages";

function parseError(err: unknown): string {
  return extractApiError(err, "Unexpected error");
}

export default function ManagerCephKeysPage() {
  const { locale, t } = useManagerText(managerCephKeysZhMessages);
  const {
    hasS3AccountContext,
    accountIdForApi,
    selectedS3AccountName,
    selectedS3AccountType,
    managerCephKeysEnabled,
    managerPrivateAccessEnabled,
    accessMode,
  } = useS3AccountContext();

  const [keys, setKeys] = useState<ManagerCephAccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<ManagerCephGeneratedAccessKey | null>(null);
  const [actionMessage, setActionMessage] = useState<I18nMessage | null>(null);
  const [keyFilter, setKeyFilter] = useState("");
  const [showPrivateAccessModal, setShowPrivateAccessModal] = useState(false);
  const keyConfirmation = useConfirmActionDialog();

  const isS3UserContext = selectedS3AccountType === "s3_user";
  const canManageCephKeys = Boolean(hasS3AccountContext && isS3UserContext && managerCephKeysEnabled);
  const canProvisionManagedPrivateAccess = Boolean(
    hasS3AccountContext && isS3UserContext && managerPrivateAccessEnabled
  );
  const loadKeys = useCallback(async () => {
    if (!canManageCephKeys) {
      setKeys([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listManagerCephAccessKeys(accountIdForApi);
      setKeys(data);
    } catch (err) {
      setError(parseError(err));
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [accountIdForApi, canManageCephKeys]);

  useEffect(() => {
    setCreatedKey(null);
    setActionMessage(null);
    void loadKeys();
  }, [accessMode, loadKeys]);

  const handleCreateKey = async () => {
    if (!canManageCephKeys) return;
    setBusy("create");
    setError(null);
    setActionMessage(null);
    try {
      const key = await createManagerCephAccessKey(accountIdForApi);
      setCreatedKey(key);
      setActionMessage("Access key created");
      await loadKeys();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleKey = async (key: ManagerCephAccessKey) => {
    if (!canManageCephKeys || key.is_ui_managed) return;
    const currentlyActive = key.is_active;
    setBusy(`toggle:${key.access_key_id}`);
    setError(null);
    setActionMessage(null);
    try {
      await updateManagerCephAccessKeyStatus(accountIdForApi, key.access_key_id, !currentlyActive);
      setActionMessage(currentlyActive ? "Access key disabled" : "Access key enabled");
      await loadKeys();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (key: ManagerCephAccessKey) => {
    if (!canManageCephKeys || key.is_ui_managed) return;
    setBusy(`delete:${key.access_key_id}`);
    setError(null);
    setActionMessage(null);
    try {
      await deleteManagerCephAccessKey(accountIdForApi, key.access_key_id);
      setActionMessage("Access key deleted");
      await loadKeys();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleToggleKey = (key: ManagerCephAccessKey) => {
    if (!key.is_active) {
      void toggleKey(key);
      return;
    }
    keyConfirmation.requestConfirmation({
      title: t("Disable Ceph access key?"),
      description: t("Temporarily prevent this RGW access key from authenticating."),
      confirmLabel: t("Disable key"),
      details: [{ label: t("Access key"), value: key.access_key_id, mono: true }],
      impacts: [t("Applications using this key will lose access until the key is enabled again.")],
      onConfirm: () => toggleKey(key),
    });
  };

  const handleDeleteKey = (key: ManagerCephAccessKey) => {
    keyConfirmation.requestConfirmation({
      title: t("Delete Ceph access key?"),
      description: t("Permanently remove this RGW access key from the current S3 User context."),
      confirmLabel: t("Delete key"),
      details: [
        { label: t("Context"), value: selectedS3AccountName || t("Current S3 User") },
        { label: t("Access key"), value: key.access_key_id, mono: true },
      ],
      impacts: [t("Applications using this key will immediately lose access.")],
      onConfirm: () => deleteKey(key),
    });
  };

  const filteredKeys = keys.filter((key) => {
    const needle = keyFilter.trim().toLowerCase();
    if (!needle) return true;
    const statusLabel = key.is_active ? "active" : "inactive";
    const localizedStatusLabel = t(key.is_active ? "Active" : "Inactive").toLowerCase();
    return key.access_key_id.toLowerCase().includes(needle)
      || statusLabel.includes(needle)
      || localizedStatusLabel.includes(needle);
  });
  const tableStatus = resolveListTableStatus({ loading, error, rowCount: filteredKeys.length });
  const keyTableColumns: Array<DataTableColumn<ManagerCephAccessKey>> = [
    {
      id: "access-key",
      label: t("Access key"),
      primary: true,
      mobileRole: "primary",
      cellClassName: "font-mono",
      render: (key) => {
        const managedPrivate = Boolean(key.is_private_access_managed);
        const locked = Boolean(key.is_ui_managed || managedPrivate);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>{key.access_key_id}</span>
            {locked && (
              <ListBadge
                tone="neutral" className="shrink-0"
                title={managedPrivate ? t("Managed private access key") : t("Portal key (locked)")}
              >
                {managedPrivate ? t("Private access") : t("KLO")}
              </ListBadge>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      label: t("Status"),
      cellClassName: "text-slate-700 dark:text-slate-200",
      render: (key) => t(key.is_active ? "Active" : "Inactive"),
    },
    {
      id: "created",
      label: t("Created on"),
      render: (key) => formatLocalDateTime(key.created_at, locale === "zh" ? "zh-CN" : undefined),
    },
    {
      id: "actions",
      label: t("Actions"),
      align: "right",
      mobileRole: "actions",
      render: (key) => {
        const active = key.is_active;
        const managedPrivate = Boolean(key.is_private_access_managed);
        const locked = Boolean(key.is_ui_managed || managedPrivate);
        return (
          <ListActions>
            <ListActionButton
              type="button"
              onClick={() => handleToggleKey(key)}
              disabled={Boolean(busy) || locked}
              title={locked ? (managedPrivate ? t("Update the linked private connection instead") : t("Portal key is locked")) : undefined}
            >
              {busy === `toggle:${key.access_key_id}` ? t("Saving...") : active ? t("Disable") : t("Enable")}
            </ListActionButton>
            <ListActionButton
              type="button"
              onClick={() => handleDeleteKey(key)}
               variant="danger"
              disabled={Boolean(busy) || locked}
              title={locked ? (managedPrivate ? t("Delete the linked private connection instead") : t("Portal key is locked")) : undefined}
            >
              {busy === `delete:${key.access_key_id}` ? t("Deleting...") : t("Delete")}
            </ListActionButton>
          </ListActions>
        );
      },
    },
  ];

  return (
    <PageShell actionPresentation="listing"
      title={t("Ceph access keys")}
      description={t("Manage Ceph RGW access keys and provision private access for this S3 User context.")}
      breadcrumbs={localizedManagerPageBreadcrumbs("ceph-keys", locale)}
      breadcrumbLabel={t("Breadcrumb")}
      actions={[
        ...(canManageCephKeys
          ? [
              {
                label: busy === "create" ? t("Creating...") : t("New key"),
                onClick: handleCreateKey,
                variant: "primary" as const,
              },
            ]
          : []),
        ...(canProvisionManagedPrivateAccess
          ? [
              {
                label: t("Create my private access"),
                onClick: () => setShowPrivateAccessModal(true),
                variant: canManageCephKeys ? ("secondary" as const) : ("primary" as const),
              },
            ]
          : []),
      ]}
    >
      {error && (
        <PageBanner tone="error">{localizeManagerCephKeysError(locale, error)}</PageBanner>
      )}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}

      {createdKey && (
        <OneTimeSecretPanel
          title={t("Access key created")}
          description={t("The secret is shown only once.")}
          badge={t("Copy these values now")}
          values={[
            { label: t("Access key"), value: createdKey.access_key_id, copyLabel: t("Copy") },
            { label: t("Secret key"), value: createdKey.secret_access_key, copyLabel: t("Copy") },
          ]}
          copyFeedback={{
            copied: t("Copied to clipboard."),
            failed: t("Unable to copy. Select and copy this value manually."),
          }}
        />
      )}

      {!hasS3AccountContext ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account before managing Ceph access keys")}
          description={t("Ceph access keys are scoped to the active execution context. Choose a managed S3 user context before opening key inventory.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : !isS3UserContext ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Ceph access keys are available only for managed S3 user contexts")}
          description={t("Switch to a managed S3 user execution context to create, enable, disable, or delete RGW access keys.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : managerCephKeysEnabled === null ? (
        <PageBanner tone="info">{t("Loading context capabilities…")}</PageBanner>
      ) : !managerCephKeysEnabled ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Ceph key inventory is unavailable for this context")}
          description={
            canProvisionManagedPrivateAccess
              ? t("Manual RGW key management is unavailable. Managed private access remains available from the page action.")
              : t("The selected context does not expose RGW access-key management. Check the user tool access, feature toggle, endpoint provider, admin feature, and Ceph admin credentials.")
          }
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : (
        <ListPageSection variant="page"
          title={t("Keys")}
          secondaryContent={<p>{t("BucketReef interface keys and managed private-access keys are locked; delete a managed key through its private connection.")}</p>}
          countLabel={managerCephKeyResultCount(locale, filteredKeys.length)}
          search={
            <UiInput aria-label={t("Search")} size="compact"
              type="search"
              value={keyFilter}
              onChange={(event) => setKeyFilter(event.target.value)}
              placeholder={t("Search by access key or status")}
            />
          }
        >
          <DataTableShell
            responsiveCards
            columns={keyTableColumns}
            rows={filteredKeys}
            rowKey={(key) => key.access_key_id}
            rowClassName={(key) =>
              cx("hover:bg-slate-50 dark:hover:bg-slate-800/50", !key.is_active && "bg-slate-50/70 dark:bg-slate-900/40")
            }
            status={tableStatus}
            loadingMessage={t("Loading keys...")}
            errorMessage={t("Unable to load keys.")}
            emptyMessage={t("No keys.")}
            tableLayout="fixed"
          />
        </ListPageSection>
      )}
      {keyConfirmation.confirmationDialog}
      {canProvisionManagedPrivateAccess && showPrivateAccessModal && (
        <CreateManagedPrivateAccessModal
          variant="rgw_user"
          accountId={accountIdForApi}
          contextName={selectedS3AccountName}
          onClose={() => setShowPrivateAccessModal(false)}
          onCreated={(name) => {
            setActionMessage(managerPrivateConnectionCreatedMessage(name));
            setError(null);
            void loadKeys();
          }}
        />
      )}
    </PageShell>
  );
}
