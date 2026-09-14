/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { SettingsSection } from "../../components/settings/SettingsLayout";
import { ListActionButton } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { S3AccountSelector } from "../../api/accountParams";
import { IamPolicy, listIamPolicies } from "../../api/managerIamPolicies";
import PageShell from "../../components/PageShell";
import PageBanner from "../../components/PageBanner";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import { extractApiError } from "../../utils/apiError";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";
import InlinePolicyEditor from "./InlinePolicyEditor";
import UiSelect from "../../components/ui/UiSelect";
import { SettingsButton } from "../../components/settings/SettingsControls";
import { useS3AccountContext } from "./S3AccountContext";
import { localizedManagerPageBreadcrumbs } from "./managerBreadcrumbs";
import { useManagerText } from "./managerI18n";
import {
  localizeManagerIamError,
  managerIamEntityLabel,
  managerIamRolesPoliciesZhMessages,
} from "./managerIamRolesPoliciesMessages";

type ManagerPolicyEntityType = "user" | "group" | "role";

type PageAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "ghost" | "secondary" | "primary" | "danger";
};

type ManagerEntityPoliciesPageProps = {
  entityType: ManagerPolicyEntityType;
  routeParam: "userName" | "groupName" | "roleName";
  listPoliciesForEntity: (accountId: S3AccountSelector, entityName: string) => Promise<IamPolicy[]>;
  attachPolicyToEntity: (accountId: S3AccountSelector, entityName: string, policy: IamPolicy) => Promise<IamPolicy>;
  detachPolicyFromEntity: (accountId: S3AccountSelector, entityName: string, policyArn: string) => Promise<void>;
  listInlinePoliciesForEntity: (accountId: S3AccountSelector, entityName: string) => Promise<{ name: string; document: Record<string, unknown> }[]>;
  putInlinePolicyForEntity: (
    accountId: S3AccountSelector,
    entityName: string,
    policyName: string,
    document: Record<string, unknown>
  ) => Promise<{ name: string; document: Record<string, unknown> }>;
  deleteInlinePolicyForEntity: (accountId: S3AccountSelector, entityName: string, policyName: string) => Promise<void>;
  extraActions?: (entityName: string) => PageAction[];
};

type EntityPageConfig = {
  title: string;
  singularLabel: string;
  pluralLabel: string;
  managerRoute: string;
};

const ENTITY_CONFIG: Record<ManagerPolicyEntityType, EntityPageConfig> = {
  user: {
    title: "User policies",
    singularLabel: "user",
    pluralLabel: "users",
    managerRoute: "/manager/users",
  },
  group: {
    title: "Group policies",
    singularLabel: "group",
    pluralLabel: "groups",
    managerRoute: "/manager/groups",
  },
  role: {
    title: "Role policies",
    singularLabel: "role",
    pluralLabel: "roles",
    managerRoute: "/manager/roles",
  },
};

function extractError(err: unknown): string {
  return extractApiError(err, "Unexpected error");
}

