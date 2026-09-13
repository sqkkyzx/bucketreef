/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { UiLanguage } from "../../components/language";

type BucketFeatureRecord = Record<string, unknown>;
type RecordValue = BucketFeatureRecord;

type BucketFeatureTagSummary = {
  key?: string | null;
  value?: string | null;
};

const isChinese = (locale: UiLanguage) => locale === "zh";

function yesNo(value: boolean, locale: UiLanguage): string {
  return isChinese(locale) ? (value ? "是" : "否") : value ? "Yes" : "No";
}

function localizedState(value: string, locale: UiLanguage): string {
  if (!isChinese(locale)) return value;
  const labels: Record<string, string> = {
    Enabled: "已启用",
    Disabled: "已禁用",
    Suspended: "已暂停",
    Configured: "已配置",
    "Not set": "未设置",
    Partial: "部分启用",
    Unavailable: "不可用",
    Blocked: "已阻止",
    Unblocked: "未阻止",
  };
  return labels[value] ?? value;
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown, maxItems = 3): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const rendered = value.slice(0, maxItems).map((item) => displayValue(item, maxItems)).filter(Boolean);
    const remaining = value.length - rendered.length;
    return `${rendered.join(", ")}${remaining > 0 ? `, +${remaining}` : ""}`;
  }
  const record = asRecord(value);
  if (record) {
    const entries = Object.entries(record).slice(0, maxItems);
    const rendered = entries.map(([key, entry]) => `${key}: ${displayValue(entry, maxItems)}`).filter(Boolean);
    const remaining = Object.keys(record).length - rendered.length;
    return `${rendered.join("; ")}${remaining > 0 ? `; +${remaining}` : ""}`;
  }
  return "";
}

function joinParts(parts: Array<string | null | undefined>, fallback: string): string {
  const cleaned = parts.filter((part): part is string => Boolean(part));
  return cleaned.length > 0 ? cleaned.join(" - ") : fallback;
}

function ruleFilterSummary(rule: RecordValue, locale: UiLanguage): string | null {
  const topLevelPrefix = stringValue(rule.Prefix ?? rule.prefix);
  if (topLevelPrefix) return `${isChinese(locale) ? "前缀" : "Prefix"}: ${topLevelPrefix}`;

  const filter = asRecord(rule.Filter ?? rule.filter);
  if (!filter) return null;

  const prefix = stringValue(filter.Prefix ?? filter.prefix);
  if (prefix) return `${isChinese(locale) ? "前缀" : "Prefix"}: ${prefix}`;

  const tag = asRecord(filter.Tag ?? filter.tag);
  if (tag) {
    const key = stringValue(tag.Key ?? tag.key);
    const value = stringValue(tag.Value ?? tag.value);
    if (key && value) return `${isChinese(locale) ? "标签" : "Tag"}: ${key}=${value}`;
    if (key) return `${isChinese(locale) ? "标签" : "Tag"}: ${key}`;
  }

  const andFilter = asRecord(filter.And ?? filter.and);
  if (!andFilter) return null;

  const andPrefix = stringValue(andFilter.Prefix ?? andFilter.prefix);
  const tags = listValue(andFilter.Tags ?? andFilter.tags)
    .map(asRecord)
    .filter((entry): entry is RecordValue => Boolean(entry))
    .map((entry) => {
      const key = stringValue(entry.Key ?? entry.key);
      const value = stringValue(entry.Value ?? entry.value);
      if (key && value) return `${key}=${value}`;
      return key;
    })
    .filter((entry): entry is string => Boolean(entry));

  return joinParts(
    [
      andPrefix ? `${isChinese(locale) ? "前缀" : "Prefix"}: ${andPrefix}` : null,
      tags.length > 0 ? `${isChinese(locale) ? "标签" : "Tags"}: ${tags.join(", ")}` : null,
    ],
    isChinese(locale) ? "组合筛选条件" : "Combined filter"
  );
}

