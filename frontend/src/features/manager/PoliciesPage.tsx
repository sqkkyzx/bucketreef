/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { IamPolicy, createIamPolicy, listIamPolicies } from "../../api/managerIamPolicies";
import ListPageSection from "../../components/list/ListPageSection";
import PageEmptyState from "../../components/PageEmptyState";
import PageHeader from "../../components/PageHeader";
import PageBanner from "../../components/PageBanner";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import WorkflowPage, { workflowPageHostClass } from "../../components/WorkflowPage";
import { extractApiError } from "../../utils/apiError";
import { stableSignature } from "../../utils/stableSignature";
import ManagerToolbarSearch from "./ManagerToolbarSearch";
import SettingsForm from "../../components/settings/SettingsForm";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import UiTextarea from "../../components/ui/UiTextarea";
import { focusFirstInvalidField } from "../../utils/focusFirstInvalidField";
import { useManagerIamCollection } from "./useManagerIamCollection";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerIamError,
  managerIamResultCount,
  managerIamRolesPoliciesZhMessages,
} from "./managerIamRolesPoliciesMessages";

const DEFAULT_POLICY_DOCUMENT = JSON.stringify(
  {
    Version: "2012-10-17",
    Statement: [],
  },
  null,
  2
);

const extractError = (err: unknown): string => extractApiError(err, "Unexpected error");

