/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListActions, ListBadge, ListActionLink, ListActionButton } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { S3AccountSelector } from "../../api/accountParams";
import { IAMGroup, attachGroupPolicy, createIamGroup, deleteIamGroup, listIamGroups } from "../../api/managerIamGroups";
import { IamPolicy, listIamPolicies } from "../../api/managerIamPolicies";
import ListPageSection from "../../components/list/ListPageSection";
import PageEmptyState from "../../components/PageEmptyState";
import PageHeader from "../../components/PageHeader";
import PageBanner from "../../components/PageBanner";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import WorkflowPage, { workflowPageHostClass } from "../../components/WorkflowPage";

import { extractApiError } from "../../utils/apiError";
import { stableSignature } from "../../utils/stableSignature";
import { DEFAULT_INLINE_POLICY_TEXT } from "./inlinePolicyTemplate";
import InlinePolicyDraftEditor from "./InlinePolicyDraftEditor";
import ManagedPolicySelectionPanel from "./ManagedPolicySelectionPanel";
import ManagerToolbarSearch from "./ManagerToolbarSearch";
import { useInlinePolicyDraftEditor } from "./useInlinePolicyDraftEditor";
import { useManagerIamCollection } from "./useManagerIamCollection";
import SettingsForm from "../../components/settings/SettingsForm";
import { focusFirstInvalidField } from "../../utils/focusFirstInvalidField";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerGroupsError,
  managerGroupsResultCount,
  managerGroupsZhMessages,
} from "./managerGroupsMessages";

const extractError = (err: unknown): string => extractApiError(err, "Unexpected error");