function lifecycleActionSummary(rule: RecordValue, locale: UiLanguage): string | null {
  const actions: string[] = [];
  const expiration = asRecord(rule.Expiration ?? rule.expiration);
  if (expiration?.Days != null) {
    actions.push(isChinese(locale) ? `${expiration.Days} 天后使当前版本过期` : `expire current after ${expiration.Days}d`);
  }
  if (expiration?.ExpiredObjectDeleteMarker === true) {
    actions.push(isChinese(locale) ? "删除过期的删除标记" : "delete expired markers");
  }

  const noncurrent = asRecord(rule.NoncurrentVersionExpiration ?? rule.noncurrentVersionExpiration);
  if (noncurrent?.NoncurrentDays != null) {
    actions.push(
      isChinese(locale)
        ? `${noncurrent.NoncurrentDays} 天后使非当前版本过期`
        : `expire noncurrent after ${noncurrent.NoncurrentDays}d`,
    );
  }

  const multipart = asRecord(rule.AbortIncompleteMultipartUpload ?? rule.abortIncompleteMultipartUpload);
  if (multipart?.DaysAfterInitiation != null) {
    actions.push(
      isChinese(locale)
        ? `${multipart.DaysAfterInitiation} 天后中止未完成的分段上传`
        : `abort multipart after ${multipart.DaysAfterInitiation}d`,
    );
  }

  const transitions = listValue(rule.Transitions ?? rule.transitions);
  if (transitions.length > 0) {
    actions.push(isChinese(locale) ? `${transitions.length} 个存储类别转换` : `${transitions.length} transition(s)`);
  }

  const noncurrentTransitions = listValue(rule.NoncurrentVersionTransitions ?? rule.noncurrentVersionTransitions);
  if (noncurrentTransitions.length > 0) {
    actions.push(
      isChinese(locale)
        ? `${noncurrentTransitions.length} 个非当前版本存储类别转换`
        : `${noncurrentTransitions.length} noncurrent transition(s)`,
    );
  }

  return actions.length > 0 ? actions.join(", ") : null;
}

export function buildVersioningSummaryLines(status?: string | null, locale: UiLanguage = "en"): string[] {
  const normalized = (status || "Disabled").trim() || "Disabled";
  return [`${isChinese(locale) ? "版本控制" : "Versioning"}: ${localizedState(normalized, locale)}`];
}

export function buildObjectLockSummaryLines(
  objectLockEnabled?: boolean | null,
  objectLock?: { enabled?: boolean | null; mode?: string | null; days?: number | null; years?: number | null } | null,
  locale: UiLanguage = "en",
): string[] {
  const enabled = Boolean(objectLockEnabled ?? objectLock?.enabled);
  const lines = [`${isChinese(locale) ? "已启用" : "Enabled"}: ${yesNo(enabled, locale)}`];
  if (objectLock?.mode) lines.push(`${isChinese(locale) ? "模式" : "Mode"}: ${objectLock.mode}`);
  if (objectLock?.days != null) {
    lines.push(
      isChinese(locale)
        ? `默认保留期：${objectLock.days} 天`
        : `Default retention: ${objectLock.days} day(s)`,
    );
  }
  if (objectLock?.years != null) {
    lines.push(
      isChinese(locale)
        ? `默认保留期：${objectLock.years} 年`
        : `Default retention: ${objectLock.years} year(s)`,
    );
  }
  return lines;
}

export function buildPublicAccessBlockSummaryLines(
  value?: RecordValue | null,
  locale: UiLanguage = "en",
): string[] {
  const flags = [
    ["BlockPublicAcls", Boolean(value?.block_public_acls)],
    ["IgnorePublicAcls", Boolean(value?.ignore_public_acls)],
    ["BlockPublicPolicy", Boolean(value?.block_public_policy)],
    ["RestrictPublicBuckets", Boolean(value?.restrict_public_buckets)],
  ] as const;
  const enabledCount = flags.filter(([, enabled]) => enabled).length;
  const state = enabledCount === 4
    ? localizedState("Enabled", locale)
    : enabledCount === 0
      ? localizedState("Disabled", locale)
      : isChinese(locale) ? `部分启用（${enabledCount}/4）` : `Partial (${enabledCount}/4)`;
  return [
    `${isChinese(locale) ? "状态" : "State"}: ${state}`,
    ...flags.map(([label, enabled]) =>
      `${label}: ${localizedState(enabled ? "Blocked" : "Unblocked", locale)}`,
    ),
  ];
}

