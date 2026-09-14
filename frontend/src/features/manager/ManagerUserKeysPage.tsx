/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListActions, ListBadge, ListActionButton } from "../../components/list/ListControls";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { S3AccountSelector } from "../../api/accountParams";
import {
  AccessKey,
  createIamAccessKey,
  deleteIamAccessKey,
  listIamAccessKeys,
  updateIamAccessKeyStatus,
} from "../../api/managerIamUsers";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import ListPageSection from "../../components/list/ListPageSection";
import OneTimeSecretPanel from "../../components/OneTimeSecretPanel";
import PageBanner from "../../components/PageBanner";
import PageShell from "../../components/PageShell";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";

import { cx } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { formatLocalDateTime } from "../../utils/dateTime";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerIamUsersError,
  managerIamKeyCount,
  managerIamKeyStatus,
  managerIamUserKeyCreatedTitle,
  managerIamUsersZhMessages,
} from "./managerIamUsersMessages";

function extractError(err: unknown): string {
  return extractApiError(err, "Unexpected error");
}

export default function ManagerUserKeysPage() {
  const { locale, t } = useManagerText(managerIamUsersZhMessages);
  const { userName } = useParams<{ userName: string }>();
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<AccessKey | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const keyConfirmation = useConfirmActionDialog();

  const isKeyActive = (key: AccessKey): boolean => {
    if (key.status) {
      const normalized = key.status.toLowerCase();
      if (["inactive", "disabled", "suspended"].includes(normalized)) return false;
      if (["active", "enabled"].includes(normalized)) return true;
    }
    return true;
  };

  const load = useCallback(async (accountId: S3AccountSelector, targetUser: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listIamAccessKeys(accountId, targetUser);
      setKeys(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (needsS3AccountSelection || isS3User) {
      setKeys([]);
      setLoading(false);
      return;
    }
    if (userName) {
      load(accountIdForApi, userName);
    }
  }, [accountIdForApi, needsS3AccountSelection, isS3User, userName, accessMode, load]);

  const handleCreateKey = async () => {
    if (needsS3AccountSelection || !userName) return;
    setBusy("create");
    setError(null);
    setActionMessage(null);
    try {
      const key = await createIamAccessKey(accountIdForApi, userName);
      setCreatedKey(key);
      await load(accountIdForApi, userName);
      setActionMessage("Access key created");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (needsS3AccountSelection || !userName) return;
    setBusy(`delete:${keyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await deleteIamAccessKey(accountIdForApi, userName, keyId);
      await load(accountIdForApi, userName);
      setActionMessage("Access key deleted");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleKey = async (keyId: string, nextActive: boolean) => {
    if (needsS3AccountSelection || !userName) return;
    setBusy(`toggle:${keyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await updateIamAccessKeyStatus(accountIdForApi, userName, keyId, nextActive);
      await load(accountIdForApi, userName);
      setActionMessage(nextActive ? "Access key enabled" : "Access key disabled");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteKey = (keyId: string) => {
    keyConfirmation.requestConfirmation({
      title: t("Delete IAM access key?"),
      description: t("Permanently remove this access key from the IAM user."),
      confirmLabel: t("Delete key"),
      details: [
        { label: t("User"), value: pageTitle },
        { label: t("Access key"), value: keyId, mono: true },
      ],
      impacts: [t("Applications using this key will immediately lose access.")],
      onConfirm: () => deleteKey(keyId),
    });
  };

  const handleToggleKey = (keyId: string, nextActive: boolean) => {
    if (nextActive) {
      void toggleKey(keyId, true);
      return;
    }
    keyConfirmation.requestConfirmation({
      title: t("Disable IAM access key?"),
      description: t("Temporarily prevent this access key from authenticating."),
      confirmLabel: t("Disable key"),
      details: [
        { label: t("User"), value: pageTitle },
        { label: t("Access key"), value: keyId, mono: true },
      ],
      impacts: [t("Applications using this key will lose access until the key is enabled again.")],
      onConfirm: () => toggleKey(keyId, false),
    });
  };

  const pageTitle = useMemo(() => {
    if (!userName) return "";
    try {
      return decodeURIComponent(userName);
    } catch {
      return userName;
    }
  }, [userName]);

  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: keys.length,
  });
  const keyTableColumns: Array<DataTableColumn<AccessKey>> = [
    {
      id: "access-key",
      label: t("Access key"),
      primary: true,
      mobileRole: "primary",
      cellClassName: "font-mono",
      render: (key) => (
        <div className="flex flex-wrap items-center gap-2">
          <span>{key.access_key_id}</span>
          {key.is_private_access_managed && (
            <ListBadge tone="neutral">{t("Private access")}</ListBadge>
          )}
        </div>
      ),
    },
    {
      id: "status",
      label: t("Status"),
      cellClassName: "text-slate-700 dark:text-slate-200",
      render: (key) => managerIamKeyStatus(locale, key.status ?? (isKeyActive(key) ? "Active" : "Inactive")),
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
        const active = isKeyActive(key);
        const managed = Boolean(key.is_private_access_managed);
        return (
          <ListActions>
            <ListActionButton
              type="button"
              onClick={() => handleToggleKey(key.access_key_id, !active)}
              disabled={Boolean(busy) || managed}
              title={managed ? t("Update the linked private connection instead") : undefined}
            >
              {busy === `toggle:${key.access_key_id}` ? t("Saving...") : active ? t("Disable") : t("Enable")}
            </ListActionButton>
            <ListActionButton
              type="button"
              onClick={() => handleDeleteKey(key.access_key_id)}
               variant="danger"
              disabled={Boolean(busy) || managed}
              title={managed ? t("Delete the linked private connection instead") : undefined}
            >
              {busy === `delete:${key.access_key_id}` ? t("Deleting...") : t("Delete")}
            </ListActionButton>
          </ListActions>
        );
      },
    },
  ];

  if (isS3User) {
    return (
      <PageShell actionPresentation="listing"
          title={t("User access keys")}
          description={t("Rotate IAM access keys for a specific user.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("users", locale, { label: t("Access keys") })}
          breadcrumbLabel={t("Breadcrumb")}
      >
        <PageBanner tone="info">{t("IAM users are not available for standalone S3 users. Select an S3 Account to continue.")}</PageBanner>
      </PageShell>
    );
  }

  if (!userName) {
    return <div className="ui-body text-slate-600">{t("User not specified.")}</div>;
  }

  if (needsS3AccountSelection) {
    return <div className="ui-body text-slate-600">{t("Select an account before managing keys.")}</div>;
  }

  return (
    <PageShell actionPresentation="listing"
      title={t("IAM access keys")}
      description={
        locale === "zh" ? (
          <>管理 <span className="font-semibold text-slate-700 dark:text-slate-100">{pageTitle}</span> 的访问密钥。</>
        ) : (
          <>Manage access keys for <span className="font-semibold text-slate-700 dark:text-slate-100">{pageTitle}</span>.</>
        )
      }
      breadcrumbs={localizedManagerPageBreadcrumbs(
        "users",
        locale,
        { label: pageTitle },
        { label: t("Access keys") },
      )}
      breadcrumbLabel={t("Breadcrumb")}
      actions={[
        { label: t("← Back to users"), to: "/manager/users", variant: "ghost" },
        { label: t("Attached policies"), to: `/manager/users/${encodeURIComponent(pageTitle)}/policies`, variant: "ghost" },
        {
          label: busy === "create" ? t("Creating...") : t("New key"),
          onClick: handleCreateKey,
          variant: "primary",
        },
      ]}
    >

      {error && <PageBanner tone="error">{localizeManagerIamUsersError(locale, error)}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}

      {createdKey && createdKey.secret_access_key && (
        <OneTimeSecretPanel
          title={managerIamUserKeyCreatedTitle(locale, pageTitle)}
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

      <ListPageSection variant="page"
          title={t("Keys")}
          countLabel={managerIamKeyCount(locale, keys.length)}
      >
        <DataTableShell
          responsiveCards
          columns={keyTableColumns}
          rows={keys}
          rowKey={(key) => key.access_key_id}
          rowClassName={(key) =>
            cx("hover:bg-slate-50 dark:hover:bg-slate-800/50", !isKeyActive(key) && "bg-slate-50/70 dark:bg-slate-900/40")
          }
          status={tableStatus}
          loadingMessage={t("Loading keys...")}
          errorMessage={t("Unable to load keys.")}
          emptyMessage={t("No keys for this user.")}
          tableLayout="fixed"
        />
      </ListPageSection>

      {keyConfirmation.confirmationDialog}

    </PageShell>
  );
}
