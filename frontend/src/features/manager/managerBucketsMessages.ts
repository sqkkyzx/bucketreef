/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";
import type { ManagerZhMessages } from "./managerI18n";

export const managerBucketsZhMessages: ManagerZhMessages = {
  "Unexpected error": "发生未知错误",
  "Storage quota usage": "存储配额使用量",
  "Object quota usage": "对象配额使用量",
  Versioning: "版本控制",
  "Object Lock": "对象锁定",
  "Block public access": "阻止公开访问",
  "Lifecycle rules": "生命周期规则",
  "Static website": "静态网站",
  "Bucket policy": "存储桶策略",
  CORS: "CORS",
  "Access logging": "访问日志",
  Notifications: "通知",
  "Invalid name. 3-63 characters, lowercase letters, numbers, dots or hyphens.":
    "名称无效。请输入 3–63 个字符，只能包含小写字母、数字、点或连字符。",
  Used: "已用空间",
  Objects: "对象数",
  Quota: "配额",
  "Object quota": "对象数配额",
  "Quota status": "配额状态",
  "Created on": "创建时间",
  Tags: "标签",
  "Not selected": "未选择",
  "S3 session": "S3 会话",
  "No additional details available.": "暂无更多详细信息。",
  "Unable to load bucket feature details.": "无法加载存储桶功能详情。",
  "S3 tags": "S3 标签",
  "Unable to update selected bucket details.": "无法更新所选存储桶的详情。",
  "Unable to load buckets from the storage endpoint.": "无法从存储端点加载存储桶。",
  "Select an account before creating a bucket.": "请先选择账户，再创建存储桶。",
  "Bucket created": "存储桶已创建",
  "Unable to create the bucket.": "无法创建存储桶。",
  "Bucket name is required.": "必须填写存储桶名称。",
  "Bucket deleted": "存储桶已删除",
  Name: "名称",
  Configured: "已配置",
  "Not set": "未设置",
  Actions: "操作",
  "Bucket is not empty. Empty it first, or enable bucket purge access to delete it from Manager.":
    "存储桶不为空。请先清空，或启用存储桶清理权限后再从管理控制台删除。",
  "Purge and Delete": "清空并删除",
  Delete: "删除",
  "Deleting...": "正在删除…",
  Configure: "配置",
  General: "常规",
  Protection: "保护",
  "Discard changes?": "放弃更改？",
  "You have unapplied changes. Closing this dialog will discard them.":
    "存在尚未应用的更改。关闭此页面将放弃这些更改。",
  "Keep editing": "继续编辑",
  "Discard changes": "放弃更改",
  Close: "关闭",
  Breadcrumb: "面包屑导航",
  Buckets: "存储桶",
  "Bucket inventory and configuration for the active manager context.":
    "查看并配置当前管理上下文中的存储桶。",
  "Create bucket": "创建存储桶",
  "Showing the last available bucket list. ": "正在显示上次可用的存储桶列表。",
  Retry: "重试",
  "Select an account before managing buckets": "请先选择账户，再管理存储桶",
  "The bucket list, quota details, and destructive actions stay disabled until a manager execution context is selected.":
    "选择管理执行上下文后，才能查看存储桶列表和配额详情并执行删除等操作。",
  "Open dashboard": "打开概览",
  "Open browser": "打开对象浏览器",
  "— buckets": "— 个存储桶",
  "Search by name": "按名称搜索",
  "Sort by": "排序字段",
  Direction: "排序方向",
  Ascending: "升序",
  Descending: "降序",
  "Updating selected columns...": "正在更新所选列…",
  Metrics: "指标",
  Features: "功能",
  "Feature checks run only when their column is enabled.": "仅在启用对应列时检查功能状态。",
  "Loading buckets...": "正在加载存储桶…",
  "Unable to load buckets.": "无法加载存储桶。",
  "No buckets.": "没有存储桶。",
  "Delete bucket": "删除存储桶",
  "This permanently removes the bucket after server-side checks confirm it is empty.":
    "服务器确认存储桶为空后，会永久删除该存储桶。",
  Bucket: "存储桶",
  Context: "上下文",
  "Deletion is irreversible once the bucket is removed.": "存储桶一旦删除便无法恢复。",
  "The bucket must remain empty until the operation completes.": "操作完成前，存储桶必须保持为空。",
  "Define the bucket identity and initial protection settings for the active manager context.":
    "为当前管理上下文设置存储桶标识和初始保护选项。",
  Create: "创建",
  "Back to buckets": "返回存储桶",
  "Bucket name": "存储桶名称",
  "ex: backups-prod": "例如：backups-prod",
  "DNS compatible, lowercase, numbers, dots, and hyphens. The selected account will be used.":
    "名称须符合 DNS 规则，可使用小写字母、数字、点和连字符，并将使用当前所选账户。",
  "Custom LocationConstraint": "自定义 LocationConstraint",
  "ex: eu-west-1": "例如：eu-west-1",
  "Optional. Empty value uses the endpoint default region/placement.":
    "可选。留空时使用端点的默认区域或放置策略。",
  "Enables version retention.": "启用对象版本保留。",
  "S3 account": "S3 账户",
  Previous: "上一步",
  Continue: "继续",
  "Creating...": "正在创建…",
  Completed: "已完成",
  "Completed with errors": "已完成，但出现错误",
  Canceled: "已取消",
  Failed: "失败",
  Manager: "管理控制台",
  "Ceph Admin": "Ceph 管理",
  "Storage Ops": "存储运维",
  Endpoint: "端点",
  "All selected contexts": "所有已选上下文",
  "Bucket deletion": "存储桶删除",
  "Bucket listing": "存储桶列举",
  "DeleteObjects batch": "DeleteObjects 批次",
  Purge: "清理",
  "Missing bucket to delete.": "缺少要删除的存储桶。",
  "Invalid options.": "选项无效。",
  "Bucket deletion canceled.": "存储桶删除已取消。",
  "Purge canceled.": "清理已取消。",
  "Bucket deletion failed.": "存储桶删除失败。",
  "Bucket purge failed.": "存储桶清理失败。",
  "Purge and delete": "清空并删除",
  "Purge and delete bucket": "清空并删除存储桶",
  "Purge buckets": "清空存储桶",
  "Review the target, confirm the destructive operation and follow deletion through completion.":
    "核对目标并确认此删除操作，然后跟踪进度直至完成。",
  "Review the selected buckets, confirm the destructive operation and keep progress visible through completion.":
    "核对所选存储桶并确认此清理操作，然后跟踪进度直至完成。",
  "Stop and return": "停止并返回",
  Cancel: "取消",
  "Start purge": "开始清理",
  "This deletes current objects, historical versions, and delete markers, then removes the bucket and its S3 configuration.":
    "此操作会删除当前对象、历史版本和删除标记，然后移除存储桶及其 S3 配置。",
  "This empties the selected buckets by deleting current objects, historical versions, and delete markers. Buckets and bucket configuration are kept.":
    "此操作会删除当前对象、历史版本和删除标记以清空所选存储桶，但会保留存储桶及其配置。",
  Targets: "目标",
  Parallelism: "并行数",
  Type: "请输入",
  "Bucket purge progress": "存储桶清理进度",
  "Total still being discovered": "仍在统计总数",
  "Objects deleted": "已删除对象",
  "Versions/delete markers deleted": "已删除版本/删除标记",
  "Buckets completed": "已完成存储桶",
  Errors: "错误",
  Deleted: "已删除",
  "Not deleted": "未删除",
  Versions: "版本数",
  "Purge errors": "清理错误",
  Target: "目标",
  "No purge error reported for this bucket.": "此存储桶未报告清理错误。",
  Duration: "耗时",
  Stage: "阶段",
  Version: "版本",
  Count: "数量",
  Message: "消息",
  "Error details are unavailable for this bucket.": "此存储桶的错误详情不可用。",
};

