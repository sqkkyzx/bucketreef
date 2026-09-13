/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import AccountControlIcon from "../../components/AccountControlIcon";
import Layout from "../../components/Layout";
import TopbarContextAccountSelector, {
  getContextAccessModeVisual,
} from "../../components/TopbarContextAccountSelector";
import { S3AccountProvider, useS3AccountContext } from "./S3AccountContext";
import { SidebarSection } from "../../components/Sidebar";
import { formatAccountLabel } from "../shared/storageEndpointLabel";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import type { TopbarControlDescriptor } from "../../components/topbarControlsLayout";
import {
  TOPBAR_CONTEXT_SELECTOR_ICON_WIDTH_CLASS,
  TOPBAR_CONTEXT_SELECTOR_ESTIMATED_LABEL_WIDTH,
  TOPBAR_CONTEXT_SELECTOR_VALUE_WIDTH_CLASS,
  TOPBAR_CONTEXT_SELECTOR_WIDTH_CLASS,
} from "../../components/topbarControlWidths";
import {
  getManagerToolAccess,
  readStoredUser,
} from "../../utils/workspaces";
import {
  MANAGER_PAGE_CONTRACTS,
  workspacePageLink,
} from "../../navigation/workspacePages";
import { useManagerText } from "./managerI18n";
import { managerShellZhMessages } from "./managerShellMessages";

type SessionCapabilities = {
  can_manage_iam?: boolean;
  can_manage_buckets?: boolean;
  can_view_traffic?: boolean;
};

