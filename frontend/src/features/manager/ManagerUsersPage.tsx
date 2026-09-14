/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import TableSortControls from "../../components/list/TableSortControls";
import { ListActions, ListBadge, ListActionLink, ListActionButton } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { I18nMessage } from "../../i18n";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { S3AccountSelector } from "../../api/accountParams";
import {
  AccessKey,
  IAMUser,
  createIamUser,
  deleteIamUser,
  listIamUsers,
} from "../../api/managerIamUsers";
import { IAMGroup, listIamGroups } from "../../api/managerIamGroups";
import { IamPolicy, listIamPolicies } from "../../api/managerIamPolicies";
import ListPageSection from "../../components/list/ListPageSection";
import OneTimeSecretPanel from "../../components/OneTimeSecretPanel";
import PageEmptyState from "../../components/PageEmptyState";
import PageHeader from "../../components/PageHeader";
import PageBanner from "../../components/PageBanner";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import WorkflowPage, { workflowPageHostClass } from "../../components/WorkflowPage";

import UiCheckboxField from "../../components/ui/UiCheckboxField";
import { extractApiError } from "../../utils/apiError";
import { stableSignature } from "../../utils/stableSignature";
import { compareByNullableField, nextSortState, type SortableField } from "../../utils/sortValues";
import { DEFAULT_INLINE_POLICY_TEXT } from "./inlinePolicyTemplate";
import InlinePolicyDraftEditor from "./InlinePolicyDraftEditor";
import ManagedPolicySelectionPanel from "./ManagedPolicySelectionPanel";
import ManagerToolbarSearch from "./ManagerToolbarSearch";
import CreateManagedPrivateAccessModal from "./CreateManagedPrivateAccessModal";
import { useInlinePolicyDraftEditor } from "./useInlinePolicyDraftEditor";
import { useManagerIamCollection } from "./useManagerIamCollection";
import SettingsForm from "../../components/settings/SettingsForm";
import { focusFirstInvalidField } from "../../utils/focusFirstInvalidField";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import { SettingsButton } from "../../components/settings/SettingsControls";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerIamUsersError,
  managerIamPrivateConnectionCreatedMessage,
  managerIamSelectedCount,
  managerIamUserKeyCreatedTitle,
  managerIamUserResultCount,
  managerIamUsersZhMessages,
} from "./managerIamUsersMessages";

const extractError = (err: unknown): string => extractApiError(err, "Unexpected error");

