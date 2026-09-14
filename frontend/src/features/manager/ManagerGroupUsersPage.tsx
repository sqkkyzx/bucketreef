/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import ListPageSection from "../../components/list/ListPageSection";
import { ListActionButton } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { S3AccountSelector } from "../../api/accountParams";
import { IAMUser, listIamUsers } from "../../api/managerIamUsers";
import { addIamGroupUser, listIamGroupUsers, removeIamGroupUser } from "../../api/managerIamGroups";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import PageShell from "../../components/PageShell";
import PageBanner from "../../components/PageBanner";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import { extractApiError } from "../../utils/apiError";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { useManagerText } from "./managerI18n";
import { localizeManagerGroupsError, managerGroupsZhMessages } from "./managerGroupsMessages";

function extractError(err: unknown): string {
  return extractApiError(err, "Unexpected error");
}

export default function ManagerGroupUsersPage() {
  const { locale, t } = useManagerText(managerGroupsZhMessages);
  const { groupName } = useParams<{ groupName: string }>();
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";

  const [users, setUsers] = useState<IAMUser[]>([]);
  const [allUsers, setAllUsers] = useState<IAMUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const memberConfirmation = useConfirmActionDialog();

  const decodedGroup = useMemo(() => {
    if (!groupName) return "";
    try {
      return decodeURIComponent(groupName);
    } catch {
      return groupName;
    }
  }, [groupName]);

  const load = useCallback(async (accountId: S3AccountSelector, targetGroup: string) => {
    setLoading(true);
    setError(null);
    try {
      const [members, existingUsers] = await Promise.all([
        listIamGroupUsers(accountId, targetGroup),
        listIamUsers(accountId),
      ]);
      setUsers(members);
      setAllUsers(existingUsers);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isS3User || needsS3AccountSelection) {
      setUsers([]);
      setAllUsers([]);
      setLoading(false);
      return;
    }
    if (groupName) {
      load(accountIdForApi, groupName);
    }
  }, [accountIdForApi, isS3User, needsS3AccountSelection, groupName, accessMode, load]);

  const availableUsers = useMemo(
    () => allUsers.filter((u) => !users.some((member) => member.name === u.name)),
    [allUsers, users]
  );
  const noAvailableUsers = availableUsers.length === 0;

  useEffect(() => {
    if (newUser && !availableUsers.some((u) => u.name === newUser)) {
      setNewUser("");
    }
  }, [availableUsers, newUser]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (needsS3AccountSelection || !groupName || !newUser.trim()) return;
    setBusy("add");
    setError(null);
    setActionMessage(null);
    try {
      await addIamGroupUser(accountIdForApi, groupName, newUser.trim());
      setNewUser("");
      await load(accountIdForApi, groupName);
      setActionMessage("User added to group");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const removeUser = async (userName: string) => {
    if (needsS3AccountSelection || !groupName) return;
    setBusy(userName);
    setError(null);
    setActionMessage(null);
    try {
      await removeIamGroupUser(accountIdForApi, groupName, userName);
      await load(accountIdForApi, groupName);
      setActionMessage("User removed from group");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = (userName: string) => {
    memberConfirmation.requestConfirmation({
      title: t("Remove user from group?"),
      description: t("Detach this IAM user from the selected group."),
      confirmLabel: t("Remove user"),
      details: [
        { label: t("Group"), value: decodedGroup },
        { label: t("User"), value: userName },
      ],
      impacts: [t("Permissions inherited only through this group will no longer apply to the user.")],
      onConfirm: () => removeUser(userName),
    });
  };

  if (isS3User) {
    return (
      <PageShell actionPresentation="listing"
          title={t("Group members")}
          description={t("Manage IAM group membership.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("groups", locale, { label: t("Users") })}
          breadcrumbLabel={t("Breadcrumb")}
      >
        <PageBanner tone="info">{t("IAM features are disabled for standalone S3 users. Select an S3 Account to continue.")}</PageBanner>
      </PageShell>
    );
  }

  if (!groupName) {
    return <div className="ui-body text-slate-600">{t("Group not specified.")}</div>;
  }

  if (needsS3AccountSelection) {
    return <div className="ui-body text-slate-600">{t("Select an account before managing groups.")}</div>;
  }

  const handleRefresh = () => {
    if (needsS3AccountSelection) return;
    if (groupName) {
      load(accountIdForApi, groupName);
    }
  };

  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: users.length,
  });
  const userColumns: Array<DataTableColumn<IAMUser>> = [
    {
      id: "user",
      label: t("User"),
      primary: true,
      render: (user) => user.name,
    },
    {
      id: "arn",
      label: "ARN",
      cellClassName: "break-all font-mono text-[11px]",
      render: (user) => user.arn ?? "-",
    },
    {
      id: "actions",
      label: t("Actions"),
      align: "right",
      mobileRole: "actions",
      render: (user) => (
        <ListActionButton variant="danger"
          type="button"
          onClick={() => handleRemove(user.name)}
          disabled={busy === user.name}
        >
          {busy === user.name ? t("Removing...") : t("Remove")}
        </ListActionButton>
      ),
    },
  ];

  return (
    <PageShell actionPresentation="listing"
      title={t("Group members")}
      description={
        locale === "zh" ? (
          <>管理用户组“<span className="font-semibold text-slate-700 dark:text-slate-100">{decodedGroup}</span>”中的用户。</>
        ) : (
          <>Manage users for <span className="font-semibold text-slate-700 dark:text-slate-100">{decodedGroup}</span>.</>
        )
      }
      breadcrumbs={localizedManagerPageBreadcrumbs(
        "groups",
        locale,
        { label: decodedGroup },
        { label: t("Users") },
      )}
      breadcrumbLabel={t("Breadcrumb")}
      actions={[
        { label: t("← Back to groups"), to: "/manager/groups", variant: "ghost" },
        { label: t("Attached policies"), to: `/manager/groups/${encodeURIComponent(decodedGroup)}/policies`, variant: "ghost" },
        { label: t("Refresh"), onClick: handleRefresh, variant: "ghost" },
      ]}
    >

      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}
      {error && <PageBanner tone="error">{localizeManagerGroupsError(locale, error)}</PageBanner>}
      {noAvailableUsers && (
        <PageBanner tone="warning">{t("No IAM users available to add. Create one before managing this group.")}</PageBanner>
      )}

      <form
        onSubmit={handleAdd}
        className="space-y-3 ui-surface-card p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label={t("User")}
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 ui-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{t("Select an existing user")}</option>
            {availableUsers.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy !== null || !newUser}
            className="rounded-md bg-primary px-4 py-2 ui-body font-medium text-white shadow-sm transition hover:bg-primary-600 disabled:opacity-60"
          >
            {busy === "add" ? t("Adding...") : t("Add")}
          </button>
        </div>
        <p className="ui-caption text-slate-500 dark:text-slate-400">
          {t("Users come from IAM. Add them here to attach them to the group.")}
        </p>
      </form>

      <ListPageSection variant="section" title={t("Users")} description={t("Members of this group.")}>
        <DataTableShell
          columns={userColumns}
          rows={users}
          rowKey={(user) => user.name}
          status={tableStatus}
          loadingMessage={t("Loading members...")}
          errorMessage={t("Unable to load users.")}
          emptyMessage={t("No members in this group.")}
          tableClassName="ui-data-table"
          responsiveCards
        />
      </ListPageSection>
      {memberConfirmation.confirmationDialog}
    </PageShell>
  );
}
