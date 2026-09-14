/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";
import type { ManagerZhMessages } from "./managerI18n";

export const managerGroupsZhMessages: ManagerZhMessages = {
  "Unexpected error": "发生意外错误",
  Breadcrumb: "面包屑导航",
  "Next step": "下一步",
  "IAM Groups": "IAM 用户组",
  "Manage groups using the account root keys.": "使用账户根密钥管理 IAM 用户组。",
  "Create group": "创建用户组",
  "Group created": "用户组已创建",
  "Group deleted": "用户组已删除",
  "Delete IAM group?": "删除 IAM 用户组？",
  "Permanently remove this IAM group from the selected account.": "从所选账户中永久删除此 IAM 用户组。",
  "Delete group": "删除用户组",
  "IAM group": "IAM 用户组",
  "Members will lose permissions inherited only through this group.": "成员将失去仅通过此用户组继承的权限。",
  Name: "名称",
  Policies: "策略",
  Actions: "操作",
  Members: "成员",
  "Deleting...": "正在删除…",
  Delete: "删除",
  "Select an account before managing IAM groups": "请先选择账户，再管理 IAM 用户组",
  "Groups are scoped to an execution context. Choose an account to list membership containers and attach shared policies.":
    "用户组属于特定执行上下文。请选择账户以列出成员容器并附加共享策略。",
  "Open users": "打开用户",
  "IAM groups are unavailable for managed S3 user contexts": "托管 S3 用户上下文无法使用 IAM 用户组",
  "Switch to an RGW account or S3 connection context to manage account-level IAM groups.":
    "请切换到 RGW 账户或 S3 连接上下文，以管理账户级 IAM 用户组。",
  Groups: "用户组",
  "Search by name or ARN": "按名称或 ARN 搜索",
  "Loading groups...": "正在加载用户组…",
  "Unable to load groups.": "无法加载用户组。",
  "No groups.": "没有用户组。",
  "Create IAM group": "创建 IAM 用户组",
  "Define the group and attach its managed and inline policies in one focused workflow.":
    "在同一流程中定义用户组，并附加托管策略和内联策略。",
  Create: "创建",
  "Back to groups": "返回用户组",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.":
    "您有尚未应用的更改。关闭此页面将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  Identity: "身份信息",
  "Group name": "用户组名称",
  "Group name is required.": "必须填写用户组名称。",
  "Creating...": "正在创建…",
  "Attach policies": "附加策略",
  "Select managed policies to link immediately.": "选择要立即关联的托管策略。",
  "No policies available. Create them first.": "没有可用策略。请先创建策略。",
  "Policies can also be attached later from the group page.": "也可以稍后从用户组页面附加策略。",
  "Inline policy name is required.": "必须填写内联策略名称。",
  "Inline policy must be valid JSON.": "内联策略必须是有效的 JSON。",
  "Group members": "用户组成员",
  "Manage IAM group membership.": "管理 IAM 用户组成员。",
  Users: "用户",
  "IAM features are disabled for standalone S3 users. Select an S3 Account to continue.":
    "独立 S3 用户已禁用 IAM 功能。请选择一个 S3 账户以继续。",
  "Group not specified.": "未指定用户组。",
  "Select an account before managing groups.": "请先选择账户，再管理用户组。",
  "User added to group": "用户已加入用户组",
  "User removed from group": "用户已从用户组移除",
  "Remove user from group?": "从用户组中移除用户？",
  "Detach this IAM user from the selected group.": "解除此 IAM 用户与所选用户组的关联。",
  "Remove user": "移除用户",
  Group: "用户组",
  User: "用户",
  "Permissions inherited only through this group will no longer apply to the user.":
    "仅通过此用户组继承的权限将不再应用于该用户。",
  "Removing...": "正在移除…",
  Remove: "移除",
  "← Back to groups": "← 返回用户组",
  "Attached policies": "已附加策略",
  Refresh: "刷新",
  "No IAM users available to add. Create one before managing this group.":
    "没有可添加的 IAM 用户。请先创建用户，再管理此用户组。",
  "Select an existing user": "选择现有用户",
  "Adding...": "正在添加…",
  Add: "添加",
  "Users come from IAM. Add them here to attach them to the group.":
    "这些用户来自 IAM。在此添加用户以将其加入用户组。",
  "Members of this group.": "此用户组的成员。",
  "Loading members...": "正在加载成员…",
  "Unable to load users.": "无法加载用户。",
  "No members in this group.": "此用户组没有成员。",
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
  "Admin credentials are not configured for this account": "此账户未配置管理凭据",
  "Sessions cannot assume this context": "会话无法代入此上下文",
  "Endpoint override is not allowed for this session": "此会话不允许覆盖端点",
  "Endpoint is not allowed for this session": "此会话不允许使用该端点",
  "Custom S3 endpoint is not allowed by outbound policy": "出站策略不允许使用自定义 S3 端点",
};

export function managerGroupsResultCount(locale: UiLanguage, count: number): string {
  return locale === "zh"
    ? `${count.toLocaleString("zh-CN")} 条结果`
    : `${count} result(s)`;
}

const zhErrorPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["Unable to list IAM groups: ", "无法列出 IAM 用户组："],
  ["Unable to create IAM group: ", "无法创建 IAM 用户组："],
  ["Unable to delete IAM group: ", "无法删除 IAM 用户组："],
  ["Unable to list IAM group members: ", "无法列出 IAM 用户组成员："],
  ["Unable to add user to group: ", "无法将用户添加到用户组："],
  ["Unable to remove user from group: ", "无法从用户组中移除用户："],
  ["Unable to list IAM users: ", "无法列出 IAM 用户："],
  ["Unable to list IAM policies: ", "无法列出 IAM 策略："],
  ["Unable to fetch IAM policy: ", "无法获取 IAM 策略："],
  ["Unable to attach policy to group: ", "无法向用户组附加策略："],
  ["Unable to put inline policy on group: ", "无法为用户组保存内联策略："],
];

export function localizeManagerGroupsError(locale: UiLanguage, message: string): string {
  if (locale !== "zh") return message;
  const exact = managerGroupsZhMessages[message];
  if (exact) return exact;
  const prefix = zhErrorPrefixes.find(([source]) => message.startsWith(source));
  return prefix ? `${prefix[1]}${message.slice(prefix[0].length)}` : message;
}
