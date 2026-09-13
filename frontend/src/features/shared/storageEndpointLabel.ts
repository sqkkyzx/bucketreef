/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { ExecutionContext } from "../../api/executionContexts";
import type { UiLanguage } from "../../components/language";

type StoredAccount = {
  name: string;
  storage_endpoint_name: string;
  storage_endpoint_is_default: boolean;
};

type AccountLike = ExecutionContext | StoredAccount;

function isExecutionContext(value: AccountLike): value is ExecutionContext {
  return "display_name" in value;
}

function isDefaultStorageEndpoint(context: AccountLike): boolean {
  // User-scoped connections are always explicit targets and should display their endpoint.
  if (isExecutionContext(context) && context.kind === "connection") return false;
  return isExecutionContext(context)
    ? context.endpoint_is_default
    : context.storage_endpoint_is_default;
}

function getStorageSuffix(context: AccountLike, locale: UiLanguage): string {
  if (isDefaultStorageEndpoint(context)) return "";
  const endpointName = isExecutionContext(context)
    ? context.endpoint_name
    : context.storage_endpoint_name;
  const label = endpointName || (locale === "zh" ? "自定义端点" : "Custom endpoint");
  return ` (${label})`;
}

export function formatAccountLabel(
  context: AccountLike,
  includeContextBadge = true,
  locale: UiLanguage = "en",
): string {
  const isS3User = isExecutionContext(context) && context.kind === "s3_user";
  const isConnection = isExecutionContext(context) && context.kind === "connection";
  const badge = includeContextBadge
    ? isConnection
      ? locale === "zh" ? " · 连接" : " · Connection"
      : isS3User
        ? locale === "zh" ? " · S3 用户" : " · S3 user"
        : ""
    : "";
  const displayName = isExecutionContext(context) ? context.display_name : context.name;
  const base = `${displayName}${badge}`;
  return `${base}${getStorageSuffix(context, locale)}`;
}