function ManagerShell() {
  const { locale, t } = useManagerText(managerShellZhMessages);
  const {
    accounts,
    selectedS3AccountId,
    setSelectedS3AccountId,
    requiresS3AccountSelection,
    sessionS3AccountName,
    selectedS3AccountType,
    accessError,
    iamIdentity,
    accessMode,
    managerStatsEnabled,
    managerStatsMessage,
    managerBrowserEnabled,
    managerCephKeysEnabled,
    managerPrivateAccessEnabled,
  } = useS3AccountContext();
  const { generalSettings } = useGeneralSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selected = accounts.find((a) => a.id === selectedS3AccountId);
  const showSelector = requiresS3AccountSelection && accounts.length > 1;
  const storedUser = readStoredUser();
  const userCapabilities = (storedUser?.capabilities as SessionCapabilities | undefined) ?? null;
  const contextCapabilities = (selected?.capabilities as Partial<SessionCapabilities> | undefined) ?? null;
  const capabilities: SessionCapabilities = {
    can_manage_iam: contextCapabilities?.can_manage_iam ?? userCapabilities?.can_manage_iam ?? true,
    can_manage_buckets: contextCapabilities?.can_manage_buckets ?? userCapabilities?.can_manage_buckets ?? true,
    can_view_traffic: contextCapabilities?.can_view_traffic ?? userCapabilities?.can_view_traffic ?? true,
  };
  const isS3User = selectedS3AccountType === "s3_user";
  const canManageBuckets = capabilities.can_manage_buckets !== false;
  const canAccessBucketCompare =
    canManageBuckets && Boolean(generalSettings.bucket_compare_enabled) && Boolean(requiresS3AccountSelection);
  const canAccessBucketIntegrity =
    canManageBuckets && Boolean(generalSettings.bucket_integrity_check_enabled) && Boolean(requiresS3AccountSelection);
  const canAccessBucketPurge =
    canManageBuckets && Boolean(generalSettings.bucket_purge_enabled) && Boolean(requiresS3AccountSelection);
  const userRole = storedUser?.role ?? null;
  const managerToolAccess = getManagerToolAccess(storedUser);
  const canAccessMigration =
    Boolean(generalSettings.bucket_migration_enabled) &&
    Boolean(managerToolAccess?.bucket_migration) &&
    (userRole === "ui_admin" || userRole === "ui_superadmin" || userRole === "ui_user");
  const canAccessBucketCompareForUser = Boolean(managerToolAccess?.bucket_compare);
  const canAccessBucketIntegrityForUser = Boolean(managerToolAccess?.bucket_integrity_check);
  const canAccessBucketPurgeForUser = Boolean(managerToolAccess?.bucket_purge);
  const canAccessFeatureRulesForUser = Boolean(managerToolAccess?.feature_rules);
  const canShowBucketCompare = canAccessBucketCompare && canAccessBucketCompareForUser;
  const canShowBucketIntegrity = canAccessBucketIntegrity && canAccessBucketIntegrityForUser;
  const canShowBucketPurge = canAccessBucketPurge && canAccessBucketPurgeForUser;
  const endpointCaps = selected?.storage_endpoint_capabilities ?? null;
  const iamFeatureEnabled = endpointCaps ? endpointCaps.iam !== false : true;
  const canManageIam = !isS3User && capabilities.can_manage_iam !== false && iamFeatureEnabled;
  const usageFeatureEnabled = endpointCaps ? endpointCaps.metrics !== false : true;
  const metricsFeatureEnabled = endpointCaps ? endpointCaps.usage !== false : true;
  const snsFeatureEnabled = endpointCaps ? endpointCaps.sns !== false : true;
  const canViewUsageStatsMenu =
    canManageBuckets && Boolean(requiresS3AccountSelection) && Boolean(generalSettings.bucket_usage_stats_enabled);
  const canViewMetricsMenu =
    canViewUsageStatsMenu || (Boolean(managerStatsEnabled) && (usageFeatureEnabled || metricsFeatureEnabled));
  const managerMetricsDisabledHint =
    managerStatsEnabled === null
      ? t("Metrics availability is loading for this context.")
      : managerStatsEnabled === false
        ? managerStatsMessage && managerStatsMessage.trim()
          ? t(managerStatsMessage)
          : t("Metrics are disabled for this context.")
        : !usageFeatureEnabled && !metricsFeatureEnabled
          ? t("Metrics are unavailable for this endpoint capabilities.")
          : undefined;
  const managerBrowserAvailable = managerBrowserEnabled === true;
  const modeVisual = getContextAccessModeVisual(accessMode, locale);
  const identityLabel = iamIdentity
    ? accessMode === "connection"
      ? t({ en: `S3 Identity: ${iamIdentity}`, zh: `S3 身份：${iamIdentity}` })
      : t({ en: `IAM Identity: ${iamIdentity}`, zh: `IAM 身份：${iamIdentity}` })
    : selectedS3AccountType === "s3_user" && sessionS3AccountName
      ? t({ en: `S3 user account: ${sessionS3AccountName}`, zh: `S3 用户账户：${sessionS3AccountName}` })
      : null;

  const selectedLabel = selected
    ? formatAccountLabel(selected, true, locale)
    : t("No account selected");

  const handleS3AccountChange = (selectedValue: string) => {
    const value = selectedValue || null;
    if (value === selectedS3AccountId) return;
    setSelectedS3AccountId(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set("ctx", value);
    } else {
      nextParams.delete("ctx");
    }
    navigate({ pathname: "/manager", search: nextParams.toString() ? `?${nextParams.toString()}` : "" });
  };

  const renderStaticAccountPill = (mode: "icon" | "icon_label") => {
    if (mode === "icon") {
      return (
        <button
          type="button"
          aria-label={t({ en: `Account context ${selectedLabel}`, zh: `账户上下文：${selectedLabel}` })}
          title={identityLabel ?? selectedLabel}
          className={`shell-control inline-flex h-9 ${TOPBAR_CONTEXT_SELECTOR_ICON_WIDTH_CLASS} items-center justify-center rounded-lg border text-left`}
        >
          <AccountControlIcon className="shell-icon-muted h-4 w-4" />
          <span className="sr-only">{selectedLabel}</span>
        </button>
      );
    }
    return (
      <div className={`shell-control inline-flex h-10 ${TOPBAR_CONTEXT_SELECTOR_WIDTH_CLASS} items-center gap-2.5 rounded-lg border px-3 text-left`}>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="shell-muted-text block truncate text-[10px] font-medium">
            {t("Account")}
          </span>
          <span className={`mt-0.5 block ${TOPBAR_CONTEXT_SELECTOR_VALUE_WIDTH_CLASS} truncate text-[12px] font-semibold leading-4 text-[var(--shell-text)]`}>
            {selectedLabel}
          </span>
        </span>
        <span className={`rounded-full px-2 py-0.5 ui-caption font-semibold ${modeVisual.classes}`}>
          {modeVisual.shortLabel}
        </span>
      </div>
    );
  };

  const topbarControlDescriptors: TopbarControlDescriptor[] = [
    {
      id: "account",
      icon: <AccountControlIcon className="h-4 w-4" />,
      selectedLabel,
      priority: 10,
      estimatedIconWidth: 36,
      estimatedLabelWidth: TOPBAR_CONTEXT_SELECTOR_ESTIMATED_LABEL_WIDTH,
      renderControl: (mode) =>
        requiresS3AccountSelection && showSelector ? (
          <TopbarContextAccountSelector
            contexts={accounts}
            selectedContextId={selectedS3AccountId}
            onContextChange={handleS3AccountChange}
            selectedLabel={selectedLabel}
            identityLabel={identityLabel}
            widthClassName={mode === "icon" ? TOPBAR_CONTEXT_SELECTOR_ICON_WIDTH_CLASS : TOPBAR_CONTEXT_SELECTOR_WIDTH_CLASS}
            icon={<AccountControlIcon className="h-4 w-4" />}
            triggerMode={mode}
            showTriggerTags={mode !== "icon"}
          />
        ) : (
          renderStaticAccountPill(mode)
        ),
    },
  ];

  const managerPageLink = (pageId: keyof typeof MANAGER_PAGE_CONTRACTS) => ({
    ...workspacePageLink(MANAGER_PAGE_CONTRACTS[pageId]),
    label: t(MANAGER_PAGE_CONTRACTS[pageId].label),
  });

  const navSections: SidebarSection[] = [
    {
      label: "Overview",
      displayLabel: t("Overview"),
      links: [
        { ...managerPageLink("dashboard"), end: true },
        {
          ...managerPageLink("metrics"),
          disabled: !canViewMetricsMenu,
          disabledHint: !canViewMetricsMenu ? managerMetricsDisabledHint : undefined,
        },
      ],
    },
  ];

  if (canManageBuckets) {
    navSections.push({
      label: "Storage",
      displayLabel: t("Storage"),
      links: [
        managerPageLink("buckets"),
        ...(generalSettings.browser_enabled && generalSettings.browser_manager_enabled && managerBrowserAvailable
          ? [managerPageLink("browser")]
          : []),
      ],
    });
    if (snsFeatureEnabled) {
      navSections.push({
        label: "Events",
        displayLabel: t("Events"),
        links: [managerPageLink("topics")],
      });
    }
  }

  if (canManageIam) {
    navSections.push({
      label: "IAM",
      links: [
        managerPageLink("users"),
        managerPageLink("groups"),
        managerPageLink("roles"),
        managerPageLink("policies"),
      ],
    });
  }

  if (isS3User && (managerCephKeysEnabled || managerPrivateAccessEnabled)) {
    navSections.push({
      label: "Ceph",
      links: [managerPageLink("ceph-keys")],
    });
  }

  if (canManageBuckets) {
    const toolsLinks: SidebarSection["links"] = [];
    if (canAccessFeatureRulesForUser) {
      toolsLinks.push({ ...managerPageLink("feature-rules"), iconName: "rules" });
    }
    if (canShowBucketCompare) {
      toolsLinks.push({ ...managerPageLink("compare"), iconName: "compare" });
    }
    if (canShowBucketIntegrity) {
      toolsLinks.push({ ...managerPageLink("integrity"), iconName: "integrity" });
    }
    if (canShowBucketPurge) {
      toolsLinks.push({ ...managerPageLink("purge"), iconName: "purge" });
    }
    if (canAccessMigration) {
      toolsLinks.push({ ...managerPageLink("migration"), iconName: "migration" });
    }
    if (toolsLinks.length > 0) {
      navSections.push({
        label: "Tools",
        displayLabel: t("Tools"),
        links: toolsLinks,
      });
    }
  }

  return (
    <Layout
      navSections={navSections}
      headerTitle={t("Manager")}
      hideHeader
      sidebarTitle={t({ en: "MANAGER", zh: "管理控制台" })}
      topbarControlDescriptors={topbarControlDescriptors}
    >
      <>
        {accessError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 ui-body text-amber-800 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-100">
            {t("Access denied for /manager. Check your account permissions or contact an administrator.")}
          </div>
        )}
        <Outlet key={`${selectedS3AccountId ?? "session"}:${accessMode ?? "default"}`} />
      </>
    </Layout>
  );
}

export default function ManagerLayout() {
  return (
    <S3AccountProvider>
      <ManagerShell />
    </S3AccountProvider>
  );
}
