/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { useCallback } from "react";

import { useI18n, type I18nMessage } from "../../i18n";
import type { PageBreadcrumb } from "../../components/PageHeader";

const zhMessages: Readonly<Record<string, string>> = {
  "Clear all": "全部清除",
  Admin: "管理员",
  Actions: "操作",
  Approve: "批准",
  Authentication: "身份认证",
  "Auth method": "认证方式",
  Breadcrumb: "面包屑",
  Cancel: "取消",
  "Claimed email": "声明的邮箱",
  Close: "关闭",
  Current: "当前",
  Expires: "过期时间",
  "Identity Security": "身份安全",
  "Identity link approved.": "身份关联已批准。",
  "Identity link rejected.": "身份关联已拒绝。",
  "Identity security views": "身份安全视图",
  "Last activity": "最后活动时间",
  "Local account": "本地账户",
  Network: "网络",
  "No UI access": "无界面访问权限",
  "Not applicable": "不适用",
  Passkey: "通行密钥",
  Password: "密码",
  Provider: "身份提供商",
  Reject: "拒绝",
  Retry: "重试",
  Revoke: "撤销",
  Revoked: "已撤销",
  Role: "角色",
  "S3 access key": "S3 访问密钥",
  "S3 session": "S3 会话",
  "Session revoked.": "会话已撤销。",
  Superadmin: "超级管理员",
  Unknown: "未知",
  User: "用户",
  "Unable to load identity security data.": "无法加载身份安全数据。",
  "Unable to update the identity request.": "无法更新身份关联请求。",
  "Unable to revoke the session.": "无法撤销会话。",
  "Review external identity link requests and manage active platform sessions within your administrative scope.":
    "审核外部身份关联请求，并管理您管理范围内的有效平台会话。",
  "Loading identity security data...": "正在加载身份安全数据…",
  "Link requests": "关联请求",
  "Active sessions": "有效会话",
  "External identity link requests": "外部身份关联请求",
  "Decide only when the external identity and local account have been verified through a trusted channel.":
    "仅在通过可信渠道核实外部身份和本地账户后再作决定。",
  Refresh: "刷新",
  "Loading identity link requests...": "正在加载身份关联请求…",
  "Unable to load identity link requests.": "无法加载身份关联请求。",
  "No pending identity link requests.": "没有待处理的身份关联请求。",
  "Platform sessions": "平台会话",
  "Revoke a session to remove its access immediately. Only sessions inside your administrative scope are shown.":
    "撤销会话会立即移除其访问权限。这里只显示您管理范围内的会话。",
  "Loading platform sessions...": "正在加载平台会话…",
  "Unable to load platform sessions.": "无法加载平台会话。",
  "No active sessions.": "没有有效会话。",
  "Approve identity link": "批准身份关联",
  "Reject identity link request": "拒绝身份关联请求",
  "This external identity will be linked to the selected local account.": "此外部身份将关联到所选本地账户。",
  "This request will be closed without linking the external identity.": "此请求将关闭，且不会关联外部身份。",
  "Approve link": "批准关联",
  "Reject request": "拒绝请求",
  "Revoke session": "撤销会话",
  "This session will lose access immediately.": "此会话将立即失去访问权限。",
  Session: "会话",
  "Verify with passkey": "使用通行密钥验证",
  "Confirm your identity to continue this sensitive action in the current session.":
    "请验证身份，以在当前会话中继续执行此敏感操作。",
  "Passkey verification was cancelled or timed out. Please try again.": "通行密钥验证已取消或超时，请重试。",
  "Passkey verification failed. Please try again.": "通行密钥验证失败，请重试。",

  "(none)": "（无）",
  "IAM user": "IAM 用户",
  "Account user": "账户用户",
  "S3 user": "S3 用户",
  "Unexpected error": "发生意外错误",
  "Connection created.": "连接已创建。",
  "Connection updated.": "连接已更新。",
  "Connection deleted.": "连接已删除。",
  "Connection remediated and activated for Manager.": "连接已修复并在管理控制台中启用。",
  "Connection activated.": "连接已启用。",
  "Connection disabled.": "连接已停用。",
  Select: "选择",
  "Select all filtered connections": "选择筛选结果中的所有连接",
  Name: "名称",
  Endpoint: "端点",
  Status: "状态",
  "Remediation required": "需要修复",
  Active: "有效",
  Inactive: "未启用",
  "Created by": "创建者",
  "UI Users / Groups": "界面用户 / 用户组",
  "Saving...": "正在保存…",
  "Activate in Manager": "在管理控制台中启用",
  Deactivate: "停用",
  Activate: "启用",
  Edit: "编辑",
  Delete: "删除",
  "Shared S3 Connections": "共享 S3 连接",
  "Admin-managed S3 connections shared with linked UI users.": "由管理员管理并与关联界面用户共享的 S3 连接。",
  "Add connection": "添加连接",
  "Search name, endpoint, created by, group, or tag...": "搜索名称、端点、创建者、用户组或标签…",
  "Active filters summary": "当前筛选条件摘要",
  "Activating...": "正在启用…",
  "Activate selected": "启用所选项",
  "Disabling...": "正在停用…",
  "Disable selected": "停用所选项",
  "Delete selected": "删除所选项",
  "Loading connections...": "正在加载连接…",
  "Unable to load connections.": "无法加载连接。",
  "No connections.": "没有连接。",
  "Add S3 connection": "添加 S3 连接",
  "Configure endpoint access, credentials, and workspace availability for this shared connection.":
    "配置此共享连接的端点访问、凭据和工作区可用性。",
  Create: "创建",
  "Back to connections": "返回连接列表",
  "Create shared S3 connection": "创建共享 S3 连接",
  "Creating...": "正在创建…",
  "Add a tag for this shared connection": "为此共享连接添加标签",
  "Loading existing tag catalog...": "正在加载现有标签目录…",
  "Unable to load tag catalog.": "无法加载标签目录。",
  Credentials: "凭据",
  "Access key ID": "访问密钥 ID",
  "Secret access key": "秘密访问密钥",
  Access: "访问权限",
  "Visibility: Shared": "可见性：共享",
  "Admin connections are always shared with linked UI users.": "管理员连接始终与关联的界面用户共享。",
  "Manager-only execution": "仅限管理控制台执行",
  "Shared connections are never exposed to Browser. Browser users must create a private connection.":
    "共享连接不会显示在对象浏览器中。对象浏览器用户必须创建私有连接。",
  "Manage endpoint access, credentials, workspace availability, and UI associations for this shared connection.":
    "管理此共享连接的端点访问、凭据、工作区可用性和界面关联。",
  "Edit shared S3 connection": "编辑共享 S3 连接",
  Save: "保存",
  General: "常规",
  "Linked UI users": "关联的界面用户",
  "Linked UI groups": "关联的界面用户组",
  "Shared connection configuration sections": "共享连接配置分区",
  "Leave blank to keep the current keys.": "留空以保留当前密钥。",
  "Access and credential metadata": "访问与凭据元数据",
  "Store owner context for keys imported from manager/ceph-admin flows.":
    "保存从管理控制台或 Ceph 管理流程导入的密钥所有者上下文。",
  "Browser access is disabled for all shared connections.": "所有共享连接均已停用对象浏览器访问。",
  "Owner type": "所有者类型",
  "Owner identifier": "所有者标识",
  "Add UI users": "添加界面用户",
  "Add UI groups": "添加界面用户组",
  Group: "用户组",
  Remove: "移除",
  "No linked users yet.": "尚未关联界面用户。",
  "No linked groups yet.": "尚未关联界面用户组。",
  "(filter by email)": "（按邮箱筛选）",
  "(filter by name)": "（按名称筛选）",
  "Search UI users": "搜索界面用户",
  "Search UI groups": "搜索界面用户组",
  "Loading UI users...": "正在加载界面用户…",
  "Loading UI groups...": "正在加载界面用户组…",
  "Delete selected connections": "删除所选连接",
  "Deleting...": "正在删除…",
  "This will permanently delete the connection and its credentials.": "这将永久删除该连接及其凭据。",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.": "您有尚未应用的更改。关闭此页面将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  "Enter a valid endpoint URL.": "请输入有效的端点 URL。",
  "Connection name is required.": "请输入连接名称。",
  "Select a configured endpoint.": "请选择已配置的端点。",
  "Endpoint URL is required.": "请输入端点 URL。",
  "S3 credentials are required.": "请输入 S3 凭据。",
  "Provide both access key ID and secret access key to update credentials.":
    "请同时提供访问密钥 ID 和秘密访问密钥以更新凭据。",
};