export function buildLifecycleRuleSummaryLines(rules?: unknown[] | null, locale: UiLanguage = "en"): string[] {
  const normalized = listValue(rules).map(asRecord).filter((rule): rule is RecordValue => Boolean(rule));
  if (normalized.length === 0) return [isChinese(locale) ? "规则：0（已禁用）" : "Rules: 0 (disabled)"];

  const lines = [`${isChinese(locale) ? "规则" : "Rules"}: ${normalized.length}`];
  normalized.slice(0, 3).forEach((rule, index) => {
    const id =
      stringValue(rule.ID ?? rule.Id ?? rule.id) ||
      (isChinese(locale) ? `规则 ${index + 1}` : `Rule ${index + 1}`);
    const status = stringValue(rule.Status ?? rule.status) || "Enabled";
    lines.push(
      joinParts(
        [`${id}: ${localizedState(status, locale)}`, ruleFilterSummary(rule, locale), lifecycleActionSummary(rule, locale)],
        isChinese(locale) ? "生命周期规则" : "Lifecycle rule",
      ),
    );
  });
  if (normalized.length > 3) {
    lines.push(isChinese(locale) ? `另有 ${normalized.length - 3} 条规则` : `+${normalized.length - 3} more rule(s)`);
  }
  return lines;
}

function policyStatements(policy: RecordValue | null | undefined): RecordValue[] {
  if (!policy) return [];
  const raw = policy.Statement ?? policy.statement;
  if (Array.isArray(raw)) return raw.map(asRecord).filter((entry): entry is RecordValue => Boolean(entry));
  const statement = asRecord(raw);
  return statement ? [statement] : [];
}

function statementField(statement: RecordValue, field: string): unknown {
  const lowerCamel = `${field[0].toLowerCase()}${field.slice(1)}`;
  return statement[field] ?? statement[lowerCamel] ?? statement[field.toLowerCase()];
}

export function buildBucketPolicySummaryLines(policy?: RecordValue | null, locale: UiLanguage = "en"): string[] {
  if (!policy) return [isChinese(locale) ? "策略：未设置" : "Policy: Not set"];
  const statements = policyStatements(policy);
  const lines = isChinese(locale)
    ? ["策略：已配置", `语句：${statements.length}`]
    : ["Policy: Configured", `Statements: ${statements.length}`];
  const version = stringValue(policy.Version ?? policy.version);
  if (version) lines.push(`${isChinese(locale) ? "版本" : "Version"}: ${version}`);
  statements.slice(0, 2).forEach((statement, index) => {
    const sid = stringValue(statement.Sid ?? statement.sid) ||
      (isChinese(locale) ? `语句 ${index + 1}` : `Statement ${index + 1}`);
    const effect = stringValue(statement.Effect ?? statement.effect) || "-";
    const action = statementField(statement, "Action") ?? statementField(statement, "NotAction");
    const actionLabel = statementField(statement, "Action") == null && action != null ? "NotAction" : "Action";
    const condition = asRecord(statement.Condition ?? statement.condition);
    lines.push(
      joinParts(
        [`${effect} ${sid}`, action != null ? `${actionLabel}: ${displayValue(action)}` : null],
        isChinese(locale) ? "策略语句" : "Policy statement",
      ),
    );
    if (condition && Object.keys(condition).length > 0) {
      lines.push(isChinese(locale) ? `${sid}：包含条件` : `${sid}: has condition`);
    }
  });
  if (statements.length > 2) {
    lines.push(isChinese(locale) ? `另有 ${statements.length - 2} 条语句` : `+${statements.length - 2} more statement(s)`);
  }
  return lines;
}

