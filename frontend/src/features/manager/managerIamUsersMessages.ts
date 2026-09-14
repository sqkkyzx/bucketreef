/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";
import type { I18nMessage } from "../../i18n";
import type { ManagerZhMessages } from "./managerI18n";

export const managerIamUsersZhMessages: ManagerZhMessages = {
  "Unexpected error": "发生未知错误",
  "User created": "用户已创建",
  "User deleted": "用户已删除",
  "Access key created": "访问密钥已创建",
  "Access key deleted": "访问密钥已删除",
  "Access key enabled": "访问密钥已启用",
  "Access key disabled": "访问密钥已禁用",
  "Delete IAM user?": "删除 IAM 用户？",
  "Permanently remove this IAM user from the selected account.":
    "从所选账户中永久删除此 IAM 用户。",
  "Delete user": "删除用户",
  "IAM user": "IAM 用户",
  "Credentials and permissions attached to this user will no longer grant access.":
    "此用户关联的凭据和权限将不再授予访问权限。",
  Name: "名称",
  Groups: "用户组",
  Policies: "策略",
  Actions: "操作",
  Keys: "密钥",
  "No groups/policies or access keys assigned": "尚未分配用户组、策略或访问密钥",
  "No groups or policies assigned": "尚未分配用户组或策略",
  "No access keys registered": "尚未注册访问密钥",
  "Managed private access identity": "托管私有访问身份",
  "Private access": "私有访问",
  "Warning: user might lack necessary permissions": "警告：用户可能缺少必要权限",
  "Delete the linked private connection instead": "请改为删除关联的私有连接",
  "Deleting...": "正在删除…",
  Delete: "删除",
  Users: "用户",
  "Create/delete via the account root credentials. Optionally generate an access key on creation.":
    "使用账户根凭据创建或删除 IAM 用户。创建时可选择生成访问密钥。",
  "Create user": "创建用户",
  "Create my private access": "创建我的私有访问",
  "Copy these values now; the secret will only be shown once.":
    "请立即复制这些值；秘密访问密钥仅显示一次。",
  "Access key": "访问密钥",
  "Secret key": "秘密访问密钥",
  Copy: "复制",
  "Not provided": "未提供",
  "Manage keys": "管理密钥",
  "Copied to clipboard.": "已复制到剪贴板。",
  "Unable to copy. Select and copy this value manually.":
    "无法复制。请选中并手动复制此值。",
  "Select an account before managing IAM users": "请先选择账户，再管理 IAM 用户",
  "Users are created within an execution context. Choose an account to list identities, generate keys, and attach policies.":
    "用户创建在执行上下文中。请选择账户，以列出身份、生成密钥和附加策略。",
  "Open buckets": "打开存储桶",
  "IAM users are unavailable for managed S3 user contexts":
    "托管 S3 用户上下文无法使用 IAM 用户功能",
  "Switch to an RGW account or S3 connection context to manage account-level IAM identities.":
    "请切换到 RGW 账户或 S3 连接上下文，以管理账户级 IAM 身份。",
  "Search by name or ARN": "按名称或 ARN 搜索",
  "Loading users...": "正在加载用户…",
  "Unable to load users.": "无法加载用户。",
  "No users.": "没有用户。",
  "Create IAM user": "创建 IAM 用户",
  "Create the identity, attach managed or inline policies, and optionally generate its first access key.":
    "创建身份并附加托管策略或内联策略，还可选择生成首个访问密钥。",
  Create: "创建",
  "Back to users": "返回用户",
  "← Back to users": "← 返回用户",
  Breadcrumb: "面包屑导航",
  "Next step": "下一步",
  "Sort by": "排序字段",
  Direction: "排序方向",
  Ascending: "升序",
  Descending: "降序",
  Identity: "身份",
  "User name": "用户名",
  "User name is required.": "必须填写用户名。",
  "Auto-generate an access key (shown only once)": "自动生成访问密钥（仅显示一次）",
  "Add to groups (optional)": "添加到用户组（可选）",
  "Launch permissions by linking groups before creation.":
    "创建用户前将其加入用户组，以便立即授予相应权限。",
  Hide: "隐藏",
  Show: "显示",
  "No groups available.": "没有可用的用户组。",
  "Attach policies (optional)": "附加策略（可选）",
  "Bind JSON policies now or skip and attach later.":
    "现在关联 JSON 策略，也可跳过并稍后附加。",
  "No policies available. Create them in the Policies tab.":
    "没有可用的策略。请先在“策略”页签中创建。",
  "Policies must be created first in the Policies tab.":
    "必须先在“策略”页签中创建策略。",
  "Inline policy name is required.": "必须填写内联策略名称。",
  "Inline policy must be valid JSON.": "内联策略必须是有效的 JSON。",
  "Creating...": "正在创建…",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.":
    "存在尚未应用的更改。关闭此页面将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  "Delete IAM access key?": "删除 IAM 访问密钥？",
  "Permanently remove this access key from the IAM user.":
    "从此 IAM 用户中永久删除该访问密钥。",
  "Delete key": "删除密钥",
  User: "用户",
  "Applications using this key will immediately lose access.":
    "使用此密钥的应用将立即失去访问权限。",
  "Disable IAM access key?": "禁用 IAM 访问密钥？",
  "Temporarily prevent this access key from authenticating.":
    "暂时禁止使用此访问密钥进行认证。",
  "Disable key": "禁用密钥",
  "Applications using this key will lose access until the key is enabled again.":
    "使用此密钥的应用将失去访问权限，直到密钥重新启用。",
  Status: "状态",
  Active: "已启用",
  Inactive: "已禁用",
  Enabled: "已启用",
  Disabled: "已禁用",
  Suspended: "已暂停",
  "Created on": "创建时间",
  "Update the linked private connection instead": "请改为更新关联的私有连接",
  "Saving...": "正在保存…",
  Disable: "禁用",
  Enable: "启用",
  "User access keys": "用户访问密钥",
  "Rotate IAM access keys for a specific user.": "轮换指定用户的 IAM 访问密钥。",
  "Access keys": "访问密钥",
  "IAM users are not available for standalone S3 users. Select an S3 Account to continue.":
    "独立 S3 用户无法使用 IAM 用户功能。请选择一个 S3 账户后继续。",
  "User not specified.": "未指定用户。",
  "Select an account before managing keys.": "请先选择账户，再管理密钥。",
  "IAM access keys": "IAM 访问密钥",
  "The secret is shown only once.": "秘密访问密钥仅显示一次。",
  "Copy these values now": "请立即复制这些值",
  "Attached policies": "已附加策略",
  "New key": "新建密钥",
  "Loading keys...": "正在加载密钥…",
  "Unable to load keys.": "无法加载密钥。",
  "No keys for this user.": "此用户没有访问密钥。",
  "This IAM user belongs to a managed private access; delete its private connection instead":
    "此 IAM 用户属于托管私有访问；请改为删除其私有连接",
  "Managed private access IAM users cannot receive keys through the generic endpoint":
    "无法通过通用接口为托管私有访问 IAM 用户创建密钥",
  "This key belongs to a managed private access; update or delete its private connection instead":
    "此密钥属于托管私有访问；请改为更新或删除其私有连接",
  "This key belongs to a managed private access; delete its private connection instead":
    "此密钥属于托管私有访问；请改为删除其私有连接",
  "Execution context credentials are missing": "缺少执行上下文凭据",
  "IAM endpoint is not configured": "尚未配置 IAM 端点",
  "Account context unavailable": "账户上下文不可用",
  "IAM management not allowed for this account": "此账户不允许管理 IAM",
  "IAM is disabled for this endpoint": "此端点已禁用 IAM",
  "Manager feature is disabled": "管理控制台功能已禁用",
  "Not authorized": "无权执行此操作",
  "Invalid account identifier": "账户标识符无效",
  "Invalid connection identifier": "连接标识符无效",
  "Invalid S3 user identifier": "S3 用户标识符无效",
  "S3Account id required": "必须提供 S3 账户 ID",
  "S3Account not found": "未找到 S3 账户",
  "S3Connection not found": "未找到 S3 连接",
  "Not authorized for this account": "无权访问此账户",
  "Not authorized for this S3 user": "无权访问此 S3 用户",
  "Connection is not authorized in this workspace": "此工作区无权使用该连接",
  "S3Account context unavailable for session": "当前会话无法使用 S3 账户上下文",
  "S3 user not found": "未找到 S3 用户",
  "Access key not found": "未找到访问密钥",
  "Admin credentials are not configured for this account": "此账户未配置管理凭据",
  "Sessions cannot assume this context": "会话无法代入此上下文",
  "Endpoint override is not allowed for this session": "此会话不允许覆盖端点",
  "Endpoint is not allowed for this session": "此会话不允许使用该端点",
  "Custom S3 endpoint is not allowed by outbound policy": "出站策略不允许使用自定义 S3 端点",
};