export default function ManagerEntityPoliciesPage({
  entityType,
  routeParam,
  listPoliciesForEntity,
  attachPolicyToEntity,
  detachPolicyFromEntity,
  listInlinePoliciesForEntity,
  putInlinePolicyForEntity,
  deleteInlinePolicyForEntity,
  extraActions,
}: ManagerEntityPoliciesPageProps) {
  const { locale, t } = useManagerText(managerIamRolesPoliciesZhMessages);
  const config = ENTITY_CONFIG[entityType];
  const localizedSingularLabel = managerIamEntityLabel(locale, entityType);
  const localizedPluralLabel = managerIamEntityLabel(locale, entityType, { plural: true });
  const parentPageId = {
    user: "users",
    group: "groups",
    role: "roles",
  } as const;
  const params = useParams();
  const rawEntityName = params[routeParam];
  const { selectedS3AccountType, accountIdForApi, requiresS3AccountSelection, accessMode } = useS3AccountContext();
  const needsS3AccountSelection = requiresS3AccountSelection && !accountIdForApi;
  const isS3User = selectedS3AccountType === "s3_user";

  const [attached, setAttached] = useState<IamPolicy[]>([]);
  const [available, setAvailable] = useState<IamPolicy[]>([]);
  const [selectedArn, setSelectedArn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const policyConfirmation = useConfirmActionDialog();

  const decodedEntity = useMemo(() => {
    if (!rawEntityName) return "";
    try {
      return decodeURIComponent(rawEntityName);
    } catch {
      return rawEntityName;
    }
  }, [rawEntityName]);

  const noPoliciesAvailable = available.length === 0;

  const load = useCallback(async (accountId: S3AccountSelector, entityName: string) => {
    setLoading(true);
    setError(null);
    try {
      const [attachedPolicies, allPolicies] = await Promise.all([
        listPoliciesForEntity(accountId, entityName),
        listIamPolicies(accountId),
      ]);
      setAttached(attachedPolicies);
      setAvailable(allPolicies);
      const firstFree = allPolicies.find((policy) => !attachedPolicies.some((candidate) => candidate.arn === policy.arn));
      setSelectedArn(firstFree?.arn ?? "");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [listPoliciesForEntity]);

  useEffect(() => {
    if (isS3User) {
      setAttached([]);
      setAvailable([]);
      setLoading(false);
      return;
    }
    if (needsS3AccountSelection) {
      setAttached([]);
      setAvailable([]);
      setLoading(false);
      return;
    }
    if (rawEntityName) {
      load(accountIdForApi, rawEntityName);
    }
  }, [accessMode, accountIdForApi, isS3User, load, needsS3AccountSelection, rawEntityName]);

  const handleRefresh = () => {
    if (needsS3AccountSelection || !rawEntityName) return;
    load(accountIdForApi, rawEntityName);
  };

  const handleAttach = async (event: FormEvent) => {
    event.preventDefault();
    if (needsS3AccountSelection || !rawEntityName || !selectedArn || busy !== null || loading) return;
    const policy = available.find((candidate) => candidate.arn === selectedArn);
    if (!policy) return;
    setBusy("attach");
    setError(null);
    setActionMessage(null);
    try {
      await attachPolicyToEntity(accountIdForApi, rawEntityName, policy);
      await load(accountIdForApi, rawEntityName);
      setActionMessage("Policy attached");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const detachPolicy = async (policyArn: string) => {
    if (needsS3AccountSelection || !rawEntityName) return;
    setBusy(policyArn);
    setError(null);
    setActionMessage(null);
    try {
      await detachPolicyFromEntity(accountIdForApi, rawEntityName, policyArn);
      await load(accountIdForApi, rawEntityName);
      setActionMessage("Policy detached");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDetach = (policyArn: string) => {
    policyConfirmation.requestConfirmation({
      title: t("Detach managed policy?"),
      description: locale === "zh"
        ? `从所选${localizedSingularLabel}中分离此托管策略。`
        : `Remove this managed policy from the selected ${config.singularLabel}.`,
      confirmLabel: t("Detach policy"),
      details: [
        { label: localizedSingularLabel, value: decodedEntity },
        { label: t("Policy ARN"), value: policyArn, mono: true },
      ],
      impacts: [locale === "zh"
        ? `仅由此策略授予的权限将不再应用于该${localizedSingularLabel}。`
        : `Permissions granted only by this policy will no longer apply to the ${config.singularLabel}.`],
      onConfirm: () => detachPolicy(policyArn),
    });
  };

  const loadInlinePolicies = useCallback(async () => {
    if (!rawEntityName || needsS3AccountSelection) return [];
    return listInlinePoliciesForEntity(accountIdForApi, rawEntityName);
  }, [accountIdForApi, listInlinePoliciesForEntity, needsS3AccountSelection, rawEntityName]);

  const saveInlinePolicy = async (name: string, document: Record<string, unknown>) => {
    if (!rawEntityName) return;
    await putInlinePolicyForEntity(accountIdForApi, rawEntityName, name, document);
  };

  const removeInlinePolicy = async (name: string) => {
    if (!rawEntityName) return;
    await deleteInlinePolicyForEntity(accountIdForApi, rawEntityName, name);
  };

  if (isS3User) {
    return (
      <PageShell actionPresentation="listing"
          title={t(config.title)}
          description={locale === "zh"
            ? `为指定${localizedSingularLabel}附加或分离 IAM 策略。`
            : `Attach/detach IAM policies for a specific ${config.singularLabel}.`}
          breadcrumbs={localizedManagerPageBreadcrumbs(parentPageId[entityType], locale, { label: t("Policies") })}
          breadcrumbLabel={t("Breadcrumb")}
      >
        <PageBanner tone="info">
          {locale === "zh"
            ? `独立 S3 用户无法使用 IAM ${localizedPluralLabel}。请选择 S3 账户后继续。`
            : <>IAM {config.pluralLabel} are not available for standalone S3 users. Select an S3 Account to continue.</>}
        </PageBanner>
      </PageShell>
    );
  }

  if (!rawEntityName) {
    return <div className="ui-body text-slate-600">
      {locale === "zh"
        ? `未指定${localizedSingularLabel}。`
        : `${config.singularLabel[0].toUpperCase()}${config.singularLabel.slice(1)} not specified.`}
    </div>;
  }

  if (needsS3AccountSelection) {
    return <div className="ui-body text-slate-600">
      {locale === "zh"
        ? `请先选择账户，再管理${localizedPluralLabel}。`
        : `Select an account before managing ${config.pluralLabel}.`}
    </div>;
  }

  const options = available.map((policy) => ({ value: policy.arn, label: policy.name }));
  const tableStatus = resolveListTableStatus({ loading, error, rowCount: attached.length });
  const attachedPolicyColumns: Array<DataTableColumn<IamPolicy>> = [
    {
      id: "policy",
      label: t("Policy"),
      primary: true,
      render: (policy) => policy.name,
    },
    {
      id: "arn",
      label: "ARN",
      cellClassName: "break-all font-mono text-[11px]",
      render: (policy) => policy.arn,
    },
    {
      id: "actions",
      label: t("Actions"),
      align: "right",
      mobileRole: "actions",
      render: (policy) => (
        <ListActionButton variant="danger"
          type="button"
          onClick={() => handleDetach(policy.arn)}
          disabled={busy === policy.arn}
        >
          {busy === policy.arn ? t("Detaching...") : t("Detach")}
        </ListActionButton>
      ),
    },
  ];

  const detailLine = (
    <>
      {locale === "zh"
        ? `为${localizedSingularLabel}“`
        : entityType === "role" ? "Attach/detach policies for role " : "Attach/detach policies for "}
      <span className="font-semibold text-slate-700 dark:text-slate-100 [overflow-wrap:anywhere]">{decodedEntity}</span>
      {locale === "zh" ? "”附加或分离策略。" : "."}
    </>
  );

  return (
    <PageShell actionPresentation="listing"
      title={t(config.title)}
      description={detailLine}
      breadcrumbs={localizedManagerPageBreadcrumbs(
        parentPageId[entityType],
        locale,
        { label: decodedEntity },
        { label: t("Policies") },
      )}
      breadcrumbLabel={t("Breadcrumb")}
      actions={[
        {
          label: locale === "zh" ? `← 返回${localizedPluralLabel}` : `← Back to ${config.pluralLabel}`,
          to: config.managerRoute,
          variant: "ghost",
        },
        ...(extraActions?.(decodedEntity) ?? []),
        { label: t("Refresh"), onClick: handleRefresh, variant: "ghost" },
      ]}
    >

      {error && <PageBanner tone="error">{localizeManagerIamError(locale, error)}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{t(actionMessage)}</PageBanner>}
      {noPoliciesAvailable && (
        <PageBanner tone="warning">
          {locale === "zh"
            ? `没有可用的 IAM 策略。请先创建策略，再附加到此${localizedSingularLabel}。`
            : <>No IAM policies available. Create one before attaching to this {config.singularLabel}.</>}
        </PageBanner>
      )}

      <div className="settings-compact settings-stack">
        <InlinePolicyEditor
          entityLabel={config.singularLabel}
          entityName={decodedEntity}
          loadPolicies={loadInlinePolicies}
          savePolicy={saveInlinePolicy}
          deletePolicy={removeInlinePolicy}
          disabled={needsS3AccountSelection}
          disabledReason={locale === "zh"
            ? `请先选择账户，再编辑${localizedSingularLabel}的内联策略。`
            : `Select an account before editing ${config.singularLabel} inline policies.`}
          key={`${config.singularLabel}-inline-${accountIdForApi ?? "none"}-${rawEntityName ?? ""}`}
        />

        <SettingsSection presentation="compact" title={t("Attached policies")}
          description={locale === "zh"
            ? `为此${localizedSingularLabel}附加或分离托管策略。`
            : `Attach/detach managed policies for this ${config.singularLabel}.`}>
          <div className="settings-stack">
            <form aria-label={t("Attach managed policy")} onSubmit={handleAttach} className="settings-fields">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <UiSelect label={t("Managed policy")} value={selectedArn} onChange={(event) => setSelectedArn(event.target.value)}
                    disabled={busy !== null || loading}>
                    <option value="">{t("Select a policy to attach")}</option>
                    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </UiSelect>
                </div>
                <SettingsButton type="submit" disabled={busy !== null || loading || !selectedArn}>
                  {busy === "attach" ? t("Attaching...") : t("Attach")}
                </SettingsButton>
              </div>
              <p className="settings-description">{t("Policies must be created first in the Policies tab.")}</p>
            </form>
            <DataTableShell
              columns={attachedPolicyColumns}
              rows={attached}
              rowKey={(policy) => policy.arn}
              status={tableStatus}
              loadingMessage={t("Loading policies...")}
              errorMessage={t("Unable to load policies.")}
              emptyMessage={t("No attached policies.")}
              tableClassName="ui-data-table"
              responsiveCards
            />
          </div>
        </SettingsSection>
      </div>
      {policyConfirmation.confirmationDialog}
    </PageShell>
  );
}
