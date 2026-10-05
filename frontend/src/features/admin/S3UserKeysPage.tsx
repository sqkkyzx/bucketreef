/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListActions, ListBadge, ListActionButton } from "../../components/list/ListControls";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CreatedS3UserAccessKey,
  S3User,
  S3UserAccessKey,
  createS3UserKey,
  deleteS3UserKey,
  getS3User,
  listS3UserKeys,
  rotateS3UserKeys,
  updateS3UserKeyStatus,
} from "../../api/s3Users";
import OneTimeSecretPanel from "../../components/OneTimeSecretPanel";
import PageShell from "../../components/PageShell";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import PageBanner from "../../components/PageBanner";
import ListPageSection from "../../components/list/ListPageSection";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";

import { cx } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { useI18n } from "../../i18n";
import { rgwMessages } from "./adminRgwMessages";

export default function S3UserKeysPage() {
  const { t } = useI18n();
  const { userId } = useParams<{ userId: string }>();
  const numericUserId = userId ? Number(userId) : NaN;
  const [user, setUser] = useState<S3User | null>(null);
  const [keys, setKeys] = useState<S3UserAccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedS3UserAccessKey | null>(null);
  const keyConfirmation = useConfirmActionDialog();

  const extractError = (err: unknown): string => extractApiError(err, t(rgwMessages.unexpectedError));

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const loadUser = useCallback(async () => {
    if (!Number.isFinite(numericUserId)) return;
    try {
      const data = await getS3User(numericUserId);
      setUser(data);
    } catch (err) {
      setError(extractError(err));
    }
  }, [numericUserId, t]);

  const loadKeys = useCallback(async () => {
    if (!Number.isFinite(numericUserId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listS3UserKeys(numericUserId);
      setKeys(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [numericUserId, t]);

  useEffect(() => {
    if (!Number.isFinite(numericUserId)) {
      setError(t({ en: "Invalid user id.", zh: "用户 ID 无效。" }));
      return;
    }
    loadUser();
    loadKeys();
  }, [loadKeys, loadUser, numericUserId]);

  const handleCreateKey = async () => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy("create");
    setError(null);
    setActionMessage(null);
    try {
      const key = await createS3UserKey(numericUserId);
      setCreatedKey(key);
      await loadKeys();
      setActionMessage(t({ en: "Access key created.", zh: "访问密钥已创建。" }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (accessKeyId: string) => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy(`delete:${accessKeyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await deleteS3UserKey(numericUserId, accessKeyId);
      await loadKeys();
      setActionMessage(t({ en: "Access key deleted.", zh: "访问密钥已删除。" }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleKey = async (accessKeyId: string, nextActive: boolean) => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy(`toggle:${accessKeyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await updateS3UserKeyStatus(numericUserId, accessKeyId, nextActive);
      await loadKeys();
      setActionMessage(nextActive ? t({ en: "Access key enabled.", zh: "访问密钥已启用。" }) : t({ en: "Access key disabled.", zh: "访问密钥已禁用。" }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteKey = (accessKeyId: string) => {
    keyConfirmation.requestConfirmation({
      title: t({ en: "Delete access key?", zh: "删除访问密钥？" }),
      description: t({ en: "Permanently remove this RGW access key from the selected user.", zh: "永久删除所选用户的 RGW 访问密钥。" }),
      confirmLabel: t({ en: "Delete key", zh: "删除密钥" }),
      details: [
        { label: t(rgwMessages.user), value: pageTitle },
        { label: t({ en: "Access key", zh: "访问密钥" }), value: accessKeyId, mono: true },
      ],
      impacts: [t({ en: "Applications using this key will immediately lose access.", zh: "使用此密钥的应用将立即失去访问权限。" })],
      onConfirm: () => deleteKey(accessKeyId),
    });
  };

  const handleToggleKey = (accessKeyId: string, nextActive: boolean) => {
    if (nextActive) {
      void toggleKey(accessKeyId, true);
      return;
    }
    keyConfirmation.requestConfirmation({
      title: t({ en: "Disable access key?", zh: "禁用访问密钥？" }),
      description: t({ en: "Temporarily prevent this RGW access key from authenticating.", zh: "暂时禁止此 RGW 访问密钥进行身份验证。" }),
      confirmLabel: t({ en: "Disable key", zh: "禁用密钥" }),
      details: [
        { label: t(rgwMessages.user), value: pageTitle },
        { label: t({ en: "Access key", zh: "访问密钥" }), value: accessKeyId, mono: true },
      ],
      impacts: [t({ en: "Applications using this key will lose access until the key is enabled again.", zh: "在重新启用密钥前，使用它的应用将失去访问权限。" })],
      onConfirm: () => toggleKey(accessKeyId, false),
    });
  };

  const handleRotateUiKey = async () => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy("rotate");
    setError(null);
    setActionMessage(null);
    try {
      await rotateS3UserKeys(numericUserId);
      await Promise.all([loadUser(), loadKeys()]);
      setActionMessage(t({ en: "Interface key rotated.", zh: "界面密钥已轮换。" }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const pageTitle = useMemo(() => {
    if (user?.name) return user.name;
    if (userId) return t({ en: `User #${userId}`, zh: `用户 #${userId}` });
    return t(rgwMessages.user);
  }, [t, user?.name, userId]);

  const interfaceKey = keys.find((k) => k.is_ui_managed);
  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: keys.length,
  });
  const keyTableColumns: Array<DataTableColumn<S3UserAccessKey>> = [
    {
      id: "access-key",
      label: t({ en: "Access key", zh: "访问密钥" }),
      primary: true,
      mobileRole: "primary",
      cellClassName: "font-mono",
      render: (key) => key.access_key_id,
    },
    {
      id: "status",
      label: t({ en: "Status", zh: "状态" }),
      cellClassName: "text-slate-700 dark:text-slate-200",
      render: (key) => (key.is_active ? t(rgwMessages.active) : t(rgwMessages.disabled)),
    },
    { id: "created", label: t({ en: "Created on", zh: "创建时间" }), render: (key) => formatDate(key.created_at) },
    {
      id: "usage",
      label: t(rgwMessages.usage),
      render: (key) =>
        key.is_ui_managed ? (
          <ListBadge tone="neutral">
            {t({ en: "Interface key", zh: "界面密钥" })}
          </ListBadge>
        ) : (
          <span className="ui-caption text-slate-500 dark:text-slate-400">{t({ en: "Custom", zh: "自定义" })}</span>
        ),
    },
    {
      id: "actions",
      label: t(rgwMessages.actions),
      align: "right",
      mobileRole: "actions",
      render: (key) =>
        key.is_ui_managed ? (
          <ListActionButton
            type="button"
            onClick={handleRotateUiKey}
            disabled={busy === "rotate"}
          >
            {busy === "rotate" ? t(rgwMessages.rotating) : t(rgwMessages.rotate)}
          </ListActionButton>
        ) : (
          <ListActions>
            <ListActionButton
              type="button"
              onClick={() => handleToggleKey(key.access_key_id, !key.is_active)}
              disabled={Boolean(busy)}
            >
              {busy === `toggle:${key.access_key_id}` ? t(rgwMessages.saving) : key.is_active ? t(rgwMessages.disable) : t(rgwMessages.enable)}
            </ListActionButton>
            <ListActionButton
              type="button"
              onClick={() => handleDeleteKey(key.access_key_id)}
               variant="danger"
              disabled={Boolean(busy)}
            >
              {busy === `delete:${key.access_key_id}` ? t(rgwMessages.deleting) : t(rgwMessages.delete)}
            </ListActionButton>
          </ListActions>
        ),
    },
  ];

  if (!userId || Number.isNaN(numericUserId)) {
    return (
      <PageShell actionPresentation="listing"
        title={t(rgwMessages.userAccessKeys)}
        description={t({ en: "Manage RGW keys for the selected user.", zh: "管理所选用户的 RGW 密钥。" })}
        breadcrumbs={adminPageBreadcrumbs("rgw-users", { label: t(rgwMessages.accessKeys) })}
      >
        <PageBanner tone="error">{t({ en: "Invalid user id provided.", zh: "提供的用户 ID 无效。" })}</PageBanner>
      </PageShell>
    );
  }

  return (
    <PageShell actionPresentation="listing"
      title={t(rgwMessages.userAccessKeys)}
      description={
        <>
          {t({ en: "Manage keys for", zh: "管理" })} <span className="font-semibold text-slate-700 dark:text-slate-100">{pageTitle}</span>{t({ en: ".", zh: "的密钥。" })}
        </>
      }
      breadcrumbs={adminPageBreadcrumbs("rgw-users", { label: pageTitle }, { label: t(rgwMessages.accessKeys) })}
      actions={[
        { label: t({ en: "← Back to users", zh: "← 返回用户" }), to: "/admin/s3-users", variant: "ghost" },
        {
          label: busy === "create" ? t(rgwMessages.creating) : t(rgwMessages.newKey),
          onClick: handleCreateKey,
          variant: "primary",
        },
      ]}
    >

      {interfaceKey && (
        <PageBanner tone="info">
          {t({ en: "The interface key is reserved for the console. Delete other keys as needed, and rotate the interface key instead of deleting it.", zh: "界面密钥专供控制台使用。请按需删除其他密钥，并轮换界面密钥，不要删除它。" })}
        </PageBanner>
      )}

      {error && <PageBanner tone="error">{error}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{actionMessage}</PageBanner>}

      {createdKey && createdKey.secret_access_key && (
        <OneTimeSecretPanel
          title={t({ en: `Key created for ${pageTitle}`, zh: `已为 ${pageTitle} 创建密钥` })}
          description={t({ en: "The secret is shown only once.", zh: "私有密钥仅显示一次。" })}
          badge={t({ en: "Copy these values now", zh: "请立即复制这些值" })}
          values={[
            { label: t({ en: "Access key", zh: "访问密钥" }), value: createdKey.access_key_id, copyLabel: t(rgwMessages.copy) },
            { label: t({ en: "Secret key", zh: "私有密钥" }), value: createdKey.secret_access_key, copyLabel: t(rgwMessages.copy) },
          ]}
        />
      )}

      <ListPageSection variant="page"
        title={t(rgwMessages.keys)}
        countLabel={`${keys.length} ${t({ en: keys.length === 1 ? "key" : "keys", zh: "个密钥" })}`}
      >
        <DataTableShell
          responsiveCards
          columns={keyTableColumns}
          rows={keys}
          rowKey={(key) => key.access_key_id}
          rowClassName={(key) =>
            cx("hover:bg-slate-50 dark:hover:bg-slate-800/50", !key.is_active && "bg-slate-50/70 dark:bg-slate-900/40")
          }
          status={tableStatus}
          loadingMessage={t(rgwMessages.loadingKeys)}
          errorMessage={t({ en: "Unable to load keys.", zh: "无法加载密钥。" })}
          emptyMessage={t(rgwMessages.noKeys)}
          tableLayout="fixed"
        />
      </ListPageSection>
      {keyConfirmation.confirmationDialog}
    </PageShell>
  );
}
