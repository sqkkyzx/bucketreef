/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ListActions, ListBadge, ListActionButton, ListActionLink } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { S3AccountSelector } from "../../api/accountParams";
import {
  IAMRole,
  attachRolePolicy,
  createIamRole,
  deleteIamRole,
  getIamRole,
  listIamRoles,
  updateIamRole,
} from "../../api/managerIamRoles";
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
import ManagerRoleFormFields from "./ManagerRoleFormFields";
import { parseIamRolePolicy } from "./iamRoleForm";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerIamError,
  managerIamResultCount,
  managerIamRolesPoliciesZhMessages,
} from "./managerIamRolesPoliciesMessages";

const DEFAULT_ASSUME_ROLE_DOCUMENT = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: "*" },
        Action: "sts:AssumeRole",
      },
    ],
  },
  null,
  2
);
const DEFAULT_ROLE_PATH = "/";

const extractError = (err: unknown): string => extractApiError(err, "Unexpected error");

export default function ManagerRolesPage() {
  const { locale, t } = useManagerText(managerIamRolesPoliciesZhMessages);
  const deleteConfirmation = useConfirmActionDialog();
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";
  const [roleFilter, setRoleFilter] = useState("");
  const {
    error,
    items: roles,
    load,
    loadRelated,
    loading,
    setError,
    setItems: setRoles,
    setLoading,
  } = useManagerIamCollection(listIamRoles);
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
  const [advancedPath, setAdvancedPath] = useState(DEFAULT_ROLE_PATH);
  const [assumeRolePolicyText, setAssumeRolePolicyText] = useState(DEFAULT_ASSUME_ROLE_DOCUMENT);
  const [creating, setCreating] = useState(false);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);
  const [policies, setPolicies] = useState<IamPolicy[]>([]);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [policySearch, setPolicySearch] = useState("");
  const [showPolicyOptions, setShowPolicyOptions] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [advancedInitialSignature, setAdvancedInitialSignature] = useState(() =>
    stableSignature({
      advancedName: "",
      advancedPath: DEFAULT_ROLE_PATH,
      assumeRolePolicyText: DEFAULT_ASSUME_ROLE_DOCUMENT,
      selectedPolicies: [],
      inlineDrafts: [],
      inlineDraftName: "",
      inlinePolicyText: "",
    })
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState<IAMRole | null>(null);
  const [editPath, setEditPath] = useState(DEFAULT_ROLE_PATH);
  const [editAssumeRolePolicyText, setEditAssumeRolePolicyText] = useState(DEFAULT_ASSUME_ROLE_DOCUMENT);
  const [editInitialSignature, setEditInitialSignature] = useState(() =>
    stableSignature({ editPath: DEFAULT_ROLE_PATH, editAssumeRolePolicyText: DEFAULT_ASSUME_ROLE_DOCUMENT })
  );
  const [loadingRoleDetails, setLoadingRoleDetails] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editValidationAttempted, setEditValidationAttempted] = useState(false);
  const advancedPolicy = parseIamRolePolicy(assumeRolePolicyText);
  const editPolicy = parseIamRolePolicy(editAssumeRolePolicyText);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadPolicies = useCallback(
    (accountId: S3AccountSelector) =>
      loadRelated(accountId, listIamPolicies, setPolicies),
    [loadRelated],
  );

  useEffect(() => {
    if (needsS3AccountSelection) {
      setRoles([]);
      setPolicies([]);
      setLoading(false);
      return;
    }
    load(accountIdForApi);
    loadPolicies(accountIdForApi);
    resetInlinePolicyDraftEditor();
  }, [accountIdForApi, needsS3AccountSelection, accessMode, load, loadPolicies, resetInlinePolicyDraftEditor, setLoading, setRoles]);

  useEffect(() => {
    if (selectedPolicies.length > 0) {
      setShowPolicyOptions(true);
    }
  }, [selectedPolicies.length]);

  const advancedCurrentSignature = useMemo(
    () =>
      stableSignature({
        advancedName,
        advancedPath,
        assumeRolePolicyText,
        selectedPolicies,
        inlineDrafts,
        inlineDraftName,
        inlinePolicyText,
      }),
    [
      advancedName,
      advancedPath,
      assumeRolePolicyText,
      inlineDraftName,
      inlineDrafts,
      inlinePolicyText,
      selectedPolicies,
    ]
  );
  const editCurrentSignature = useMemo(
    () => stableSignature({ editPath, editAssumeRolePolicyText }),
    [editAssumeRolePolicyText, editPath]
  );

  const handleAdvancedCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (needsS3AccountSelection || creating) return;
    setAdvancedValidationAttempted(true);
    if (!advancedName.trim() || advancedPolicy.error) {
      focusFirstInvalidField(e.currentTarget as HTMLFormElement);
      return;
    }
    const trimmedPath = advancedPath.trim();
    setCreating(true);
    setError(null);
    setActionMessage(null);
    try {
      const roleName = advancedName.trim();
      await createIamRole(accountIdForApi, {
        name: roleName,
        path: trimmedPath === "" ? undefined : trimmedPath,
        assume_role_policy_document: advancedPolicy.document,
        inline_policies: inlineDrafts,
      });
      if (selectedPolicies.length > 0) {
        for (const arn of selectedPolicies) {
          const policy = policies.find((p) => p.arn === arn);
          if (policy) {
            await attachRolePolicy(accountIdForApi, roleName, policy);
          }
        }
      }
      setAdvancedName("");
      setAdvancedPath(DEFAULT_ROLE_PATH);
      setAssumeRolePolicyText(DEFAULT_ASSUME_ROLE_DOCUMENT);
      setSelectedPolicies([]);
      setPolicySearch("");
      setShowPolicyOptions(false);
      resetInlinePolicyDraftEditor();
      setShowAdvancedModal(false);
      setActionMessage("Role created");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setCreating(false);
    }
  };

  const deleteRole = async (name: string) => {
    if (needsS3AccountSelection) return;
    setDeletingRole(name);
    setError(null);
    setActionMessage(null);
    try {
      await deleteIamRole(accountIdForApi, name);
      setActionMessage("Role deleted");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setDeletingRole(null);
    }
  };

  const handleDelete = (name: string) => {
    if (needsS3AccountSelection) return;
    deleteConfirmation.requestConfirmation({
      title: t("Delete IAM role?"),
      description: t("Permanently remove this IAM role from the selected account."),
      confirmLabel: t("Delete role"),
      details: [{ label: t("IAM role"), value: name }],
      impacts: [t("Workloads that assume this role will no longer receive its permissions.")],
      onConfirm: () => deleteRole(name),
    });
  };

  const openAdvancedModal = () => {
    setError(null);
    setAdvancedValidationAttempted(false);
    setAdvancedName("");
    setAdvancedPath(DEFAULT_ROLE_PATH);
    setAssumeRolePolicyText(DEFAULT_ASSUME_ROLE_DOCUMENT);
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
    setShowAdvancedModal(true);
    setAdvancedInitialSignature(
      stableSignature({
        advancedName: "",
        advancedPath: DEFAULT_ROLE_PATH,
        assumeRolePolicyText: DEFAULT_ASSUME_ROLE_DOCUMENT,
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
    setAdvancedPath(DEFAULT_ROLE_PATH);
    setAssumeRolePolicyText(DEFAULT_ASSUME_ROLE_DOCUMENT);
    setSelectedPolicies([]);
    setPolicySearch("");
    setShowPolicyOptions(false);
    resetInlinePolicyDraftEditor();
  };

  const formatAssumePolicyText = (document: unknown) => {
    if (!document) return DEFAULT_ASSUME_ROLE_DOCUMENT;
    if (typeof document === "string") {
      try {
        return JSON.stringify(JSON.parse(document), null, 2);
      } catch {
        return document;
      }
    }
    try {
      return JSON.stringify(document, null, 2);
    } catch {
      return DEFAULT_ASSUME_ROLE_DOCUMENT;
    }
  };

  const openEditModal = async (roleName: string) => {
    if (needsS3AccountSelection) return;
    setShowEditModal(true);
    setEditValidationAttempted(false);
    setEditingRole({ name: roleName });
    setLoadingRoleDetails(true);
    setError(null);
    setActionMessage(null);
    try {
      const role = await getIamRole(accountIdForApi, roleName);
      const nextEditPath = role.path ?? DEFAULT_ROLE_PATH;
      const nextAssumeRolePolicyText = formatAssumePolicyText(role.assume_role_policy_document);
      setEditingRole(role);
      setEditPath(nextEditPath);
      setEditAssumeRolePolicyText(nextAssumeRolePolicyText);
      setEditInitialSignature(stableSignature({ editPath: nextEditPath, editAssumeRolePolicyText: nextAssumeRolePolicyText }));
    } catch (err) {
      setError(extractError(err));
      setShowEditModal(false);
      setEditingRole(null);
    } finally {
      setLoadingRoleDetails(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRole(null);
    setEditAssumeRolePolicyText(DEFAULT_ASSUME_ROLE_DOCUMENT);
    setEditPath(DEFAULT_ROLE_PATH);
    setEditInitialSignature(stableSignature({ editPath: DEFAULT_ROLE_PATH, editAssumeRolePolicyText: DEFAULT_ASSUME_ROLE_DOCUMENT }));
  };

  const advancedCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: showAdvancedModal && advancedCurrentSignature !== advancedInitialSignature,
    onClose: closeAdvancedModal,
    disabled: creating,
    title: t("Discard changes?"),
    description: t("You have unapplied changes. Closing this dialog will discard them."),
    cancelLabel: t("Keep editing"),
    confirmLabel: t("Discard changes"),
  });

  const editCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: showEditModal && !loadingRoleDetails && editCurrentSignature !== editInitialSignature,
    onClose: closeEditModal,
    disabled: savingEdit,
    title: t("Discard changes?"),
    description: t("You have unapplied changes. Closing this dialog will discard them."),
    cancelLabel: t("Keep editing"),
    confirmLabel: t("Discard changes"),
  });

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsS3AccountSelection || !editingRole || loadingRoleDetails || savingEdit) return;
    setEditValidationAttempted(true);
    if (editPolicy.error) {
      focusFirstInvalidField(e.currentTarget as HTMLFormElement);
      return;
    }
    setSavingEdit(true);
    setError(null);
    setActionMessage(null);
    try {
      await updateIamRole(accountIdForApi, editingRole.name, {
        assume_role_policy_document: editPolicy.document,
      });
      setActionMessage("Role updated");
      closeEditModal();
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredRoles = roles.filter((role) => {
    const needle = roleFilter.trim().toLowerCase();
    if (!needle) return true;
    return (
      role.name.toLowerCase().includes(needle) ||
      (role.path ?? "").toLowerCase().includes(needle) ||
      (role.arn ?? "").toLowerCase().includes(needle)
    );
  });
  const filteredTableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: filteredRoles.length,
  });
  const roleTableColumns: Array<DataTableColumn<IAMRole>> = [
    { id: "name", label: t("Name"), primary: true, mobileRole: "primary", render: (role) => role.name },
    { id: "path", label: t("Path"), render: (role) => role.path ?? "-" },
    { id: "arn", label: "ARN", render: (role) => role.arn ?? "-" },
    {
      id: "policies",
      label: t("Policies"),
      cellClassName: "ui-table-wide",
      render: (role) =>
        role.policies && role.policies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {role.policies.map((policy) => (
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
      render: (role) => (
        <ListActions>
          <ListActionButton
            onClick={() => openEditModal(role.name)}
            disabled={loadingRoleDetails && editingRole?.name === role.name}
          >
            {t("Edit")}
          </ListActionButton>
          <ListActionLink to={`/manager/roles/${encodeURIComponent(role.name)}/policies`}>
            {t("Policies")}
          </ListActionLink>
          <ListActionButton
            onClick={() => handleDelete(role.name)}
             variant="danger"
            disabled={deletingRole === role.name}
          >
            {deletingRole === role.name ? t("Deleting...") : t("Delete")}
          </ListActionButton>
        </ListActions>
      ),
    },
  ];

  return (
    <div className={workflowPageHostClass(showAdvancedModal || showEditModal)}>
      <PageHeader actionPresentation="listing"
        title={t("IAM Roles")}
        description={t("Manage roles using the account root keys.")}
        breadcrumbs={localizedManagerPageBreadcrumbs("roles", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        actions={
          !needsS3AccountSelection && !isS3User
            ? [
                {
                  label: t("Create role"),
                  onClick: openAdvancedModal,
                },
              ]
            : []
        }
      />

      {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}

      {needsS3AccountSelection ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account before managing IAM roles")}
          description={t("Roles are defined per execution context. Choose an account to list trust relationships and attached policies.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : isS3User ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("IAM roles are unavailable for managed S3 user contexts")}
          description={t("Switch to an RGW account or S3 connection context to manage role trust policies and attached permissions.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : (
        <ListPageSection variant="page"
            title={t("Roles")}
            countLabel={managerIamResultCount(locale, filteredRoles.length)}
            search={
              <ManagerToolbarSearch
                value={roleFilter}
                onChange={setRoleFilter}
                placeholder={t("Search by name, path, or ARN")}
              />
            }
        >
          <DataTableShell
            columns={roleTableColumns}
            rows={filteredRoles}
            rowKey={(role) => role.name}
            status={filteredTableStatus}
            loadingMessage={t("Loading roles...")}
            errorMessage={t("Unable to load roles.")}
            emptyMessage={t("No roles.")}
            responsiveCards
            tableLayout="fixed"
          />
        </ListPageSection>
      )}

      {showAdvancedModal && (
        <WorkflowPage
          title={t("Create IAM role")}
          description={t("Configure the trust policy, path and attached policies without compressing the workflow into an overlay.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("roles", locale, { label: t("Create") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to roles")}
          onBack={advancedCloseGuard.requestClose}
          width="standard"
          contentVariant="plain"
        >
          {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}
          <SettingsForm label={t("Create IAM role")} onSubmit={handleAdvancedCreate}
            busy={creating} disabled={needsS3AccountSelection} onCancel={advancedCloseGuard.requestClose}
            submitLabel={t("Create role")} busyLabel={t("Creating...")}>
            <ManagerRoleFormFields name={advancedName} path={advancedPath} policy={assumeRolePolicyText}
              onNameChange={setAdvancedName} onPathChange={setAdvancedPath} onPolicyChange={setAssumeRolePolicyText}
              nameError={advancedValidationAttempted && !advancedName.trim() ? "Role name is required." : undefined}
              policyError={advancedValidationAttempted ? advancedPolicy.error : undefined} />
            <ManagedPolicySelectionPanel
              title="Attach policies"
              description="Select managed policies to grant permissions immediately."
              emptyMessage="No policies available. Create them first."
              footer="Policies can also be attached later from the role page."
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
              entityLabel="role"
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
      {showEditModal && (
        <WorkflowPage
          title={editingRole
            ? locale === "zh" ? `编辑 IAM 角色：${editingRole.name}` : `Edit IAM role: ${editingRole.name}`
            : t("Edit IAM role")}
          description={t("Review the immutable identity and update the role trust policy in a dedicated page.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("roles", locale, { label: t("Edit") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to roles")}
          onBack={editCloseGuard.requestClose}
          width="standard"
          contentVariant="plain"
        >
          {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}
          {loadingRoleDetails ? (
            <p className="ui-body text-slate-500 dark:text-slate-300">{t("Loading role details...")}</p>
          ) : (
            <SettingsForm label={t("Edit IAM role")} onSubmit={handleSaveEdit} busy={savingEdit}
              disabled={needsS3AccountSelection || !editingRole} onCancel={editCloseGuard.requestClose}
              submitLabel={t("Save changes")} busyLabel={t("Saving...")}>
              <ManagerRoleFormFields editing name={editingRole?.name ?? ""} path={editPath} policy={editAssumeRolePolicyText}
                onPolicyChange={setEditAssumeRolePolicyText} policyError={editValidationAttempted ? editPolicy.error : undefined} />
            </SettingsForm>
          )}
          {editCloseGuard.confirmationDialog}
        </WorkflowPage>
      )}
      {deleteConfirmation.confirmationDialog}
    </div>
  );
}