const isChinese = (locale: UiLanguage): boolean => locale === "zh";

export function managerIamUserResultCount(locale: UiLanguage, count: number): string {
  return isChinese(locale)
    ? `${count.toLocaleString("zh-CN")} 条结果`
    : `${count} result(s)`;
}

export function managerIamSelectedCount(locale: UiLanguage, count: number): string {
  return isChinese(locale)
    ? `已选择 ${count.toLocaleString("zh-CN")} 项`
    : `${count} selected`;
}

export function managerIamKeyCount(locale: UiLanguage, count: number): string {
  if (isChinese(locale)) return `${count.toLocaleString("zh-CN")} 个密钥`;
  return `${count} key${count === 1 ? "" : "s"}`;
}

export function managerIamUserKeyCreatedTitle(
  locale: UiLanguage,
  userName: string,
): string {
  return isChinese(locale) ? `已为 ${userName} 创建密钥` : `Key created for ${userName}`;
}

export function managerIamPrivateConnectionCreatedMessage(
  connectionName: string,
): I18nMessage {
  return {
    en: `Private connection ${connectionName} created without exposing its secret.`,
    zh: `已创建私有连接“${connectionName}”，且未公开其秘密访问密钥。`,
  };
}

export function managerIamKeyStatus(locale: UiLanguage, status: string): string {
  if (!isChinese(locale)) return status;
  return managerIamUsersZhMessages[status] ?? status;
}

const zhErrorPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["Unable to list IAM users: ", "无法列出 IAM 用户："],
  ["Unable to create IAM user: ", "无法创建 IAM 用户："],
  ["Unable to fetch IAM user: ", "无法获取 IAM 用户："],
  ["Unable to delete IAM user: ", "无法删除 IAM 用户："],
  ["Unable to list IAM access keys: ", "无法列出 IAM 访问密钥："],
  ["Unable to create IAM access key: ", "无法创建 IAM 访问密钥："],
  ["Unable to update IAM access key: ", "无法更新 IAM 访问密钥："],
  ["Unable to delete IAM access key: ", "无法删除 IAM 访问密钥："],
  ["Unable to list IAM groups: ", "无法列出 IAM 用户组："],
  ["Unable to list IAM policies: ", "无法列出 IAM 策略："],
  ["Unable to fetch IAM policy: ", "无法获取 IAM 策略："],
  ["Unable to add user to group: ", "无法将用户添加到用户组："],
  ["Unable to attach policy to user: ", "无法向用户附加策略："],
  ["Unable to put inline policy on user: ", "无法为用户保存内联策略："],
];

export function localizeManagerIamUsersError(
  locale: UiLanguage,
  message: string,
): string {
  if (!isChinese(locale)) return message;
  const exact = managerIamUsersZhMessages[message];
  if (exact) return exact;
  const prefix = zhErrorPrefixes.find(([source]) => message.startsWith(source));
  return prefix ? `${prefix[1]}${message.slice(prefix[0].length)}` : message;
}
