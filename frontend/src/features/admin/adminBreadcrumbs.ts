/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { PageBreadcrumb } from "../../components/PageHeader";
import {
  ADMIN_PAGE_CONTRACTS as ADMIN_NAVIGATION_CONTRACTS,
  buildWorkspacePageBreadcrumbs,
  type WorkspacePageContract,
} from "../../navigation/workspacePages";

type AdminPageId = keyof typeof ADMIN_NAVIGATION_CONTRACTS;
type GovernedAdminPageId =
  | "accounts"
  | "groups"
  | "rgw-users"
  | "shared-connections"
  | "storage-endpoints"
  | "users";

type AdminPageContract = {
  title: string;
  navigation: WorkspacePageContract;
  governanceArea: "accounts" | "connections" | "endpoints" | "identity";
};

export const ADMIN_PAGE_CONTRACTS: Record<GovernedAdminPageId, AdminPageContract> = {
  accounts: {
    title: ADMIN_NAVIGATION_CONTRACTS.accounts.label,
    navigation: ADMIN_NAVIGATION_CONTRACTS.accounts,
    governanceArea: "accounts",
  },
  groups: {
    title: ADMIN_NAVIGATION_CONTRACTS.groups.label,
    navigation: ADMIN_NAVIGATION_CONTRACTS.groups,
    governanceArea: "identity",
  },
  "rgw-users": {
    title: ADMIN_NAVIGATION_CONTRACTS["rgw-users"].label,
    navigation: ADMIN_NAVIGATION_CONTRACTS["rgw-users"],
    governanceArea: "accounts",
  },
  "shared-connections": {
    title: ADMIN_NAVIGATION_CONTRACTS["shared-connections"].label,
    navigation: ADMIN_NAVIGATION_CONTRACTS["shared-connections"],
    governanceArea: "connections",
  },
  "storage-endpoints": {
    title: ADMIN_NAVIGATION_CONTRACTS["storage-endpoints"].label,
    navigation: ADMIN_NAVIGATION_CONTRACTS["storage-endpoints"],
    governanceArea: "endpoints",
  },
  users: {
    title: ADMIN_NAVIGATION_CONTRACTS.users.label,
    navigation: ADMIN_NAVIGATION_CONTRACTS.users,
    governanceArea: "identity",
  },
};

export function adminPageBreadcrumbs(
  pageId: AdminPageId,
  ...trailingBreadcrumbs: PageBreadcrumb[]
): PageBreadcrumb[] {
  return buildWorkspacePageBreadcrumbs(
    "admin",
    ADMIN_NAVIGATION_CONTRACTS[pageId],
    ...trailingBreadcrumbs,
  );
}

/** Localize navigation labels while preserving route and trailing entity names. */
export function localizedAdminPageBreadcrumbs(
  pageId: AdminPageId,
  locale: "en" | "fr" | "de" | "zh",
  ...trailingBreadcrumbs: PageBreadcrumb[]
): PageBreadcrumb[] {
  const crumbs = adminPageBreadcrumbs(pageId, ...trailingBreadcrumbs);
  if (locale !== "zh") return crumbs;
  const labels: Partial<Record<AdminPageId, string>> = {
    accounts: "RGW 账户",
    dashboard: "管理概览",
    "endpoint-status": "端点状态",
    "general-settings": "常规设置",
    "authentication-settings": "身份认证",
    "manager-settings": "管理控制台",
    "browser-settings": "对象浏览器",
    "key-rotation": "密钥轮换",
    "api-tokens": "API 令牌",
    metrics: "用量与指标",
    "storage-endpoints": "S3 端点",
  };
  return crumbs.map((crumb, index) => ({ ...crumb,
    label: index === 0 ? "管理后台" : index === 1 ? labels[pageId] ?? crumb.label : crumb.label,
  }));
}
