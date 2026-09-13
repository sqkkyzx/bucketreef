/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import type { ManagerZhMessages } from "./managerI18n";

export const managerShellZhMessages = {
  "Metrics availability is loading for this context.": "正在加载当前上下文的指标可用状态。",
  "Metrics are disabled for this context.": "当前上下文已禁用指标。",
  "Metrics are unavailable for this endpoint capabilities.": "此端点的功能配置不支持指标。",
  "No account selected": "未选择账户",
  Account: "账户",
  Overview: "概览",
  Dashboard: "仪表盘",
  "Usage & Metrics": "用量与指标",
  Storage: "存储",
  Buckets: "存储桶",
  Browser: "对象浏览器",
  Events: "事件",
  "SNS Topics": "SNS 主题",
  Users: "用户",
  Groups: "用户组",
  Roles: "角色",
  Policies: "策略",
  "Access keys": "访问密钥",
  Tools: "工具",
  "Feature rules": "功能规则",
  Compare: "比较",
  Integrity: "完整性",
  Purge: "清理",
  Migration: "迁移",
  Manager: "管理控制台",
  "Access denied for /manager. Check your account permissions or contact an administrator.":
    "无法访问 /manager。请检查账户权限或联系管理员。",
} as const satisfies ManagerZhMessages;
