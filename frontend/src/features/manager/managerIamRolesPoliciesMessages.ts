/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";
import type { I18nMessage } from "../../i18n";
import type { ManagerZhMessages } from "./managerI18n";

type ManagerIamEntity = "user" | "group" | "role";

export const managerIamRolesPoliciesZhMessages: ManagerZhMessages = {
  "Unexpected error": "发生未知错误",
  "Role created": "角色已创建",
  "Role deleted": "角色已删除",
  "Role updated": "角色已更新",
  "Policy created": "策略已创建",
  "Policy attached": "策略已附加",
  "Policy detached": "策略已分离",
  "Delete IAM role?": "删除 IAM 角色？",
  "Permanently remove this IAM role from the selected account.": "从所选账户中永久删除此 IAM 角色。",
  "Delete role": "删除角色",
  "IAM role": "IAM 角色",
  "Workloads that assume this role will no longer receive its permissions.":
    "使用此角色的工作负载将不再获得其权限。",
  Name: "名称",
  Path: "路径",
  ARN: "ARN",
  Version: "版本",
  Policies: "策略",
  Policy: "策略",
  Actions: "操作",
  Edit: "编辑",
  "Deleting...": "正在删除…",
  Delete: "删除",
  "IAM Roles": "IAM 角色",
  "Manage roles using the account root keys.": "使用账户根密钥管理角色。",
  "Create role": "创建角色",
  "Creating...": "正在创建…",
  "Select an account before managing IAM roles": "请先选择账户，再管理 IAM 角色",
  "Roles are defined per execution context. Choose an account to list trust relationships and attached policies.":
    "角色按执行上下文定义。请选择账户以查看信任关系和附加的策略。",
  "Open users": "打开用户",
  "Next step": "下一步",
  "IAM roles are unavailable for managed S3 user contexts": "托管 S3 用户上下文无法使用 IAM 角色",
  "Switch to an RGW account or S3 connection context to manage role trust policies and attached permissions.":
    "请切换到 RGW 账户或 S3 连接上下文，以管理角色信任策略和附加权限。",
  Roles: "角色",
  "Search by name, path, or ARN": "按名称、路径或 ARN 搜索",
  "Search by name or ARN": "按名称或 ARN 搜索",
  "Loading roles...": "正在加载角色…",
  "Unable to load roles.": "无法加载角色。",
  "No roles.": "没有角色。",
  "Create IAM role": "创建 IAM 角色",
  "Configure the trust policy, path and attached policies without compressing the workflow into an overlay.":
    "配置角色的信任策略、路径和附加策略。",
  Create: "创建",
  "Back to roles": "返回角色",
  "Role name is required.": "必须填写角色名称。",
  "Attach policies": "附加策略",
  "Select managed policies to grant permissions immediately.": "选择托管策略以立即授予权限。",
  "Select managed policies to link immediately.": "选择要立即关联的托管策略。",
  "No policies available. Create them first.": "没有可用的策略，请先创建策略。",
  "Policies can also be attached later from the role page.": "也可以稍后从角色页面附加策略。",
  "Policies can also be attached later from the group page.": "也可以稍后从用户组页面附加策略。",
  "Edit IAM role": "编辑 IAM 角色",
  "Review the immutable identity and update the role trust policy in a dedicated page.":
    "查看不可变的角色标识，并更新角色信任策略。",
  "Loading role details...": "正在加载角色详情…",
  "Save changes": "保存更改",
  "Saving...": "正在保存…",
  Identity: "标识",
  "Role name": "角色名称",
  "Role path": "角色路径",
  "Role path (optional)": "角色路径（可选）",
  "Path is fixed at creation. Create a new role to use a different path.":
    "路径在创建时确定。如需使用其他路径，请创建新角色。",
  "Defaults to \"/\". Sets the IAM path prefix for the role.":
    "默认为“/”，用于设置角色的 IAM 路径前缀。",
  "Trust policy": "信任策略",
  "Assume role policy (JSON)": "角色信任策略（JSON）",
  "IAM trust policy document used by STS AssumeRole. Provide valid JSON.":
    "STS AssumeRole 使用的 IAM 信任策略文档。请提供有效的 JSON。",
  "Assume role policy must be valid JSON.": "角色信任策略必须是有效的 JSON。",
  "IAM Policies": "IAM 策略",
  "List and create Ceph IAM policies for the selected account.": "列出并创建所选账户的 Ceph IAM 策略。",
  "Create policy": "创建策略",
  "Select an account before managing IAM policies": "请先选择账户，再管理 IAM 策略",
  "Policies are created inside an execution context. Choose an account to list, create, and attach managed IAM policies.":
    "策略在执行上下文中创建。请选择账户以列出、创建和附加托管 IAM 策略。",
  "IAM policies are unavailable for managed S3 user contexts": "托管 S3 用户上下文无法使用 IAM 策略",
  "Switch to an RGW account or S3 connection context to manage reusable IAM policies.":
    "请切换到 RGW 账户或 S3 连接上下文，以管理可复用的 IAM 策略。",
  "Loading policies...": "正在加载策略…",
  "Unable to load policies.": "无法加载策略。",
  "No policies.": "没有策略。",
  "Create IAM policy": "创建 IAM 策略",
  "Name the policy and edit its complete JSON document with page-level space.":
    "设置策略名称并编辑完整的 JSON 文档。",
  "Back to policies": "返回策略",
  "Policy name": "策略名称",
  "Policy name is required.": "必须填写策略名称。",
  "Policy document": "策略文档",
  "Policy document (JSON)": "策略文档（JSON）",
  "Policy document must be valid JSON.": "策略文档必须是有效的 JSON。",
  "Provide a valid IAM policy JSON document. You can start from the default template and customize statements.":
    "请提供有效的 IAM 策略 JSON 文档。可以从默认模板开始并自定义 Statement。",
  "User policies": "用户策略",
  "Group policies": "用户组策略",
  "Role policies": "角色策略",
  Breadcrumb: "面包屑导航",
  "Detach managed policy?": "分离托管策略？",
  "Detach policy": "分离策略",
  "Policy ARN": "策略 ARN",
  "Detaching...": "正在分离…",
  Detach: "分离",
  Refresh: "刷新",
  "No IAM policies available.": "没有可用的 IAM 策略。",
  "Attached policies": "已附加策略",
  "Attach managed policy": "附加托管策略",
  "Managed policy": "托管策略",
  "Select a policy to attach": "选择要附加的策略",
  "Attaching...": "正在附加…",
  Attach: "附加",
  "Policies must be created first in the Policies tab.": "必须先在“策略”标签页中创建策略。",
  "No attached policies.": "没有已附加的策略。",
  "Inline policies": "内联策略",
  "Inline policies (optional)": "内联策略（可选）",
  "Update the selected inline policy or create a separate one.": "更新所选内联策略，或创建一个新策略。",
  "Select an existing inline policy to review or edit.": "选择现有内联策略以查看或编辑。",
  "No inline policies created yet.": "尚未创建内联策略。",
  "Create new inline policy": "创建新内联策略",
  "Create inline policy": "创建内联策略",
  "Refreshing...": "正在刷新…",
  "Select an account before editing inline policies.": "请先选择账户，再编辑内联策略。",
  "Existing inline policies": "现有内联策略",
  "Loading inline policies...": "正在加载内联策略…",
  "No inline policy exists yet.": "尚无内联策略。",
  "Select an existing inline policy to review or edit": "选择现有内联策略以查看或编辑",
  "Create the first inline policy": "创建第一个内联策略",
  "Existing inline policies stay visible above so you can avoid creating a second policy by mistake.":
    "现有内联策略会保留在上方，避免误建重复策略。",
  "Edit inline policy": "编辑内联策略",
  "Create a new inline policy": "创建新内联策略",
  "Update the selected inline policy or change its name to save a different one.":
    "更新所选内联策略，或更改名称另存为新策略。",
  "Inline policy name": "内联策略名称",
  "Inline policy name is required.": "必须填写内联策略名称。",
  "Inline policy document": "内联策略文档",
  "Inline policy document (JSON)": "内联策略文档（JSON）",
  "Inline policy must be valid JSON.": "内联策略必须是有效的 JSON。",
  "Blank JSON will save as an empty document.": "JSON 留空时将保存为空文档。",
  "Provide valid JSON. Blank defaults to an empty document.": "请提供有效的 JSON。留空时默认为空文档。",
  "Insert template": "插入模板",
  "Delete inline policy": "删除内联策略",
  "Delete inline policy?": "删除内联策略？",
  Cancel: "取消",
  "Update existing inline policy": "更新现有内联策略",
  "Replace existing inline policy": "替换现有内联策略",
  "Save new inline policy": "保存新内联策略",
  "Inline policy updated.": "内联策略已更新。",
  "Inline policy saved.": "内联策略已保存。",
  "Inline policy deleted.": "内联策略已删除。",
  "IAM management not allowed for this account": "此账户不允许管理 IAM",
  "IAM is disabled for this endpoint": "此端点已禁用 IAM",
  "Execution context credentials are missing": "执行上下文缺少凭据",
  "Account context unavailable": "账户上下文不可用",
  "Invalid account identifier": "账户标识符无效",
  "Invalid connection identifier": "连接标识符无效",
  "Invalid S3 user identifier": "S3 用户标识符无效",
  "S3Account id required": "必须提供 S3 账户 ID",
  "S3Account not found": "未找到 S3 账户",
  "S3Account context unavailable for session": "当前会话无法使用 S3 账户上下文",
  "Not authorized": "无权执行此操作",
  "Not authorized for this account": "无权访问此账户",
  "Not authorized for this S3 user": "无权访问此 S3 用户",
  "S3 user not found": "未找到 S3 用户",
  "S3Connection not found": "未找到 S3 连接",
  "Connection is not authorized in this workspace": "此工作区未授权使用该连接",
  "Admin credentials are not configured for this account": "此账户未配置管理凭据",
  "Sessions cannot assume this context": "会话无法代入此上下文",
  "Endpoint override is not allowed for this session": "此会话不允许覆盖端点",
  "Endpoint is not allowed for this session": "此会话不允许使用该端点",
  "Custom S3 endpoint is not allowed by outbound policy": "出站策略不允许使用自定义 S3 端点",
  "Manager feature is disabled": "管理控制台功能已禁用",
  "Manager access is disabled": "管理控制台访问已禁用",
  "IAM CreatePolicy is not supported by this endpoint": "此端点不支持 IAM CreatePolicy",
  "Role not found": "未找到角色",
  "Policy not found": "未找到策略",
  "Assume role policy must be valid JSON": "角色信任策略必须是有效的 JSON",
  "Updating an IAM role path is not supported. Create a new role with the desired path.":
    "不支持更新 IAM 角色路径。请使用所需路径创建新角色。",
  "Inline policy name in payload does not match the URL.": "请求中的内联策略名称与 URL 不匹配。",
  "You have unsaved inline policy changes. Continuing will discard them.":
    "内联策略有未保存的更改。继续操作将放弃这些更改。",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.":
    "存在尚未应用的更改。关闭此页面将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  Selected: "已选择",
  "Search policies": "搜索策略",
  "Search policies by name or ARN": "按名称或 ARN 搜索策略",
  "No matching policies.": "没有匹配的策略。",
  "Saved inline policies": "已保存的内联策略",
  "Select one to edit or create a new one.": "选择一个进行编辑，或创建新策略。",
  Remove: "移除",
  "Select a saved inline policy to edit, or create a new one.": "选择已保存的内联策略进行编辑，或创建新策略。",
  "Existing inline policies stay listed above so you can review them before adding another draft.":
    "现有内联策略会保留在上方，便于添加其他草稿前进行检查。",
  "Provide a name and valid JSON to keep this inline policy draft visible in the form.":
    "请提供名称和有效的 JSON，以便将此内联策略草稿保留在表单中。",
  "Clear all": "全部清除",
  Hide: "隐藏",
  Show: "显示",
  "Hide inline policies": "隐藏内联策略",
  "Show inline policies": "显示内联策略",
  "Update draft": "更新草稿",
  "Save draft": "保存草稿",
  "Empty JSON document": "空 JSON 文档",
  "Attach policies (optional)": "附加策略（可选）",
  "Bind JSON policies now or skip and attach later.": "现在关联 JSON 策略，或跳过并稍后附加。",
  "No policies available. Create them in the Policies tab.": "没有可用的策略。请在“策略”标签页中创建。",
};