export default function ManagerGroupsPage() {
  const { locale, t } = useManagerText(managerGroupsZhMessages);
  const deleteConfirmation = useConfirmActionDialog();
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, selectedS3AccountId, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";
  const [groupFilter, setGroupFilter] = useState("");
  const {
    error,
    items: groups,
    load,
    loadRelated,
    loading,
    setError,
    setItems: setGroups,
    setLoading,
  } = useManagerIamCollection(listIamGroups);
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
  const [busy, setBusy] = useState<string | null>(null);
  const [policies, setPolicies] = useState<IamPolicy[]>([]);
  const [policySearch, setPolicySearch] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [showPolicyOptions, setShowPolicyOptions] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [advancedInitialSignature, setAdvancedInitialSignature] = useState(() =>
    stableSignature({
      advancedName: "",
      selectedPolicies: [],
      inlineDrafts: [],
      inlineDraftName: "",
      inlinePolicyText: "",
    })
  );

  const loadPolicies = useCallback(
    (accountId: S3AccountSelector) =>
      loadRelated(accountId, listIamPolicies, setPolicies),
    [loadRelated],
  );

  useEffect(() => {
    if (needsS3AccountSelection) {
      setGroups([]);
      setPolicies([]);
      setLoading(false);
      return;
    }
    load(accountIdForApi);
    loadPolicies(accountIdForApi);
    resetInlinePolicyDraftEditor();
  }, [accountIdForApi, needsS3AccountSelection, accessMode, load, loadPolicies, resetInlinePolicyDraftEditor, setGroups, setLoading]);

  useEffect(() => {
    if (selectedPolicies.length > 0) {
      setShowPolicyOptions(true);
    }
  }, [selectedPolicies.length]);

  const advancedCurrentSignature = useMemo(
    () =>
      stableSignature({
        advancedName,
        selectedPolicies,
        inlineDrafts,
        inlineDraftName,
        inlinePolicyText,
      }),
    [advancedName, inlineDraftName, inlineDrafts, inlinePolicyText, selectedPolicies]
  );

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
    try {
      const groupName = advancedName.trim();
      await createIamGroup(accountIdForApi, groupName, inlineDrafts);
      if (selectedPolicies.length > 0) {
        for (const arn of selectedPolicies) {
          const policy = policies.find((p) => p.arn === arn);
          if (policy) {
            await attachGroupPolicy(accountIdForApi, groupName, policy);
          }
        }
      }
      setAdvancedName("");
      setSelectedPolicies([]);
      setPolicySearch("");
      setShowPolicyOptions(false);
      resetInlinePolicyDraftEditor();
      setShowAdvancedModal(false);
      setActionMessage("Group created");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteGroup = async (name: string) => {
    if (needsS3AccountSelection) return;
    setBusy(name);
    setError(null);
    setActionMessage(null);
    try {
      await deleteIamGroup(accountIdForApi, name);
      setActionMessage("Group deleted");
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
      title: t("Delete IAM group?"),
      description: t("Permanently remove this IAM group from the selected account."),
      confirmLabel: t("Delete group"),
      details: [{ label: t("IAM group"), value: name }],
      impacts: [t("Members will lose permissions inherited only through this group.")],
      onConfirm: () => deleteGroup(name),
    });
  };

  const openAdvancedModal = () => {
    setError(null);
    setAdvancedValidationAttempted(false);
    setAdvancedName("");
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
    setShowAdvancedModal(true);
    setAdvancedInitialSignature(
      stableSignature({
        advancedName: "",
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
    setSelectedPolicies([]);
    setPolicySearch("");
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

  const filteredGroups = groups.filter((group) => {
    const needle = groupFilter.trim().toLowerCase();
    if (!needle) return true;
    return group.name.toLowerCase().includes(needle) || (group.arn ?? "").toLowerCase().includes(needle);
  });
  const filteredTableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: filteredGroups.length,
  });
  const groupTableColumns: Array<DataTableColumn<IAMGroup>> = [
    { id: "name", label: t("Name"), primary: true, mobileRole: "primary", render: (group) => group.name },
    { id: "arn", label: "ARN", render: (group) => group.arn ?? "-" },
    {
      id: "policies",
      label: t("Policies"),
      cellClassName: "ui-table-wide",
      render: (group) =>
        group.policies && group.policies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {group.policies.map((policy) => (
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
      render: (group) => (
        <ListActions>
          <ListActionLink to={`/manager/groups/${encodeURIComponent(group.name)}/users`}>
            {t("Members")}
          </ListActionLink>
          <ListActionLink to={`/manager/groups/${encodeURIComponent(group.name)}/policies`}>
            {t("Policies")}
          </ListActionLink>
          <ListActionButton
            onClick={() => handleDelete(group.name)}
             variant="danger"
            disabled={busy === group.name}
          >
            {busy === group.name ? t("Deleting...") : t("Delete")}
          </ListActionButton>
        </ListActions>
      ),
    },
  ];

  return (
    <div className={workflowPageHostClass(showAdvancedModal)}>
      <PageHeader actionPresentation="listing"
        title={t("IAM Groups")}
        description={t("Manage groups using the account root keys.")}
        breadcrumbs={localizedManagerPageBreadcrumbs("groups", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        actions={
          !needsS3AccountSelection && !isS3User
            ? [
                {
                  label: t("Create group"),
                  onClick: openAdvancedModal,
                },
              ]
            : []
        }
      />

      {error && <PageBanner tone="error">{localizeManagerGroupsError(locale, error)}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}

      {needsS3AccountSelection ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account before managing IAM groups")}
          description={t("Groups are scoped to an execution context. Choose an account to list membership containers and attach shared policies.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : isS3User ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("IAM groups are unavailable for managed S3 user contexts")}
          description={t("Switch to an RGW account or S3 connection context to manage account-level IAM groups.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : (
        <ListPageSection variant="page"
            title={t("Groups")}
            countLabel={managerGroupsResultCount(locale, filteredGroups.length)}
            search={
              <ManagerToolbarSearch
                value={groupFilter}
                onChange={setGroupFilter}
                placeholder={t("Search by name or ARN")}
              />
            }
        >
          <DataTableShell
            columns={groupTableColumns}
            rows={filteredGroups}
            rowKey={(group) => group.name}
            status={filteredTableStatus}
            loadingMessage={t("Loading groups...")}
            errorMessage={t("Unable to load groups.")}
            emptyMessage={t("No groups.")}
            responsiveCards
            tableLayout="fixed"
          />
        </ListPageSection>
      )}

      {showAdvancedModal && (
        <WorkflowPage
          title={t("Create IAM group")}
          description={t("Define the group and attach its managed and inline policies in one focused workflow.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("groups", locale, { label: t("Create") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to groups")}
          onBack={advancedCloseGuard.requestClose}
          width="standard"
          contentVariant="plain"
        >
          {error && <PageBanner tone="error">{localizeManagerGroupsError(locale, error)}</PageBanner>}
          <SettingsForm label={t("Create IAM group")} onSubmit={handleAdvancedCreate}
            busy={busy !== null} disabled={!selectedS3AccountId} onCancel={advancedCloseGuard.requestClose}
            submitLabel={t("Create group")} busyLabel={t("Creating...")}>
            <SettingsSection title={t("Identity")} presentation="compact">
              <div className="settings-fields">
                <UiInput label={t("Group name")} required value={advancedName} onChange={(event) => setAdvancedName(event.target.value)}
                  placeholder={t("Group name")} error={advancedValidationAttempted && !advancedName.trim() ? t("Group name is required.") : undefined} />
              </div>
            </SettingsSection>
            <ManagedPolicySelectionPanel
              title={t("Attach policies")}
              description={t("Select managed policies to link immediately.")}
              emptyMessage={t("No policies available. Create them first.")}
              footer={t("Policies can also be attached later from the group page.")}
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
              entityLabel="group"
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
      {deleteConfirmation.confirmationDialog}
    </div>
  );
}
