/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { useCallback } from "react";
import { useI18n } from "../../i18n";

const zhMessages: Record<string, string> = {
  Connection: "连接",
  Name: "名称",
  Tags: "标签",
  Endpoint: "端点",
  "Choose a configured endpoint or enter an operator-approved public HTTPS custom endpoint.": "选择已配置的端点，或输入经运维人员批准的公共 HTTPS 自定义端点。",
  "Endpoint source": "端点来源",
  "Configured endpoint": "已配置端点",
  "Custom endpoint": "自定义端点",
  "Loading endpoints...": "正在加载端点…",
  "Select endpoint": "选择端点",
  "No configured endpoint": "没有已配置端点",
  "Loading endpoint...": "正在加载端点…",
  Provider: "提供商",
  Region: "区域",
  "Endpoint URL": "端点 URL",
  "Force path style": "强制使用路径样式",
  "Verify TLS": "验证 TLS",
  "(auto)": "（自动）",
  Other: "其他",
  "Access key ID": "访问密钥 ID",
  "Secret access key": "秘密访问密钥",
  "Validating credentials...": "正在验证凭据…",
  "Credentials validated.": "凭据验证成功。",
  "Credentials are valid but permissions are limited (AccessDenied).": "凭据有效，但权限受限（AccessDenied）。",
  "Invalid S3 credentials.": "S3 凭据无效。",
  "Unable to validate credentials on this endpoint.": "无法在此端点验证凭据。",
  "Unable to reach the S3 endpoint (network/TLS/endpoint issue).": "无法连接 S3 端点（网络、TLS 或端点配置问题）。",
  "Connection name is required.": "必须填写连接名称。",
  "Select a configured endpoint.": "请选择已配置的端点。",
  "Endpoint URL is required.": "必须填写端点 URL。",
  "S3 credentials are required.": "必须填写 S3 凭据。",
  "Provide both access key ID and secret access key to update credentials.": "更新凭据时必须同时填写访问密钥 ID 和秘密访问密钥。",
  "Enable access to manager and/or browser.": "请启用管理控制台和/或对象浏览器访问权限。",
  "Enter a valid endpoint URL.": "请输入有效的端点 URL。",
};

function s3ConnectionText(message: string, locale: "en" | "fr" | "de" | "zh"): string {
  return locale === "zh" ? zhMessages[message] ?? message : message;
}

export function useS3ConnectionText() {
  const { locale } = useI18n();
  const t = useCallback((message: string) => s3ConnectionText(message, locale), [locale]);
  return { locale, t };
}