function isManagerIamChinese(locale: UiLanguage): boolean {
  return locale === "zh";
}

export function managerIamEntityLabel(
  locale: UiLanguage,
  entity: ManagerIamEntity | string,
  options: { plural?: boolean; capitalized?: boolean } = {},
): string {
  const { plural = false, capitalized = false } = options;
  if (isManagerIamChinese(locale)) {
    return entity === "user" ? "用户" : entity === "group" ? "用户组" : entity === "role" ? "角色" : entity;
  }
  const value = plural ? `${entity}s` : entity;
  return capitalized ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

export function managerIamResultCount(locale: UiLanguage, count: number): string {
  return isManagerIamChinese(locale) ? `${count.toLocaleString("zh-CN")} 条结果` : `${count} result(s)`;
}

export function managerIamSelectedCount(locale: UiLanguage, count: number): string {
  return isManagerIamChinese(locale) ? `已选择 ${count.toLocaleString("zh-CN")} 项` : `${count} selected`;
}

export function managerIamSavedCount(locale: UiLanguage, count: number): string {
  return isManagerIamChinese(locale) ? `已保存 ${count.toLocaleString("zh-CN")} 项` : `${count} saved`;
}

export function managerIamInlinePolicyCount(locale: UiLanguage, count: number): string {
  if (isManagerIamChinese(locale)) return `${count.toLocaleString("zh-CN")} 个策略`;
  return `${count} ${count === 1 ? "policy" : "policies"}`;
}

export function managerIamInlinePolicyReplacedMessage(name: string): I18nMessage {
  return {
    en: `Inline policy "${name}" replaced.`,
    zh: `内联策略“${name}”已替换。`,
  };
}

export function managerIamInlinePolicyCreatedFromExistingMessage(
  name: string,
  originalName: string,
): I18nMessage {
  return {
    en: `New inline policy "${name}" created. "${originalName}" remains unchanged.`,
    zh: `已创建新的内联策略“${name}”。原策略“${originalName}”保持不变。`,
  };
}

const zhErrorPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["Unable to list IAM roles: ", "无法列出 IAM 角色："],
  ["Unable to create IAM role: ", "无法创建 IAM 角色："],
  ["Unable to fetch IAM role: ", "无法获取 IAM 角色："],
  ["Unable to delete IAM role: ", "无法删除 IAM 角色："],
  ["Unable to update role trust policy: ", "无法更新角色信任策略："],
  ["Unable to fetch IAM policy: ", "无法获取 IAM 策略："],
  ["Unable to create IAM policy: ", "无法创建 IAM 策略："],
  ["Unable to delete IAM policy: ", "无法删除 IAM 策略："],
  ["Unable to list user policies: ", "无法列出用户策略："],
  ["Unable to list inline policies for user: ", "无法列出用户的内联策略："],
  ["Unable to fetch inline policy for user: ", "无法获取用户的内联策略："],
  ["Unable to put inline policy on user: ", "无法保存用户的内联策略："],
  ["Unable to delete inline policy from user: ", "无法删除用户的内联策略："],
  ["Unable to attach policy to user: ", "无法向用户附加策略："],
  ["Unable to detach policy from user: ", "无法从用户分离策略："],
  ["Unable to list group policies: ", "无法列出用户组策略："],
  ["Unable to list inline policies for group: ", "无法列出用户组的内联策略："],
  ["Unable to fetch inline policy for group: ", "无法获取用户组的内联策略："],
  ["Unable to put inline policy on group: ", "无法保存用户组的内联策略："],
  ["Unable to delete inline policy from group: ", "无法删除用户组的内联策略："],
  ["Unable to attach policy to group: ", "无法向用户组附加策略："],
  ["Unable to detach policy from group: ", "无法从用户组分离策略："],
  ["Unable to list role policies: ", "无法列出角色策略："],
  ["Unable to list inline policies for role: ", "无法列出角色的内联策略："],
  ["Unable to fetch inline policy for role: ", "无法获取角色的内联策略："],
  ["Unable to put inline policy on role: ", "无法保存角色的内联策略："],
  ["Unable to delete inline policy from role: ", "无法删除角色的内联策略："],
  ["Unable to attach policy to role: ", "无法向角色附加策略："],
  ["Unable to detach policy from role: ", "无法从角色分离策略："],
];

export function localizeManagerIamError(locale: UiLanguage, message: string): string {
  if (!isManagerIamChinese(locale)) return message;
  const exact = managerIamRolesPoliciesZhMessages[message];
  if (exact) return exact;
  const prefix = zhErrorPrefixes.find(([source]) => message.startsWith(source));
  return prefix ? `${prefix[1]}${message.slice(prefix[0].length)}` : message;
}