export function buildCorsRuleSummaryLines(rules?: unknown[] | null, locale: UiLanguage = "en"): string[] {
  const normalized = listValue(rules).map(asRecord).filter((rule): rule is RecordValue => Boolean(rule));
  if (normalized.length === 0) return [isChinese(locale) ? "规则：0（未配置）" : "Rules: 0 (not configured)"];
  const lines = [`${isChinese(locale) ? "规则" : "Rules"}: ${normalized.length}`];
  normalized.slice(0, 3).forEach((rule, index) => {
    const methods = displayValue(rule.AllowedMethods ?? rule.allowedMethods ?? []);
    const origins = displayValue(rule.AllowedOrigins ?? rule.allowedOrigins ?? []);
    lines.push(
      joinParts(
        [
          isChinese(locale) ? `规则 ${index + 1}` : `Rule ${index + 1}`,
          methods ? `${isChinese(locale) ? "方法" : "Methods"}: ${methods}` : null,
          origins ? `${isChinese(locale) ? "来源" : "Origins"}: ${origins}` : null,
        ],
        isChinese(locale) ? "CORS 规则" : "CORS rule",
      ),
    );
  });
  if (normalized.length > 3) {
    lines.push(isChinese(locale) ? `另有 ${normalized.length - 3} 条规则` : `+${normalized.length - 3} more rule(s)`);
  }
  return lines;
}

