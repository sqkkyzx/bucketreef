/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";
import type { I18nMessage } from "../../i18n";
import type { ManagerZhMessages } from "./managerI18n";

export const managerCephKeysZhMessages: ManagerZhMessages = {
  "Unexpected error": "发生未知错误",
  "Access key created": "访问密钥已创建",
  "Access key disabled": "访问密钥已禁用",
  "Access key enabled": "访问密钥已启用",
  "Access key deleted": "访问密钥已删除",
  "Disable Ceph access key?": "禁用 Ceph 访问密钥？",
  "Temporarily prevent this RGW access key from authenticating.":
    "暂时禁止使用此 RGW 访问密钥进行认证。",
  "Disable key": "禁用密钥",
  "Access key": "访问密钥",
  "Applications using this key will lose access until the key is enabled again.":
    "使用此密钥的应用将失去访问权限，直到密钥重新启用。",
  "Delete Ceph access key?": "删除 Ceph 访问密钥？",
  "Permanently remove this RGW access key from the current S3 User context.":
    "从当前 S3 用户上下文中永久删除此 RGW 访问密钥。",
  "Delete key": "删除密钥",
  Context: "上下文",
  "Current S3 User": "当前 S3 用户",
  "Applications using this key will immediately lose access.":
    "使用此密钥的应用将立即失去访问权限。",
  "Managed private access key": "托管私有访问密钥",
  "Portal key (locked)": "门户密钥（已锁定）",
  "Private access": "私有访问",
  KLO: "KLO",
  Status: "状态",
  Active: "已启用",
  Inactive: "已禁用",
  "Created on": "创建时间",
  Actions: "操作",
  "Update the linked private connection instead": "请改为更新关联的私有连接",
  "Portal key is locked": "门户密钥已锁定",
  "Delete the linked private connection instead": "请改为删除关联的私有连接",
  "Saving...": "正在保存…",
  Disable: "禁用",
  Enable: "启用",
  "Deleting...": "正在删除…",
  Delete: "删除",
  "Ceph access keys": "Ceph 访问密钥",
  "Manage Ceph RGW access keys and provision private access for this S3 User context.":
    "管理此 S3 用户上下文的 Ceph RGW 访问密钥，并创建私有访问连接。",
  Breadcrumb: "面包屑导航",
  "Next step": "下一步",
  "Creating...": "正在创建…",
  "New key": "新建密钥",
  "Create my private access": "创建我的私有访问",
  "The secret is shown only once.": "秘密访问密钥仅显示一次。",
  "Copy these values now": "请立即复制这些值",
  "Secret key": "秘密访问密钥",
  Copy: "复制",
  "Copied to clipboard.": "已复制到剪贴板。",
  "Unable to copy. Select and copy this value manually.":
    "无法复制。请选中并手动复制此值。",
  "Select an account before managing Ceph access keys":
    "请先选择账户，再管理 Ceph 访问密钥",
  "Ceph access keys are scoped to the active execution context. Choose a managed S3 user context before opening key inventory.":
    "Ceph 访问密钥属于当前执行上下文。请先选择一个托管 S3 用户上下文，再查看密钥清单。",
  "Open buckets": "打开存储桶",
  "Ceph access keys are available only for managed S3 user contexts":
    "Ceph 访问密钥仅适用于托管 S3 用户上下文",
  "Switch to a managed S3 user execution context to create, enable, disable, or delete RGW access keys.":
    "请切换到托管 S3 用户执行上下文，以创建、启用、禁用或删除 RGW 访问密钥。",
  "Loading context capabilities…": "正在加载上下文功能…",
  "Ceph key inventory is unavailable for this context":
    "此上下文无法使用 Ceph 密钥清单",
  "Manual RGW key management is unavailable. Managed private access remains available from the page action.":
    "手动 RGW 密钥管理不可用，但仍可通过页面操作创建托管私有访问。",
  "The selected context does not expose RGW access-key management. Check the user tool access, feature toggle, endpoint provider, admin feature, and Ceph admin credentials.":
    "所选上下文未开放 RGW 访问密钥管理。请检查用户工具权限、功能开关、端点提供商、管理功能和 Ceph 管理凭据。",
  Keys: "密钥",
  "BucketReef interface keys and managed private-access keys are locked; delete a managed key through its private connection.":
    "BucketReef 界面密钥和托管私有访问密钥均已锁定；如需删除托管密钥，请通过其私有连接操作。",
  Search: "搜索",
  "Search by access key or status": "按访问密钥或状态搜索",
  "Loading keys...": "正在加载密钥…",
  "Unable to load keys.": "无法加载密钥。",
  "No keys.": "没有密钥。",
  "Create my private RGW access": "创建我的 RGW 私有访问",
  "My private access": "我的私有访问",
  "Inline policy name is required.": "必须填写内联策略名称。",
  "Inline policy names must be unique.": "内联策略名称不能重复。",
  "Inline policy names must be unique": "内联策略名称不能重复",
  "Inline policy document must be a JSON object.": "内联策略文档必须是 JSON 对象。",
  "Connection name is required.": "必须填写连接名称。",
  "Enable Browser, Manager, or both.": "请启用对象浏览器、管理控制台或两者。",
  "Unable to create managed private access.": "无法创建托管私有访问。",
  "BucketReef creates a dedicated IAM user with AmazonS3FullAccess and a private connection for Browser. The generated secret is stored only on the server and is never sent to this browser.":
    "BucketReef 会创建一个具有 AmazonS3FullAccess 的专用 IAM 用户和用于对象浏览器的私有连接。生成的秘密访问密钥仅存储在服务器上，绝不会发送到此浏览器。",
  "BucketReef creates a dedicated IAM user and private connection using the advanced configuration below. The generated secret is stored only on the server and is never sent to this browser.":
    "BucketReef 会使用下方高级配置创建专用 IAM 用户和私有连接。生成的秘密访问密钥仅存储在服务器上，绝不会发送到此浏览器。",
  "BucketReef creates a new access key for this RGW user and stores it in a private connection for Browser. The generated secret is stored only on the server and is never sent to this browser.":
    "BucketReef 会为此 RGW 用户创建新的访问密钥，并将其存入用于对象浏览器的私有连接。生成的秘密访问密钥仅存储在服务器上，绝不会发送到此浏览器。",
  "BucketReef creates a new access key for this RGW user and stores it in a private connection using the advanced configuration below. The generated secret is stored only on the server and is never sent to this browser.":
    "BucketReef 会为此 RGW 用户创建新的访问密钥，并使用下方高级配置将其存入私有连接。生成的秘密访问密钥仅存储在服务器上，绝不会发送到此浏览器。",
  "Connection name": "连接名称",
  "Advanced configuration": "高级配置",
  Customized: "已自定义",
  "IAM groups": "IAM 用户组",
  "No groups available.": "没有可用的用户组。",
  "Managed policies": "托管策略",
  "Inline policies": "内联策略",
  Remove: "移除",
  "Inline policy name": "内联策略名称",
  "Inline policy document": "内联策略文档",
  "Provide a JSON object, then add it to the policies for this access.":
    "请提供一个 JSON 对象，然后将其添加到此访问的策略中。",
  "Add inline policy": "添加内联策略",
  "Workspace access": "工作区访问",
  "Access manager": "访问管理控制台",
  "Access browser": "访问对象浏览器",
  "Browser is selected by default. At least one workspace must remain enabled.":
    "默认选择对象浏览器。必须至少启用一个工作区。",
  Cancel: "取消",
  "Creating…": "正在创建…",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.":
    "存在尚未应用的更改。关闭此弹窗将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  Close: "关闭",
  "Ceph key management is not available for this context":
    "此上下文无法使用 Ceph 密钥管理",
  "Ceph access key management feature is disabled": "Ceph 访问密钥管理功能已禁用",
  "Ceph access key management is not available for this context":
    "此上下文无法使用 Ceph 访问密钥管理",
  "Ceph access key management is not enabled for this resource":
    "此资源未启用 Ceph 访问密钥管理",
  "Manager feature is disabled": "管理控制台功能已禁用",
  "Not authorized": "无权执行此操作",
  "Not authorized for this Manager context": "无权访问此管理控制台上下文",
  "Not authorized for this S3 user": "无权访问此 S3 用户",
  "Invalid S3 user identifier": "S3 用户标识符无效",
  "Ceph Admin API is not available for this context": "此上下文无法使用 Ceph Admin API",
  "S3 user not found": "未找到 S3 用户",
  "Storage endpoint not found for S3 user.": "未找到 S3 用户的存储端点。",
  "Admin operations are disabled for this endpoint.": "此端点已禁用管理操作。",
  "Managed private S3 connection provisioning is not allowed for this user":
    "不允许为此用户创建托管私有 S3 连接",
  "This key belongs to a managed private access; update or delete its private connection instead":
    "此密钥属于托管私有访问；请改为更新或删除其私有连接",
  "This key belongs to a managed private access; delete its private connection instead":
    "此密钥属于托管私有访问；请改为删除其私有连接",
  "RGW user not found": "未找到 RGW 用户",
  "RGW User not found": "未找到 RGW 用户",
  "access_key is required": "必须提供 access_key",
  "Cannot disable the interface access key; rotate it instead":
    "无法禁用界面访问密钥；请改为轮换该密钥",
  "Cannot delete the interface access key; rotate it instead":
    "无法删除界面访问密钥；请改为轮换该密钥",
  "Access key not found after status update": "更新状态后未找到访问密钥",
  "An assigned RGW User context is required": "需要已分配的 RGW 用户上下文",
  "The RGW User is not assigned to this user": "此 RGW 用户未分配给当前用户",
  "Managed Ceph private access is not allowed for this context":
    "此上下文不允许使用托管 Ceph 私有访问",
  "The source account has no usable storage endpoint": "源账户没有可用的存储端点",
  "The source RGW User has no usable storage endpoint": "源 RGW 用户没有可用的存储端点",
  "Source connection not found": "未找到源连接",
  "The source connection endpoint is unavailable": "源连接端点不可用",
  "Managed private access requires TLS verification": "托管私有访问要求启用 TLS 验证",
  "Unable to validate IAM groups and policies": "无法验证 IAM 用户组和策略",
  "RGW IAM did not return complete access credentials": "RGW IAM 未返回完整的访问凭据",
  "RGW did not return access credentials": "RGW 未返回访问凭据",
  "RGW did not return full access credentials": "RGW 未返回完整的访问凭据",
  "Unable to create managed private access": "无法创建托管私有访问",
  "A managed private access already exists or requires cleanup for this execution context":
    "此执行上下文已存在托管私有访问，或有待清理的托管私有访问",
  "A managed private access operation already exists for this execution context":
    "此执行上下文已有正在进行的托管私有访问操作",
  "The deterministic IAM user already exists and is not linked to a known provisioning":
    "预定的 IAM 用户已存在，但未关联到已知的创建记录",
  "Provisioning failed and remote cleanup requires remediation":
    "创建失败，且远程清理需要人工处理",
  "Account access was revoked": "账户访问权限已撤销",
  "Source account not found": "未找到源账户",
  "Invalid IAM source context": "IAM 源上下文无效",
  "Source connection access was revoked": "源连接访问权限已撤销",
  "The source context has no IAM administration credentials":
    "源上下文没有 IAM 管理凭据",
};

