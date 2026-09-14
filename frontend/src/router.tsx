/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageRGWUsers,
  messageGeneral,
} from "./uiMessages";
import { translate, useI18n } from "./i18n";
import type { UiLanguage } from "./components/language";
import { Suspense, lazy, useMemo } from "react";
import { Navigate, Outlet, Route, RouterProvider, createBrowserRouter, createRoutesFromElements, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { resolveSidebarLinkIconName } from "./components/Sidebar";
import { useGeneralSettings } from "./components/GeneralSettingsContext";
import FeatureDisabledPage from "./features/shared/FeatureDisabledPage";
import RouteErrorPage from "./features/shared/RouteErrorPage";
import {
  RequireAuth,
  RequireBrowserSurface,
  RequireCephAdminFeature,
  RequireManagerBucketCompareFeature,
  RequireManagerBucketIntegrityFeature,
  RequireManagerBucketPurgeFeature,
  RequireManagerFeature,
  RequireManagerFeatureRulesTool,
  RequireManagerIamFeature,
  RequireManagerMigrationFeature,
  RequirePortalAccess,
  RequireRole,
  RouteFallback,
  RequireStorageOpsFeature,
  RoleRedirect,
} from "./routerGuards";
import {
  isSuperAdminRole,
  readStoredUser,
} from "./utils/workspaces";
import {
  ADMIN_PAGE_CONTRACTS,
  workspacePageLink,
} from "./navigation/workspacePages";
import { useAdminPendingRequestCounts } from "./hooks/useAdminPendingRequestCounts";
import type { AdminPendingRequestCounts } from "./api/adminNavigation";

export { RequireManagerFeatureRulesTool, RequirePortalAccess } from "./routerGuards";

const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const FirstAdminSetupPage = lazy(() => import("./features/auth/FirstAdminSetupPage"));
const OidcCallbackPage = lazy(() => import("./features/auth/OidcCallbackPage"));
const UnauthorizedPage = lazy(() => import("./features/auth/UnauthorizedPage"));
const S3AccountsPage = lazy(() => import("./features/admin/AccountsPage"));
const AuditLogsPage = lazy(() => import("./features/admin/AuditLogsPage"));
const UsersPage = lazy(() => import("./features/admin/UsersPage"));
const GroupsPage = lazy(() => import("./features/admin/GroupsPage"));
const IdentitySecurityPage = lazy(() => import("./features/admin/IdentitySecurityPage"));
const AdminDashboard = lazy(() => import("./features/admin/AdminDashboard"));
const AdminMetricsPage = lazy(() => import("./features/admin/AdminMetricsPage"));
const AdminPortalRequestsPage = lazy(() => import("./features/admin/AdminPortalRequestsPage"));
const BillingPage = lazy(() => import("./features/admin/BillingPage"));
const UsageHistoryPage = lazy(() => import("./features/admin/UsageHistoryPage"));
const ApiTokensPage = lazy(() => import("./features/admin/ApiTokensPage"));
const S3UsersPage = lazy(() => import("./features/admin/S3UsersPage"));
const S3UserKeysPage = lazy(() => import("./features/admin/S3UserKeysPage"));
const S3ConnectionsPage = lazy(() => import("./features/admin/S3ConnectionsPage"));
const GeneralSettingsPage = lazy(() => import("./features/admin/GeneralSettingsPage"));
const AuthenticationSettingsPage = lazy(() => import("./features/admin/AuthenticationSettingsPage"));
const ManagerSettingsPage = lazy(() => import("./features/admin/ManagerSettingsPage"));
const AdminPortalSettingsPage = lazy(() => import("./features/admin/PortalSettingsPage"));
const BrowserSettingsPage = lazy(() => import("./features/admin/BrowserSettingsPage"));
const AuthProviderPage = lazy(() => import("./features/admin/settings/AuthProviderPage"));
const KeyRotationPage = lazy(() => import("./features/admin/KeyRotationPage"));
const BucketsPage = lazy(() => import("./features/manager/BucketsPage"));
const ManagerDashboard = lazy(() => import("./features/manager/ManagerDashboard"));
const PoliciesPage = lazy(() => import("./features/manager/PoliciesPage"));
const ManagerLayout = lazy(() => import("./features/manager/ManagerLayout"));
const StorageEndpointsPage = lazy(() => import("./features/admin/StorageEndpointsPage"));
const EndpointStatusPage = lazy(() => import("./features/admin/EndpointStatusPage"));
const EndpointStatusDetailPage = lazy(() => import("./features/admin/EndpointStatusDetailPage"));
const ManagerUsersPage = lazy(() => import("./features/manager/ManagerUsersPage"));
const ManagerUserKeysPage = lazy(() => import("./features/manager/ManagerUserKeysPage"));
const BucketDetailPage = lazy(() => import("./features/manager/BucketDetailPage"));
const BrowserPage = lazy(() => import("./features/browser/BrowserPage"));
const ManagerBrowserPage = lazy(() => import("./features/manager/ManagerBrowserPage"));
const ManagerGroupsPage = lazy(() => import("./features/manager/ManagerGroupsPage"));
const ManagerGroupUsersPage = lazy(() => import("./features/manager/ManagerGroupUsersPage"));
const ManagerRolesPage = lazy(() => import("./features/manager/ManagerRolesPage"));
const ManagerRolePoliciesPage = lazy(() => import("./features/manager/ManagerRolePoliciesPage"));
const ManagerUserPoliciesPage = lazy(() => import("./features/manager/ManagerUserPoliciesPage"));
const ManagerGroupPoliciesPage = lazy(() => import("./features/manager/ManagerGroupPoliciesPage"));
const ManagerMetricsPage = lazy(() => import("./features/manager/ManagerMetricsPage"));
const TopicsPage = lazy(() => import("./features/manager/TopicsPage"));
const ManagerMigrationsPage = lazy(() => import("./features/manager/ManagerMigrationsPage"));
const ManagerMigrationDetailPage = lazy(() => import("./features/manager/ManagerMigrationDetailPage"));
const ManagerMigrationWizardPage = lazy(() => import("./features/manager/ManagerMigrationWizardPage"));
const ManagerBucketComparePage = lazy(() => import("./features/manager/ManagerBucketComparePage"));
const ManagerBucketIntegrityPage = lazy(() => import("./features/manager/ManagerBucketIntegrityPage"));
const ManagerBucketPurgePage = lazy(() => import("./features/manager/ManagerBucketPurgePage"));
const ManagerFeatureRulesPage = lazy(() => import("./features/manager/ManagerFeatureRulesPage"));
const ManagerCephKeysPage = lazy(() => import("./features/manager/ManagerCephKeysPage"));
const PortalLayout = lazy(() => import("./features/portal/PortalLayout"));
const PortalDashboard = lazy(() => import("./features/portal/PortalDashboard"));
const PortalAccessKeysPage = lazy(() => import("./features/portal/PortalAccessKeysPage"));
const PortalStorageSpacesPage = lazy(() => import("./features/portal/PortalStorageSpacesPage"));
const PortalStorageSpaceDetailPage = lazy(() => import("./features/portal/PortalStorageSpaceDetailPage"));
const PortalSharesPage = lazy(() => import("./features/portal/PortalSharesPage"));
const PortalCollaboratorAccessPage = lazy(() => import("./features/portal/PortalCollaboratorAccessPage"));
const PortalRequestsPage = lazy(() => import("./features/portal/PortalRequestsPage"));
const PortalHistoryPage = lazy(() => import("./features/portal/PortalHistoryPage"));
const PortalUsagePage = lazy(() => import("./features/portal/PortalUsagePage"));
const PortalSettingsPage = lazy(() => import("./features/portal/PortalSettingsPage"));
const BrowserLayout = lazy(() => import("./features/browser/BrowserLayout"));
const CephAdminLayout = lazy(() => import("./features/cephAdmin/CephAdminLayout"));
const CephAdminDashboard = lazy(() => import("./features/cephAdmin/CephAdminDashboard"));
const CephAdminAccountsPage = lazy(() => import("./features/cephAdmin/CephAdminAccountsPage"));
const CephAdminUsersPage = lazy(() => import("./features/cephAdmin/CephAdminUsersPage"));
const CephAdminBucketsPage = lazy(() => import("./features/cephAdmin/CephAdminBucketsPage"));
const CephAdminBucketDetailPage = lazy(() => import("./features/cephAdmin/CephAdminBucketDetailPage"));
const CephAdminMetricsPage = lazy(() => import("./features/cephAdmin/CephAdminMetricsPage"));
const CephAdminBrowserPage = lazy(() => import("./features/cephAdmin/CephAdminBrowserPage"));
const StorageOpsLayout = lazy(() => import("./features/storageOps/StorageOpsLayout"));
const StorageOpsDashboard = lazy(() => import("./features/storageOps/StorageOpsDashboard"));
const StorageOpsBucketsPage = lazy(() => import("./features/storageOps/StorageOpsBucketsPage"));
const StorageOpsBucketDetailPage = lazy(() => import("./features/storageOps/StorageOpsBucketDetailPage"));
const AccountProfilePage = lazy(() => import("./features/shared/AccountProfilePage"));

const SUPERADMIN_ROLE = "ui_superadmin";
const ADMIN_ROLE = "ui_admin";
const USER_ROLE = "ui_user";
const ADMIN_SETTINGS_PATHS = [
  "/admin/general-settings",
  "/admin/authentication-settings",
  "/admin/manager-settings",
  "/admin/browser-settings",
  "/admin/portal-settings",
  "/admin/key-rotation",
  "/admin/api-tokens",
];

function isAdminSettingsPath(pathname: string): boolean {
  return ADMIN_SETTINGS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const buildAdminNav = (
  portalEnabled: boolean,
  browserEnabled: boolean,
  billingEnabled: boolean,
  usageHistoryEnabled: boolean,
  endpointStatusEnabled: boolean,
  isSuperAdmin: boolean,
  settingsExpanded = false,
  pendingRequestCounts: AdminPendingRequestCounts | null = null,
  locale: UiLanguage = "en",
) => {
  const pageLabels = {
    dashboard: translate({
      en: "Dashboard",
      fr: "Tableau de bord",
      de: "Dashboard",
      zh: "仪表盘",
    }, locale),
    metrics: translate({
      en: "Usage & Metrics",
      fr: "Utilisation et métriques",
      de: "Nutzung und Metriken",
      zh: "用量与指标",
    }, locale),
    users: translate({
      en: "UI Users",
      fr: "Utilisateurs de l’interface",
      de: "UI-Benutzer",
      zh: "界面用户",
    }, locale),
    groups: translate({
      en: "UI Groups",
      fr: "Groupes de l’interface",
      de: "UI-Gruppen",
      zh: "界面用户组",
    }, locale),
    "identity-security": translate({
      en: "Identity Security",
      fr: "Sécurité des identités",
      de: "Identitätssicherheit",
      zh: "身份安全",
    }, locale),
    accounts: translate({
      en: "RGW Accounts",
      fr: "Comptes RGW",
      de: "RGW-Konten",
      zh: "RGW 账户",
    }, locale),
    "rgw-users": translate(messageRGWUsers, locale),
    "shared-connections": translate({
      en: "Shared S3 Connections",
      fr: "Connexions S3 partagées",
      de: "Gemeinsame S3-Verbindungen",
      zh: "共享 S3 连接",
    }, locale),
    "storage-endpoints": translate({
      en: "S3 Endpoints",
      fr: "Points de terminaison S3",
      de: "S3-Endpunkte",
      zh: "S3 端点",
    }, locale),
    "endpoint-status": translate({
      en: "Endpoint Status",
      fr: "État des points de terminaison",
      de: "Endpunktstatus",
      zh: "端点状态",
    }, locale),
    "portal-requests": translate({
      en: "Portal Requests",
      fr: "Demandes du portail",
      de: "Portal-Anfragen",
      zh: "门户请求",
    }, locale),
    billing: translate({
      en: "Billing",
      fr: "Facturation",
      de: "Abrechnung",
      zh: "计费",
    }, locale),
    "usage-history": translate({
      en: "Usage History",
      fr: "Historique d’utilisation",
      de: "Nutzungsverlauf",
      zh: "用量历史",
    }, locale),
    audit: translate({
      en: "Audit trail",
      fr: "Journal d’audit",
      de: "Audit-Protokoll",
      zh: "审计日志",
    }, locale),
    "general-settings": translate(messageGeneral, locale),
    "authentication-settings": translate({
      en: "Authentication",
      fr: "Authentification",
      de: "Authentifizierung",
      zh: "身份认证",
    }, locale),
    "manager-settings": translate({
      en: "Manager",
      fr: "Gestionnaire",
      de: "Verwaltung",
      zh: "管理控制台",
    }, locale),
    "browser-settings": translate({
      en: "Browser",
      fr: "Explorateur",
      de: "Objektbrowser",
      zh: "对象浏览器",
    }, locale),
    "portal-settings": translate({
      en: "Portal",
      fr: "Portail",
      de: "Portal",
      zh: "自助门户",
    }, locale),
    "key-rotation": translate({
      en: "Key Rotation",
      fr: "Rotation des clés",
      de: "Schlüsselrotation",
      zh: "密钥轮换",
    }, locale),
    "api-tokens": translate({
      en: "API tokens",
      fr: "Jetons API",
      de: "API-Token",
      zh: "API 令牌",
    }, locale),
  };
  const pageLink = (key: keyof typeof pageLabels) => ({
    ...workspacePageLink(ADMIN_PAGE_CONTRACTS[key]),
    label: pageLabels[key],
    iconName: resolveSidebarLinkIconName(workspacePageLink(ADMIN_PAGE_CONTRACTS[key])),
  });
  const identityRequestCount = pendingRequestCounts?.identity_link_requests ?? 0;
  const portalRequestCount = pendingRequestCounts?.portal_requests ?? 0;
  const settingsLinks = [
    pageLink("general-settings"),
    pageLink("authentication-settings"),
    pageLink("manager-settings"),
    {
      ...pageLink("browser-settings"),
      disabled: !browserEnabled,
      disabledHint: !browserEnabled ? translate({
        en: "Browser feature is disabled in General settings.",
        fr: "L’explorateur est désactivé dans les paramètres généraux.",
        de: "Der Objektbrowser ist in den allgemeinen Einstellungen deaktiviert.",
        zh: "对象浏览器功能已在常规设置中禁用。",
      }, locale) : undefined,
    },
    {
      ...pageLink("portal-settings"),
      disabled: !portalEnabled,
      disabledHint: !portalEnabled ? translate({
        en: "Portal feature is disabled in General settings.",
        fr: "Le portail est désactivé dans les paramètres généraux.",
        de: "Das Portal ist in den allgemeinen Einstellungen deaktiviert.",
        zh: "自助门户功能已在常规设置中禁用。",
      }, locale) : undefined,
    },
    pageLink("key-rotation"),
    pageLink("api-tokens"),
  ];

  return [
    {
      label: "Overview",
      displayLabel: translate({
        en: "Overview",
        fr: "Vue d’ensemble",
        de: "Übersicht",
        zh: "概览",
      }, locale),
      links: [{ ...pageLink("dashboard"), end: true }],
    },
    {
      label: "Identity & Access",
      displayLabel: translate({
        en: "Identity & Access",
        fr: "Identité et accès",
        de: "Identität und Zugriff",
        zh: "身份与访问",
      }, locale),
      links: [
        pageLink("users"),
        pageLink("groups"),
        {
          ...pageLink("identity-security"),
          iconName: "shield" as const,
          badge: identityRequestCount > 0 ? String(identityRequestCount) : undefined,
          badgeAriaLabel:
            identityRequestCount > 0
              ? translate({
                en: `${identityRequestCount} pending identity link request${identityRequestCount === 1 ? "" : "s"}`,
                fr: `${identityRequestCount} demande${identityRequestCount === 1 ? "" : "s"} de liaison d’identité en attente`,
                de: `${identityRequestCount} ausstehende Identitätsverknüpfungsanfragen`,
                zh: `${identityRequestCount} 条待处理身份关联请求`,
              }, locale)
              : undefined,
          badgeTone: "attention" as const,
        },
      ],
    },
    {
      label: "Managed Tenants",
      displayLabel: translate({
        en: "Managed Tenants",
        fr: "Locataires gérés",
        de: "Verwaltete Mandanten",
        zh: "托管租户",
      }, locale),
      links: [
        pageLink("accounts"),
        pageLink("rgw-users"),
        pageLink("metrics"),
      ],
    },
    {
      label: "Connections",
      displayLabel: translate({
        en: "Connections",
        fr: "Connexions",
        de: "Verbindungen",
        zh: "连接",
      }, locale),
      links: [pageLink("shared-connections")],
    },
    {
      label: "Storage Backends",
      displayLabel: translate({
        en: "Storage Backends",
        fr: "Backends de stockage",
        de: "Speicher-Backends",
        zh: "存储后端",
      }, locale),
      links: [
        pageLink("storage-endpoints"),
        ...(endpointStatusEnabled ? [pageLink("endpoint-status")] : []),
      ],
    },
    {
      label: "Audit & Reporting",
      displayLabel: translate({
        en: "Audit & Reporting",
        fr: "Audit et rapports",
        de: "Audit und Berichte",
        zh: "审计与报表",
      }, locale),
      links: [
        ...(portalEnabled
          ? [
              {
                ...pageLink("portal-requests"),
                badge: portalRequestCount > 0 ? String(portalRequestCount) : undefined,
                badgeAriaLabel:
                  portalRequestCount > 0
                    ? translate({
                      en: `${portalRequestCount} pending Portal request${portalRequestCount === 1 ? "" : "s"}`,
                      fr: `${portalRequestCount} demande${portalRequestCount === 1 ? "" : "s"} du portail en attente`,
                      de: `${portalRequestCount} ausstehende Portal-Anfragen`,
                      zh: `${portalRequestCount} 条待处理门户请求`,
                    }, locale)
                    : undefined,
                badgeTone: "attention" as const,
              },
            ]
          : []),
        ...(billingEnabled ? [pageLink("billing")] : []),
        ...(usageHistoryEnabled ? [pageLink("usage-history")] : []),
        pageLink("audit"),
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            label: "Settings",
      displayLabel: translate({
        en: "Settings",
        fr: "Paramètres",
        de: "Einstellungen",
        zh: "设置",
      }, locale),
            links: settingsLinks,
            collapsed: !settingsExpanded,
          },
        ]
      : []),
  ];
};

function AdminLayoutShell() {
  const { locale } = useI18n();
  const { generalSettings } = useGeneralSettings();
  const location = useLocation();
  const pendingRequestCounts = useAdminPendingRequestCounts();
  const currentUser = readStoredUser();
  const canConfigureApp = isSuperAdminRole(currentUser?.role);
  const adminNav = buildAdminNav(
    generalSettings.portal_enabled,
    generalSettings.browser_enabled,
    generalSettings.billing_enabled,
    generalSettings.usage_history_enabled,
    generalSettings.endpoint_status_enabled,
    canConfigureApp,
    isAdminSettingsPath(location.pathname),
    pendingRequestCounts,
    locale,
  );
  return (
    <Layout
      navSections={adminNav}
      headerTitle="Administration"
      sidebarTitle={locale === "zh" ? "管理后台" : "ADMIN"}
      hideHeader
    />
  );
}

function AdminBillingRoute() {
  const { generalSettings } = useGeneralSettings();
  return generalSettings.billing_enabled ? <BillingPage /> : <FeatureDisabledPage feature="Billing" />;
}

function AdminUsageHistoryRoute() {
  const { generalSettings } = useGeneralSettings();
  return generalSettings.usage_history_enabled ? <UsageHistoryPage /> : <FeatureDisabledPage feature="Usage history" />;
}

function AdminPortalSettingsRoute() {
  const { generalSettings } = useGeneralSettings();
  return generalSettings.portal_enabled ? <AdminPortalSettingsPage /> : <FeatureDisabledPage feature="Portal" />;
}

function AdminEndpointStatusRoute() {
  const { generalSettings } = useGeneralSettings();
  return generalSettings.endpoint_status_enabled
    ? <EndpointStatusPage />
    : <FeatureDisabledPage feature="Endpoint Status" />;
}

function AdminEndpointStatusDetailRoute() {
  const { generalSettings } = useGeneralSettings();
  return generalSettings.endpoint_status_enabled
    ? <EndpointStatusDetailPage />
    : <FeatureDisabledPage feature="Endpoint Status" />;
}

export function createAppRoutes() {
  return createRoutesFromElements(
    <Route element={<Outlet />} errorElement={<RouteErrorPage />}>
      <Route element={<RequireAuth />}>
        <Route index element={<RoleRedirect />} />
        <Route path="/profile" element={<Navigate to="/" replace />} />

        <Route element={<RequireRole roles={[SUPERADMIN_ROLE, ADMIN_ROLE]} />}>
          <Route path="/admin" element={<AdminLayoutShell />}>
            <Route index element={<AdminDashboard />} />
            <Route path="profile" element={<AccountProfilePage />} />
            <Route path="s3-accounts" element={<S3AccountsPage />} />
            <Route path="s3-users" element={<S3UsersPage />} />
            <Route path="s3-connections" element={<S3ConnectionsPage />} />
            <Route path="s3-users/:userId/keys" element={<S3UserKeysPage />} />
            <Route path="storage-endpoints" element={<StorageEndpointsPage />} />
            <Route path="storage-endpoints/:endpointId" element={<StorageEndpointsPage />} />
            <Route path="endpoint-status" element={<AdminEndpointStatusRoute />} />
            <Route path="endpoint-status/:endpointId" element={<AdminEndpointStatusDetailRoute />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="identity-security" element={<IdentitySecurityPage />} />
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="metrics" element={<AdminMetricsPage />} />
            <Route path="portal-requests" element={<AdminPortalRequestsPage />} />
            <Route path="billing" element={<AdminBillingRoute />} />
            <Route path="usage-history" element={<AdminUsageHistoryRoute />} />
            <Route element={<RequireRole roles={[SUPERADMIN_ROLE]} />}>
              <Route path="general-settings" element={<GeneralSettingsPage />} />
              <Route path="authentication-settings" element={<AuthenticationSettingsPage />} />
              <Route path="authentication-settings/oidc/new" element={<AuthProviderPage kind="oidc" />} />
              <Route path="authentication-settings/oidc/providers/:providerId" element={<AuthProviderPage kind="oidc" />} />
              <Route path="authentication-settings/ldap/new" element={<AuthProviderPage kind="ldap" />} />
              <Route path="authentication-settings/ldap/providers/:providerId" element={<AuthProviderPage kind="ldap" />} />
              <Route path="manager-settings" element={<ManagerSettingsPage />} />
              <Route path="portal-settings" element={<AdminPortalSettingsRoute />} />
              <Route path="browser-settings" element={<BrowserSettingsPage />} />
              <Route path="key-rotation" element={<KeyRotationPage />} />
              <Route path="api-tokens" element={<ApiTokensPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole roles={[SUPERADMIN_ROLE, ADMIN_ROLE]} />}>
          <Route element={<RequireCephAdminFeature />}>
            <Route path="/ceph-admin" element={<CephAdminLayout />}>
              <Route index element={<CephAdminDashboard />} />
              <Route path="profile" element={<AccountProfilePage />} />
              <Route path="metrics" element={<CephAdminMetricsPage />} />
              <Route path="accounts" element={<CephAdminAccountsPage />} />
              <Route path="users" element={<CephAdminUsersPage />} />
              <Route path="buckets" element={<CephAdminBucketsPage />} />
              <Route path="buckets/:bucketName" element={<CephAdminBucketDetailPage />} />
              <Route element={<RequireBrowserSurface surface="ceph_admin" />}>
                <Route path="browser" element={<CephAdminBrowserPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole roles={[SUPERADMIN_ROLE, ADMIN_ROLE, USER_ROLE]} />}>
          <Route element={<RequireStorageOpsFeature />}>
            <Route path="/storage-ops" element={<StorageOpsLayout />}>
              <Route index element={<StorageOpsDashboard />} />
              <Route path="profile" element={<AccountProfilePage />} />
              <Route path="buckets" element={<StorageOpsBucketsPage />} />
              <Route path="buckets/:bucketName" element={<StorageOpsBucketDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole roles={[SUPERADMIN_ROLE, ADMIN_ROLE, USER_ROLE]} />}>
          <Route element={<RequireManagerFeature />}>
            <Route path="/manager" element={<ManagerLayout />}>
              <Route index element={<ManagerDashboard />} />
              <Route path="profile" element={<AccountProfilePage />} />
              <Route path="buckets" element={<BucketsPage />} />
              <Route path="buckets/:bucketName" element={<BucketDetailPage />} />
              <Route element={<RequireBrowserSurface surface="manager" />}>
                <Route path="browser" element={<ManagerBrowserPage />} />
              </Route>
              <Route path="metrics" element={<ManagerMetricsPage />} />
              <Route element={<RequireManagerIamFeature />}>
                <Route path="users" element={<ManagerUsersPage />} />
                <Route path="users/:userName/keys" element={<ManagerUserKeysPage />} />
                <Route path="users/:userName/policies" element={<ManagerUserPoliciesPage />} />
                <Route path="groups" element={<ManagerGroupsPage />} />
                <Route path="groups/:groupName/policies" element={<ManagerGroupPoliciesPage />} />
                <Route path="groups/:groupName/users" element={<ManagerGroupUsersPage />} />
                <Route path="roles" element={<ManagerRolesPage />} />
                <Route path="roles/:roleName/policies" element={<ManagerRolePoliciesPage />} />
                <Route path="iam/policies" element={<PoliciesPage />} />
              </Route>
              <Route path="topics" element={<TopicsPage />} />
              <Route path="ceph/keys" element={<ManagerCephKeysPage />} />
              <Route element={<RequireManagerBucketCompareFeature />}>
                <Route path="bucket-compare" element={<ManagerBucketComparePage />} />
              </Route>
              <Route element={<RequireManagerBucketIntegrityFeature />}>
                <Route path="bucket-integrity" element={<ManagerBucketIntegrityPage />} />
              </Route>
              <Route element={<RequireManagerBucketPurgeFeature />}>
                <Route path="bucket-purge" element={<ManagerBucketPurgePage />} />
              </Route>
              <Route element={<RequireManagerFeatureRulesTool />}>
                <Route path="feature-rules" element={<ManagerFeatureRulesPage />} />
              </Route>
              <Route element={<RequireManagerMigrationFeature />}>
                <Route path="migrations" element={<ManagerMigrationsPage />} />
                <Route path="migrations/new" element={<ManagerMigrationWizardPage />} />
                <Route path="migrations/:migrationId" element={<ManagerMigrationDetailPage />} />
              </Route>
            </Route>
          </Route>

          <Route element={<RequireBrowserSurface surface="root" />}>
            <Route path="/browser" element={<BrowserLayout />}>
              <Route index element={<BrowserPage />} />
              <Route path="profile" element={<AccountProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole roles={[SUPERADMIN_ROLE, ADMIN_ROLE, USER_ROLE]} />}>
          <Route element={<RequirePortalAccess />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="profile" element={<AccountProfilePage />} />
              <Route path="storage-spaces" element={<PortalStorageSpacesPage />} />
              <Route path="storage-spaces/:spaceId" element={<PortalStorageSpaceDetailPage />} />
              <Route path="access-keys" element={<PortalAccessKeysPage />} />
              <Route path="shares" element={<PortalSharesPage />} />
              <Route path="shares/:userId" element={<PortalCollaboratorAccessPage />} />
              <Route path="requests" element={<PortalRequestsPage />} />
              <Route path="history" element={<PortalHistoryPage />} />
              <Route path="usage" element={<PortalUsagePage />} />
              <Route path="settings" element={<PortalSettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup/first-admin" element={<FirstAdminSetupPage />} />
      <Route path="/oidc/:provider/callback" element={<OidcCallbackPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  );
}

export default function AppRouter() {
  const router = useMemo(() => {
    return createBrowserRouter(createAppRoutes(), {
      future: { v7_relativeSplatPath: true },
    });
  }, []);
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