export default function ManagerUsersPage() {
  type SortField = SortableField<IAMUser>;
  const deleteConfirmation = useConfirmActionDialog();
  const { locale, t } = useManagerText(managerIamUsersZhMessages);

  const {
    selectedS3AccountType,
    selectedS3AccountName,
    accountIdForApi,
    requiresS3AccountSelection,
    accessMode,
    managerPrivateAccessEnabled,
  } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";
  const {
    error,
    items: users,
    load,
    loadRelated,
    loading,
    setError,
    setItems: setUsers,
    setLoading,
  } = useManagerIamCollection(listIamUsers);
  const {
    inlineDraftMode,
    inlineDraftName,
    inlineDrafts,
    inlinePolicyText,
    selectedInlineDraftName,
    showInlinePolicyOptions,
    setInlineDraftName,
    setInlinePolicyText,
    setShowInlinePolicyOptions,
    handleAddInlineDraft,
    handleClearInlineDrafts,
    handleCreateInlineDraft,
    handleRemoveInlineDraft,
    handleSelectInlineDraft,
    resetInlinePolicyDraftEditor,
  } = useInlinePolicyDraftEditor(setError);
  const [advancedName, setAdvancedName] = useState("");
  const [advancedValidationAttempted, setAdvancedValidationAttempted] = useState(false);
  const [createKey, setCreateKey] = useState(true);
  const [createdKey, setCreatedKey] = useState<AccessKey | null>(null);
  const [createdForUser, setCreatedForUser] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<I18nMessage | null>(null);
  const [groups, setGroups] = useState<IAMGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [policies, setPolicies] = useState<IamPolicy[]>([]);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [policySearch, setPolicySearch] = useState("");
  const [showPrivateAccessModal, setShowPrivateAccessModal] = useState(false);
  const [filter, setFilter] = useState("");
  const groupOptionsId = useId();
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [showPolicyOptions, setShowPolicyOptions] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedInitialSignature, setAdvancedInitialSignature] = useState(() =>
    stableSignature({
      advancedName: "",
      createKey: true,
      selectedGroups: [],
      selectedPolicies: [],
      inlineDrafts: [],
      inlineDraftName: "",
      inlinePolicyText: "",
    })
  );
  const [sort, setSort] = useState<{ field: SortField; direction: "asc" | "desc" }>({
    field: "name",
    direction: "asc",
  });

  const loadGroups = useCallback(
    (accountId: S3AccountSelector) =>
      loadRelated(accountId, listIamGroups, setGroups),
    [loadRelated],
  );

  const loadPolicies = useCallback(
    (accountId: S3AccountSelector) =>
      loadRelated(accountId, listIamPolicies, setPolicies),
    [loadRelated],
  );

  useEffect(() => {
    if (needsS3AccountSelection) {
      setUsers([]);
      setGroups([]);
      setPolicies([]);
      setLoading(false);
      return;
    }
    load(accountIdForApi);
    loadGroups(accountIdForApi);
    loadPolicies(accountIdForApi);
    setSelectedGroups([]);
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowGroupOptions(false);
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
  }, [
    accountIdForApi,
    accessMode,
    load,
    loadGroups,
    loadPolicies,
    needsS3AccountSelection,
    resetInlinePolicyDraftEditor,
    setLoading,
    setUsers,
  ]);

  useEffect(() => {
    setSelectedPolicies((prev) => prev.filter((arn) => policies.some((p) => p.arn === arn)));
  }, [policies]);

  useEffect(() => {
    if (selectedGroups.length > 0) {
      setShowGroupOptions(true);
    }
  }, [selectedGroups.length]);

  useEffect(() => {
    if (selectedPolicies.length > 0) {
      setShowPolicyOptions(true);
    }
  }, [selectedPolicies.length]);

  const filteredUsers = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const items = query
      ? users.filter((u) => u.name.toLowerCase().includes(query) || (u.arn ?? "").toLowerCase().includes(query))
      : users;
    const sorted = [...items].sort((a, b) => {
      return compareByNullableField(a, b, sort.field, sort.direction);
    });
    return sorted;
  }, [users, filter, sort]);

  const advancedCurrentSignature = useMemo(
    () =>
      stableSignature({
        advancedName,
        createKey,
        selectedGroups,
        selectedPolicies,
        inlineDrafts,
        inlineDraftName,
        inlinePolicyText,
      }),
    [
      advancedName,
      createKey,
      inlineDraftName,
      inlineDrafts,
      inlinePolicyText,
      selectedGroups,
      selectedPolicies,
    ]
  );
  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: filteredUsers.length,
  });

  const toggleSort = (field: SortField) => {
    setSort((current) => nextSortState(current, field, "desc"));
  };

  const handleAdvancedCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (needsS3AccountSelection || busy !== null) return;
    setAdvancedValidationAttempted(true);
    if (!advancedName.trim()) {
      focusFirstInvalidField(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(advancedName);
    setError(null);
    setActionMessage(null);
    setCreatedKey(null);
    setCreatedForUser(null);
    try {
      const created = await createIamUser(
        accountIdForApi,
        advancedName.trim(),
        createKey,
        selectedGroups,
        selectedPolicies,
        inlineDrafts
      );
      setAdvancedName("");
      setSelectedGroups([]);
      setSelectedPolicies([]);
      setPolicySearch("");
      setShowGroupOptions(false);
      setShowPolicyOptions(false);
      resetInlinePolicyDraftEditor();
      setShowAdvancedModal(false);
      if (createKey && created.access_key) {
        setCreatedKey(created.access_key);
        setCreatedForUser(created.name);
      }
      setActionMessage("User created");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async (name: string) => {
    if (needsS3AccountSelection) return;
    setBusy(name);
    setError(null);
    setActionMessage(null);
    try {
      await deleteIamUser(accountIdForApi, name);
      setActionMessage("User deleted");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = (name: string) => {
    if (needsS3AccountSelection) return;
    deleteConfirmation.requestConfirmation({
      title: t("Delete IAM user?"),
      description: t("Permanently remove this IAM user from the selected account."),
      confirmLabel: t("Delete user"),
      details: [{ label: t("IAM user"), value: name }],
      impacts: [t("Credentials and permissions attached to this user will no longer grant access.")],
      onConfirm: () => deleteUser(name),
    });
  };

  const openAdvancedModal = () => {
    setError(null);
    setAdvancedValidationAttempted(false);
    setAdvancedName("");
    setCreateKey(true);
    setSelectedGroups([]);
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowGroupOptions(false);
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
    setShowAdvancedModal(true);
    setAdvancedInitialSignature(
      stableSignature({
        advancedName: "",
        createKey: true,
        selectedGroups: [],
        selectedPolicies: [],
        inlineDrafts: [],
        inlineDraftName: "",
        inlinePolicyText: "",
      })
    );
  };

  const closeAdvancedModal = () => {
    setShowAdvancedModal(false);
    setAdvancedName("");
    setCreateKey(true);
    setSelectedGroups([]);
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowGroupOptions(false);
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
  };

  const advancedCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: showAdvancedModal && advancedCurrentSignature !== advancedInitialSignature,
    onClose: closeAdvancedModal,
    disabled: busy !== null,
    title: t("Discard changes?"),
    description: t("You have unapplied changes. Closing this dialog will discard them."),
    cancelLabel: t("Keep editing"),
    confirmLabel: t("Discard changes"),
  });

  const userTableColumns: Array<DataTableColumn<IAMUser, SortField>> = [
    {
      id: "name",
      label: t("Name"),
      field: "name",
      primary: true,
      mobileRole: "primary",
      render: (user) => {
        const lacksGroupOrPolicy =
          (user.groups?.length ?? 0) === 0 &&
          (user.policies?.length ?? 0) === 0 &&
          (user.inline_policies?.length ?? 0) === 0;
        const lacksKeys = user.has_keys === false;
        const showWarning = lacksGroupOrPolicy || lacksKeys;
        const warningTitle = lacksGroupOrPolicy && lacksKeys
          ? t("No groups/policies or access keys assigned")
          : lacksGroupOrPolicy
            ? t("No groups or policies assigned")
            : t("No access keys registered");

        return (
          <div className="flex items-center gap-2">
            <span>{user.name}</span>
            {user.is_private_access_managed && (
              <ListBadge
                tone="primary"
                title={t("Managed private access identity")}
              >
                {t("Private access")}
              </ListBadge>
            )}
            {showWarning && (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100"
                title={warningTitle}
                role="img"
                aria-label={t("Warning: user might lack necessary permissions")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 4 3 20h18L12 4z" />
                  <path d="M12 9v5" />
                  <path d="M12 17h.01" strokeWidth={2.4} />
                </svg>
              </span>
            )}
          </div>
        );
      },
    },
    { id: "arn", label: "ARN", field: "arn", render: (user) => user.arn ?? "-" },
    {
      id: "groups",
      label: t("Groups"),
      cellClassName: "ui-table-wide",
      render: (user) =>
        user.groups && user.groups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.groups.map((group) => (
              <ListBadge
                key={group}
                tone="neutral"
              >
                {group}
              </ListBadge>
            ))}
          </div>
        ) : (
          <span className="ui-caption text-slate-500 dark:text-slate-400">-</span>
        ),
    },
    {
      id: "policies",
      label: t("Policies"),
      cellClassName: "ui-table-wide",
      render: (user) =>
        user.policies && user.policies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.policies.map((policy) => (
              <ListBadge
                key={policy}
                tone="neutral"
                title={policy}
              >
                {policy.split("/").pop()}
              </ListBadge>
            ))}
          </div>
        ) : (
          <span className="ui-caption text-slate-500 dark:text-slate-400">-</span>
        ),
    },
    {
      id: "actions",
      label: t("Actions"),
      align: "right",
      mobileRole: "actions",
      render: (user) => (
        <ListActions>
          <ListActionLink to={`/manager/users/${encodeURIComponent(user.name)}/keys`}>
            {t("Keys")}
          </ListActionLink>
          <ListActionLink to={`/manager/users/${encodeURIComponent(user.name)}/policies`}>
            {t("Policies")}
          </ListActionLink>
          <ListActionButton
            onClick={() => handleDelete(user.name)}
             variant="danger"
            disabled={busy === user.name || user.is_private_access_managed}
            title={user.is_private_access_managed ? t("Delete the linked private connection instead") : undefined}
          >
            {busy === user.name ? t("Deleting...") : t("Delete")}
          </ListActionButton>
        </ListActions>
      ),
    },
  ];

  return (
    <div className={workflowPageHostClass(showAdvancedModal)}>
      <PageHeader actionPresentation="listing"
        title={t("Users")}
        description={t("Create/delete via the account root credentials. Optionally generate an access key on creation.")}
        breadcrumbs={localizedManagerPageBreadcrumbs("users", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        actions={!needsS3AccountSelection && !isS3User
          ? [
              {
                label: t("Create user"),
                onClick: openAdvancedModal,
              },
              ...(managerPrivateAccessEnabled
                ? [{ label: t("Create my private access"), onClick: () => setShowPrivateAccessModal(true), variant: "primary" as const }]
                : []),
            ]
          : []}
      />

      {error && <PageBanner tone="error">{localizeManagerIamUsersError(locale, error)}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}

      {createdKey && createdForUser && (
        <OneTimeSecretPanel
          title={managerIamUserKeyCreatedTitle(locale, createdForUser)}
          description={t("Copy these values now; the secret will only be shown once.")}
          values={[
            { label: t("Access key"), value: createdKey.access_key_id, copyLabel: t("Copy") },
            {
              label: t("Secret key"),
              value: createdKey.secret_access_key ?? t("Not provided"),
              copyLabel: createdKey.secret_access_key ? t("Copy") : undefined,
            },
          ]}
          copyFeedback={{
            copied: t("Copied to clipboard."),
            failed: t("Unable to copy. Select and copy this value manually."),
          }}
          actions={
            <ListActionLink
              to={`/manager/users/${encodeURIComponent(createdForUser)}/keys`}
            >
              {t("Manage keys")}
            </ListActionLink>
          }
        />
      )}

      {needsS3AccountSelection ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account before managing IAM users")}
          description={t("Users are created within an execution context. Choose an account to list identities, generate keys, and attach policies.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : isS3User ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("IAM users are unavailable for managed S3 user contexts")}
          description={t("Switch to an RGW account or S3 connection context to manage account-level IAM identities.")}
          primaryAction={{ label: t("Open buckets"), to: "/manager/buckets" }}
          tone="warning"
        />
      ) : (
        <ListPageSection
          variant="page"
          mobileSort={(
            <TableSortControls
              columns={userTableColumns}
              sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }}
              labels={{
                sortBy: t("Sort by"),
                direction: t("Direction"),
                ascending: t("Ascending"),
                descending: t("Descending"),
              }}
            />
          )}
            title={t("Users")}
            countLabel={managerIamUserResultCount(locale, filteredUsers.length)}
            search={
              <ManagerToolbarSearch
                value={filter}
                onChange={setFilter}
                placeholder={t("Search by name or ARN")}
                className="w-full sm:w-64 md:w-72"
              />
            }
        >
          <DataTableShell
            columns={userTableColumns}
            rows={filteredUsers}
            rowKey={(user) => user.name}
            status={tableStatus}
            loadingMessage={t("Loading users...")}
            errorMessage={t("Unable to load users.")}
            emptyMessage={t("No users.")}
            responsiveCards
            sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }}
            tableLayout="fixed"
          />
        </ListPageSection>
      )}

      {showAdvancedModal && (
        <WorkflowPage
          title={t("Create IAM user")}
          description={t("Create the identity, attach managed or inline policies, and optionally generate its first access key.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("users", locale, { label: t("Create") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to users")}
          onBack={advancedCloseGuard.requestClose}
          width="standard"
          contentVariant="plain"
        >
          {error && <PageBanner tone="error">{localizeManagerIamUsersError(locale, error)}</PageBanner>}
          <SettingsForm label={t("Create IAM user")} onSubmit={handleAdvancedCreate}
            busy={busy !== null} disabled={needsS3AccountSelection} onCancel={advancedCloseGuard.requestClose}
            submitLabel={t("Create user")} busyLabel={t("Creating...")}>
            <SettingsSection title={t("Identity")} presentation="compact">
              <div className="settings-fields">
                <UiInput label={t("User name")} required value={advancedName} onChange={(event) => setAdvancedName(event.target.value)}
                  placeholder={t("User name")} error={advancedValidationAttempted && !advancedName.trim() ? t("User name is required.") : undefined} />
                <UiCheckboxField checked={createKey} onChange={(event) => setCreateKey(event.target.checked)} className="settings-choice settings-body">
                  {t("Auto-generate an access key (shown only once)")}
                </UiCheckboxField>
              </div>
            </SettingsSection>
            <SettingsSection title={t("Add to groups (optional)")} description={t("Launch permissions by linking groups before creation.")} presentation="compact">
              <div className="settings-stack">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedGroups.length > 0 && <span className="settings-description">{managerIamSelectedCount(locale, selectedGroups.length)}</span>}
                  <SettingsButton variant="secondary" onClick={() => setShowGroupOptions((prev) => !prev)}
                    aria-expanded={showGroupOptions} aria-controls={groupOptionsId}>
                    {showGroupOptions ? t("Hide") : t("Show")}
                  </SettingsButton>
                </div>
                <div id={groupOptionsId} hidden={!showGroupOptions} className={showGroupOptions ? "settings-fields" : undefined}>
                  {groups.length === 0 && <p className="settings-description">{t("No groups available.")}</p>}
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    {groups.map((group) => (
                      <UiCheckboxField key={group.name} checked={selectedGroups.includes(group.name)}
                        onChange={(event) => setSelectedGroups((current) => event.target.checked
                          ? [...current, group.name] : current.filter((name) => name !== group.name))}
                        className="settings-choice min-w-0 settings-body">
                        <span className="min-w-0 [overflow-wrap:anywhere]">{group.name}</span>
                      </UiCheckboxField>
                    ))}
                  </div>
                </div>
              </div>
            </SettingsSection>
            <ManagedPolicySelectionPanel
              title={t("Attach policies (optional)")}
              description={t("Bind JSON policies now or skip and attach later.")}
              emptyMessage={t("No policies available. Create them in the Policies tab.")}
              footer={t("Policies must be created first in the Policies tab.")}
              policies={policies}
              selectedPolicyArns={selectedPolicies}
              search={policySearch}
              expanded={showPolicyOptions}
              onSearchChange={setPolicySearch}
              onExpandedChange={setShowPolicyOptions}
              onSelectionChange={setSelectedPolicies}
            />
            <InlinePolicyDraftEditor
              drafts={inlineDrafts}
              selectedDraftName={selectedInlineDraftName}
              draftName={inlineDraftName}
              draftText={inlinePolicyText}
              entityLabel="user"
              mode={inlineDraftMode}
              expanded={showInlinePolicyOptions}
              onCreateDraft={handleCreateInlineDraft}
              onSelectDraft={handleSelectInlineDraft}
              onDraftNameChange={(value) => {
                setInlineDraftName(value);
                setError(null);
              }}
              onDraftTextChange={(value) => {
                setInlinePolicyText(value);
                setError(null);
              }}
              onSaveDraft={handleAddInlineDraft}
              onRemoveDraft={handleRemoveInlineDraft}
              onClearDrafts={handleClearInlineDrafts}
              onInsertTemplate={() => setInlinePolicyText(DEFAULT_INLINE_POLICY_TEXT)}
              onToggleExpanded={() => setShowInlinePolicyOptions((prev) => !prev)}
            />
          </SettingsForm>
          {advancedCloseGuard.confirmationDialog}
        </WorkflowPage>
      )}

      {showPrivateAccessModal && (
        <CreateManagedPrivateAccessModal
          variant="iam"
          accountId={accountIdForApi}
          contextName={selectedS3AccountName}
          groups={groups}
          policies={policies}
          onClose={() => setShowPrivateAccessModal(false)}
          onCreated={(name) => {
            setActionMessage(managerIamPrivateConnectionCreatedMessage(name));
            setError(null);
          }}
        />
      )}

      {deleteConfirmation.confirmationDialog}

    </div>
  );
}