function translateDynamic(message: string): string | undefined {
  let match = /^(\d+) entr(?:y|ies)$/.exec(message);
  if (match) return `共 ${match[1]} 项`;

  match = /^Link requests \((\d+)\)$/.exec(message);
  if (match) return `关联请求（${match[1]}）`;
  match = /^Active sessions \((\d+)\)$/.exec(message);
  if (match) return `有效会话（${match[1]}）`;
  match = /^User #(\d+)$/.exec(message);
  if (match) return `用户 #${match[1]}`;
  match = /^Group #(\d+)$/.exec(message);
  if (match) return `用户组 #${match[1]}`;
  match = /^Endpoint #(\d+)$/.exec(message);
  if (match) return `端点 #${match[1]}`;
  match = /^Select connection (.+)$/.exec(message);
  if (match) return `选择连接 ${match[1]}`;
  match = /^Search (exact|contains): (.*)$/.exec(message);
  if (match) return `搜索（${match[1] === "exact" ? "精确匹配" : "包含"}）：${match[2]}`;
  match = /^(\d+) selected(?: \((\d+) not visible\))?$/.exec(message);
  if (match) return `已选择 ${match[1]} 项${match[2] ? `（${match[2]} 项不可见）` : ""}`;
  match = /^(\d+) linked$/.exec(message);
  if (match) return `已关联 ${match[1]} 项`;
  match = /^Created by: (.+)$/.exec(message);
  if (match) return `创建者：${match[1]}`;
  match = /^Edit connection · (.+)$/.exec(message);
  if (match) return `编辑连接 · ${match[1]}`;
  match = /^Delete selected \((\d+)\)$/.exec(message);
  if (match) return `删除所选项（${match[1]}）`;
  match = /^Delete: (.+)$/.exec(message);
  if (match) return `删除：${match[1]}`;
  match = /^This will permanently delete (\d+) selected connections? and their credentials\.$/.exec(message);
  if (match) return `这将永久删除所选的 ${match[1]} 个连接及其凭据。`;
  match = /^(\d+) connections? could not be (disabled|activated|deleted)\.$/.exec(message);
  if (match) {
    const action = match[2] === "disabled" ? "停用" : match[2] === "activated" ? "启用" : "删除";
    return `${match[1]} 个连接无法${action}。`;
  }
  match = /^(\d+) connections? (disabled|activated|deleted)\.(?: (\d+) failed\.)?$/.exec(message);
  if (match) {
    const action = match[2] === "disabled" ? "已停用" : match[2] === "activated" ? "已启用" : "已删除";
    return `${match[1]} 个连接${action}。${match[3] ? ` ${match[3]} 个失败。` : ""}`;
  }
  return undefined;
}

export function useAdminIdentityConnectionText() {
  const { locale } = useI18n();
  const t = useCallback(
    (message: string | I18nMessage) => {
      if (typeof message !== "string") {
        return message[locale] ?? message.en ?? message.fr ?? message.de ?? message.zh ?? "";
      }
      if (locale !== "zh") return message;
      return zhMessages[message] ?? translateDynamic(message) ?? message;
    },
    [locale],
  );
  return { locale, t };
}

export function localizeAdminIdentityConnectionBreadcrumbs(
  breadcrumbs: PageBreadcrumb[],
  locale: "en" | "fr" | "de" | "zh",
): PageBreadcrumb[] {
  if (locale !== "zh") return breadcrumbs;
  return breadcrumbs.map((breadcrumb) => ({
    ...breadcrumb,
    label: breadcrumb.label === "Admin"
      ? "管理后台"
      : zhMessages[breadcrumb.label] ?? translateDynamic(breadcrumb.label) ?? breadcrumb.label,
  }));
}