export default function PoliciesPage() {
  const { locale, t } = useManagerText(managerIamRolesPoliciesZhMessages);
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";
  const [policyFilter, setPolicyFilter] = useState("");
  const {
    error,
    items: policies,
    load,
    loading,
    setError,
    setItems: setPolicies,
    setLoading,
  } = useManagerIamCollection(listIamPolicies);
  const [advancedName, setAdvancedName] = useState("");
  const [documentText, setDocumentText] = useState(DEFAULT_POLICY_DOCUMENT);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  let parsedDocument: Record<string, unknown> | undefined;
  let documentError: string | undefined;
  try {
    parsedDocument = JSON.parse(documentText);
  } catch {
    documentError = "Policy document must be valid JSON.";
  }
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [advancedInitialSignature, setAdvancedInitialSignature] = useState(() =>
    stableSignature({ advancedName: "", documentText: DEFAULT_POLICY_DOCUMENT })
  );

  useEffect(() => {
    if (needsS3AccountSelection) {
      setPolicies([]);
      setLoading(false);
      return;
    }
    load(accountIdForApi);
  }, [accountIdForApi, needsS3AccountSelection, accessMode, load, setLoading, setPolicies]);

  const handleAdvancedCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (needsS3AccountSelection || isS3User || creating) return;
    setValidationAttempted(true);
    if (!advancedName.trim() || documentError) {
      focusFirstInvalidField(e.currentTarget as HTMLFormElement);
      return;
    }
    setCreating(true);
    setError(null);
    setActionMessage(null);
    try {
      await createIamPolicy(accountIdForApi, advancedName.trim(), parsedDocument!);
      setAdvancedName("");
      setDocumentText(DEFAULT_POLICY_DOCUMENT);
      setShowAdvancedModal(false);
      setActionMessage("Policy created");
      await load(accountIdForApi);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setCreating(false);
    }
  };

  const openAdvancedModal = () => {
    setError(null);
    setValidationAttempted(false);
    setAdvancedInitialSignature(stableSignature({ advancedName, documentText }));
    setShowAdvancedModal(true);
  };

  const closeAdvancedModal = () => {
    setShowAdvancedModal(false);
    setAdvancedName("");
    setDocumentText(DEFAULT_POLICY_DOCUMENT);
    setAdvancedInitialSignature(stableSignature({ advancedName: "", documentText: DEFAULT_POLICY_DOCUMENT }));
  };

  const advancedCurrentSignature = useMemo(
    () => stableSignature({ advancedName, documentText }),
    [advancedName, documentText]
  );
  const advancedCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: showAdvancedModal && advancedCurrentSignature !== advancedInitialSignature,
    onClose: closeAdvancedModal,
    disabled: creating,
    title: t("Discard changes?"),
    description: t("You have unapplied changes. Closing this dialog will discard them."),
    cancelLabel: t("Keep editing"),
    confirmLabel: t("Discard changes"),
  });

  const filteredPolicies = policies.filter((policy) => {
    const needle = policyFilter.trim().toLowerCase();
    if (!needle) return true;
    return policy.name.toLowerCase().includes(needle) || policy.arn.toLowerCase().includes(needle);
  });
  const filteredTableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: filteredPolicies.length,
  });
  const policyTableColumns: Array<DataTableColumn<IamPolicy>> = [
    { id: "name", label: t("Name"), primary: true, mobileRole: "primary", render: (policy) => policy.name },
    { id: "arn", label: "ARN", render: (policy) => policy.arn },
    { id: "version", label: t("Version"), render: (policy) => policy.default_version_id ?? "-" },
  ];

  return (
    <div className={workflowPageHostClass(showAdvancedModal)}>
      <PageHeader actionPresentation="listing"
        title={t("IAM Policies")}
        description={t("List and create Ceph IAM policies for the selected account.")}
        breadcrumbs={localizedManagerPageBreadcrumbs("policies", locale)}
        breadcrumbLabel={t("Breadcrumb")}
        actions={
          !needsS3AccountSelection && !isS3User
            ? [
                {
                  label: t("Create policy"),
                  onClick: openAdvancedModal,
                },
              ]
            : []
        }
      />

      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}
      {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}

      {needsS3AccountSelection ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("Select an account before managing IAM policies")}
          description={t("Policies are created inside an execution context. Choose an account to list, create, and attach managed IAM policies.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : isS3User ? (
        <PageEmptyState
          eyebrow={t("Next step")}
          title={t("IAM policies are unavailable for managed S3 user contexts")}
          description={t("Switch to an RGW account or S3 connection context to manage reusable IAM policies.")}
          primaryAction={{ label: t("Open users"), to: "/manager/users" }}
          tone="warning"
        />
      ) : (
        <ListPageSection variant="page"
            title={t("Policies")}
            countLabel={managerIamResultCount(locale, filteredPolicies.length)}
            search={
              <ManagerToolbarSearch
                value={policyFilter}
                onChange={setPolicyFilter}
                placeholder={t("Search by name or ARN")}
              />
            }
        >
          <DataTableShell
            columns={policyTableColumns}
            rows={filteredPolicies}
            rowKey={(policy) => policy.arn}
            status={filteredTableStatus}
            loadingMessage={t("Loading policies...")}
            errorMessage={t("Unable to load policies.")}
            emptyMessage={t("No policies.")}
            responsiveCards
            tableLayout="fixed"
          />
        </ListPageSection>
      )}

      {showAdvancedModal && (
        <WorkflowPage
          title={t("Create IAM policy")}
          description={t("Name the policy and edit its complete JSON document with page-level space.")}
          breadcrumbs={localizedManagerPageBreadcrumbs("policies", locale, { label: t("Create") })}
          breadcrumbLabel={t("Breadcrumb")}
          backLabel={t("Back to policies")}
          onBack={advancedCloseGuard.requestClose}
          width="standard"
          contentVariant="plain"
        >
          {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}
          <SettingsForm label={t("Create IAM policy")} onSubmit={handleAdvancedCreate}
            busy={creating} disabled={needsS3AccountSelection || isS3User} onCancel={advancedCloseGuard.requestClose}
            submitLabel={t("Create policy")} busyLabel={t("Creating...")}>
            <SettingsSection title={t("Identity")} presentation="compact">
              <div className="settings-fields">
                <UiInput label={t("Policy name")} required value={advancedName} onChange={(event) => setAdvancedName(event.target.value)}
                  placeholder={t("Policy name")} error={validationAttempted && !advancedName.trim() ? t("Policy name is required.") : undefined} />
              </div>
            </SettingsSection>
            <SettingsSection title={t("Policy document")} presentation="compact">
              <div className="settings-fields">
                <UiTextarea label={t("Policy document (JSON)")} value={documentText} onChange={(event) => setDocumentText(event.target.value)}
                  className="font-mono" rows={10} spellCheck={false} error={validationAttempted && documentError ? t(documentError) : undefined}
                  hint={t("Provide a valid IAM policy JSON document. You can start from the default template and customize statements.")} />
              </div>
            </SettingsSection>
          </SettingsForm>
          {advancedCloseGuard.confirmationDialog}
        </WorkflowPage>
      )}
    </div>
  );
}