const isChinese = (locale: UiLanguage) => locale === "zh";

export function managerBucketCountLabel(locale: UiLanguage, count: number): string {
  return isChinese(locale) ? `${count.toLocaleString("zh-CN")} 个存储桶` : `${count} bucket(s)`;
}

function managerObjectCountLabel(locale: UiLanguage, count: number): string {
  if (isChinese(locale)) return `${count.toLocaleString("zh-CN")} 个对象`;
  return `${count.toLocaleString()} ${count === 1 ? "object" : "objects"}`;
}

export function managerBucketDeleteNotEmptyMessage(
  locale: UiLanguage,
  name: string,
  objectCount: number,
): string {
  if (isChinese(locale)) {
    return `存储桶“${name}”不为空（${managerObjectCountLabel(locale, objectCount)}）。请先清空，或启用存储桶清理权限后再从管理控制台删除。`;
  }
  return `Bucket '${name}' is not empty (${managerObjectCountLabel(locale, objectCount)}). Empty it before deleting, or enable bucket purge access to delete it from Manager.`;
}

export function managerBucketDeleteFallback(locale: UiLanguage, name: string): string {
  return isChinese(locale) ? `无法删除存储桶“${name}”。` : `Unable to delete bucket '${name}'.`;
}

export function managerBucketDeleteConflict(locale: UiLanguage, name: string): string {
  return isChinese(locale)
    ? `存储桶“${name}”不为空。请先清空再删除。`
    : `Bucket '${name}' is not empty. Empty it before deleting.`;
}

export function managerBucketPurgeFinishedMessage(
  locale: UiLanguage,
  deletedEntries: number,
): string {
  if (isChinese(locale)) {
    return `已移除 ${deletedEntries.toLocaleString("zh-CN")} 个条目并删除存储桶。`;
  }
  return `Bucket deleted after removing ${deletedEntries.toLocaleString()} ${deletedEntries === 1 ? "entry" : "entries"}.`;
}

export function managerBucketFeatureState(locale: UiLanguage, state: string): string {
  if (!isChinese(locale)) return state;
  const labels: Record<string, string> = {
    Enabled: "已启用",
    Disabled: "已禁用",
    Suspended: "已暂停",
    Configured: "已配置",
    "Not set": "未设置",
    Partial: "部分启用",
    Unavailable: "不可用",
    Unknown: "未知",
  };
  return labels[state] ?? state;
}
