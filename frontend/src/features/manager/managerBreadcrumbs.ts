/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { PageBreadcrumb } from "../../components/PageHeader";
import {
  MANAGER_PAGE_CONTRACTS,
  buildWorkspacePageBreadcrumbs,
} from "../../navigation/workspacePages";

type ManagerPageId = keyof typeof MANAGER_PAGE_CONTRACTS;

export function managerPageBreadcrumbs(
  pageId: ManagerPageId,
  ...trailingBreadcrumbs: PageBreadcrumb[]
): PageBreadcrumb[] {
  return buildWorkspacePageBreadcrumbs(
    "manager",
    MANAGER_PAGE_CONTRACTS[pageId],
    ...trailingBreadcrumbs,
  );
}

/** Localize navigation labels while preserving routes and trailing entity names. */
export function localizedManagerPageBreadcrumbs(
  pageId: ManagerPageId,
  locale: "en" | "fr" | "de" | "zh",
  ...trailingBreadcrumbs: PageBreadcrumb[]
): PageBreadcrumb[] {
  const crumbs = managerPageBreadcrumbs(pageId, ...trailingBreadcrumbs);
  if (locale !== "zh") return crumbs;
  const labels: Partial<Record<ManagerPageId, string>> = {
    dashboard: "概览",
    metrics: "用量与指标",
    buckets: "存储桶",
    browser: "对象浏览器",
    topics: "SNS 主题",
    users: "用户",
    groups: "用户组",
    roles: "角色",
    policies: "策略",
    "ceph-keys": "访问密钥",
    "feature-rules": "功能规则",
    compare: "比较",
    integrity: "完整性",
    purge: "清理",
    migration: "迁移",
    profile: "个人资料",
  };
  return crumbs.map((crumb, index) => ({
    ...crumb,
    label: index === 0 ? "管理控制台" : index === 1 ? labels[pageId] ?? crumb.label : crumb.label,
  }));
}