function isChinese(locale: UiLanguage): boolean {
  return locale === "zh";
}

export function managerCephKeyResultCount(locale: UiLanguage, count: number): string {
  return isChinese(locale)
    ? `${count.toLocaleString("zh-CN")} 条结果`
    : `${count} result(s)`;
}

export function managerPrivateAccessDefaultName(
  locale: UiLanguage,
  contextName?: string | null,
): string {
  const normalizedContextName = contextName?.trim();
  if (!isChinese(locale)) {
    return normalizedContextName ? `${normalizedContextName} private access` : "My private access";
  }
  return normalizedContextName ? `${normalizedContextName} 私有访问` : "我的私有访问";
}

export function managerPrivateConnectionCreatedMessage(
  connectionName: string,
): I18nMessage {
  return {
    en: `Private connection ${connectionName} created without exposing its secret.`,
    zh: `已创建私有连接“${connectionName}”，且未公开其秘密访问密钥。`,
  };
}

export function managerRemoveInlinePolicyLabel(locale: UiLanguage, policyName: string): string {
  return isChinese(locale)
    ? `移除内联策略 ${policyName}`
    : `Remove inline policy ${policyName}`;
}

const zhErrorPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["Unable to list keys: ", "无法列出密钥："],
  ["Unable to create access key: ", "无法创建访问密钥："],
  ["Unable to update access key status: ", "无法更新访问密钥状态："],
  ["Unable to delete access key: ", "无法删除访问密钥："],
  ["Unsupported remote principal type: ", "不支持的远程主体类型："],
  ["Unknown IAM groups: ", "未知的 IAM 用户组："],
  ["Unknown IAM policies: ", "未知的 IAM 策略："],
  ["Unable to build admin client for ", "无法为以下端点创建管理客户端："],
  ["Provisioning failed and remote cleanup requires remediation · ", "创建失败，且远程清理需要人工处理 · "],
];

export function localizeManagerCephKeysError(locale: UiLanguage, message: string): string {
  if (!isChinese(locale)) return message;
  const exact = managerCephKeysZhMessages[message];
  if (exact) return exact;
  const prefix = zhErrorPrefixes.find(([source]) => message.startsWith(source));
  return prefix ? `${prefix[1]}${message.slice(prefix[0].length)}` : message;
}