function notificationFilterSummary(rule: RecordValue): string | null {
  const filter = asRecord(rule.Filter ?? rule.filter);
  const key = asRecord(filter?.Key ?? filter?.key);
  const parts = listValue(key?.FilterRules ?? key?.filterRules)
    .map(asRecord)
    .filter((entry): entry is RecordValue => Boolean(entry))
    .map((entry) => {
      const name = stringValue(entry.Name ?? entry.name);
      const value = stringValue(entry.Value ?? entry.value);
      return name && value ? `${name}: ${value}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return parts.length > 0 ? parts.join(", ") : null;
}

function notificationDestination(type: string, rule: RecordValue): string | null {
  const fieldByType: Record<string, string> = {
    topic: "TopicArn",
    queue: "QueueArn",
    lambda: "LambdaFunctionArn",
  };
  const value = stringValue(rule[fieldByType[type]]);
  return value ? value.split(":").pop() || value : null;
}

export function buildNotificationSummaryLines(
  configuration?: RecordValue | null,
  locale: UiLanguage = "en",
): string[] {
  const config = configuration ?? {};
  const specs = [
    ["topic", "TopicConfigurations"],
    ["queue", "QueueConfigurations"],
    ["lambda", "LambdaFunctionConfigurations"],
  ] as const;
  const entries = specs.flatMap(([type, key]) =>
    listValue(config[key]).map(asRecord).filter((entry): entry is RecordValue => Boolean(entry)).map((entry) => ({ type, entry }))
  );
  const eventBridge = asRecord(config.EventBridgeConfiguration);
  const configured = entries.length > 0 || Boolean(eventBridge);
  const lines = [`${isChinese(locale) ? "已配置" : "Configured"}: ${yesNo(configured, locale)}`];
  const notificationTypeLabels: Record<(typeof specs)[number][1], string> = {
    TopicConfigurations: "主题配置",
    QueueConfigurations: "队列配置",
    LambdaFunctionConfigurations: "Lambda 函数配置",
  };
  specs.forEach(([, key]) => {
    const count = listValue(config[key]).length;
    if (count > 0) {
      lines.push(
        `${isChinese(locale) ? notificationTypeLabels[key] : key.replace("Configurations", " configurations")}: ${count}`,
      );
    }
  });
  entries.slice(0, 3).forEach(({ type, entry }, index) => {
    const typeLabel = isChinese(locale)
      ? ({ topic: "主题", queue: "队列", lambda: "Lambda 函数" } as const)[type]
      : type;
    const id = stringValue(entry.Id ?? entry.ID ?? entry.id) || `${typeLabel} ${index + 1}`;
    const events = displayValue(entry.Events ?? entry.events ?? []);
    const destination = notificationDestination(type, entry);
    lines.push(
      joinParts(
        [
          `${typeLabel}: ${id}`,
          events ? `${isChinese(locale) ? "事件" : "Events"}: ${events}` : null,
          destination ? `${isChinese(locale) ? "目标" : "Destination"}: ${destination}` : null,
          notificationFilterSummary(entry),
        ],
        isChinese(locale) ? "通知规则" : "Notification rule",
      ),
    );
  });
  if (eventBridge) lines.push(isChinese(locale) ? "EventBridge：已配置" : "EventBridge: Configured");
  if (entries.length > 3) {
    lines.push(isChinese(locale) ? `另有 ${entries.length - 3} 条通知` : `+${entries.length - 3} more notification(s)`);
  }
  return lines;
}

export function buildBucketTagSummaryLines(
  tags?: BucketFeatureTagSummary[] | null,
  locale: UiLanguage = "en",
): string[] {
  const normalized = Array.isArray(tags)
    ? tags.filter((tag) => (tag.key ?? "").trim())
    : [];
  if (normalized.length === 0) return [isChinese(locale) ? "标签：0（未配置）" : "Tags: 0 (not configured)"];
  const lines = [`${isChinese(locale) ? "标签" : "Tags"}: ${normalized.length}`];
  normalized.slice(0, 3).forEach((tag) => {
    const key = (tag.key ?? "").trim();
    const value = tag.value ?? "";
    lines.push(value ? `${key}: ${value}` : `${key}: ${isChinese(locale) ? "（空值）" : "(empty value)"}`);
  });
  if (normalized.length > 3) {
    lines.push(isChinese(locale) ? `另有 ${normalized.length - 3} 个标签` : `+${normalized.length - 3} more tag(s)`);
  }
  return lines;
}

export function buildWebsiteSummaryLines(website?: RecordValue | null, locale: UiLanguage = "en"): string[] {
  const routingRules = listValue(website?.routing_rules);
  const redirect = asRecord(website?.redirect_all_requests_to);
  const redirectHost = stringValue(redirect?.host_name);
  const indexDocument = stringValue(website?.index_document);
  const errorDocument = stringValue(website?.error_document);
  const enabled = Boolean(redirectHost || indexDocument || routingRules.length > 0);
  const lines = [`${isChinese(locale) ? "已启用" : "Enabled"}: ${yesNo(enabled, locale)}`];
  if (indexDocument) lines.push(`${isChinese(locale) ? "索引文档" : "Index document"}: ${indexDocument}`);
  if (errorDocument) lines.push(`${isChinese(locale) ? "错误文档" : "Error document"}: ${errorDocument}`);
  if (redirectHost) lines.push(`${isChinese(locale) ? "重定向主机" : "Redirect host"}: ${redirectHost}`);
  if (routingRules.length > 0) {
    lines.push(`${isChinese(locale) ? "路由规则" : "Routing rules"}: ${routingRules.length}`);
  }
  return lines;
}

export function buildLoggingSummaryLines(logging?: RecordValue | null, locale: UiLanguage = "en"): string[] {
  const targetBucket = stringValue(logging?.target_bucket);
  const targetPrefix = stringValue(logging?.target_prefix);
  const enabled = Boolean(logging?.enabled && targetBucket);
  const lines = [`${isChinese(locale) ? "已启用" : "Enabled"}: ${yesNo(enabled, locale)}`];
  if (targetBucket) lines.push(`${isChinese(locale) ? "目标存储桶" : "Target bucket"}: ${targetBucket}`);
  if (targetPrefix) lines.push(`${isChinese(locale) ? "目标前缀" : "Target prefix"}: ${targetPrefix}`);
  return lines;
}

export function buildEncryptionSummaryLines(rules?: unknown[] | null, locale: UiLanguage = "en"): string[] {
  const normalized = listValue(rules).map(asRecord).filter((rule): rule is RecordValue => Boolean(rule));
  if (normalized.length === 0) return [isChinese(locale) ? "已启用：否" : "Enabled: No"];
  const lines = isChinese(locale)
    ? ["已启用：是", `规则：${normalized.length}`]
    : ["Enabled: Yes", `Rules: ${normalized.length}`];
  const firstRule = normalized[0];
  const defaultSse = asRecord(firstRule.ApplyServerSideEncryptionByDefault);
  const algorithm = stringValue(defaultSse?.SSEAlgorithm);
  const kmsKeyId = stringValue(defaultSse?.KMSMasterKeyID);
  if (algorithm) lines.push(`${isChinese(locale) ? "算法" : "Algorithm"}: ${algorithm}`);
  if (kmsKeyId) lines.push(`${isChinese(locale) ? "KMS 密钥" : "KMS key"}: ${kmsKeyId}`);
  return lines;
}
