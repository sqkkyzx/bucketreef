/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate } from "../../i18n";
import type { UiLanguage } from "../../components/language";
import type { BrowserSettings, BucketCorsStatus } from "../../api/browserContracts";
import {
  DEFAULT_DIRECT_DOWNLOAD_PARALLELISM,
  DEFAULT_DIRECT_UPLOAD_PARALLELISM,
  DEFAULT_OTHER_OPERATIONS_PARALLELISM,
  DEFAULT_PROXY_DOWNLOAD_PARALLELISM,
  DEFAULT_PROXY_UPLOAD_PARALLELISM,
} from "./browserConstants";
import { clampParallelism } from "./browserUtils";

const STS_REFRESH_WINDOW_MS = 2 * 60 * 1000;
export const CORS_DIRECT_TRANSFER_WARNING =
  "Direct download/upload is not allowed on this bucket.";

type TransferParallelismSettings = Pick<
  BrowserSettings,
  | "direct_upload_parallelism"
  | "proxy_upload_parallelism"
  | "direct_download_parallelism"
  | "proxy_download_parallelism"
  | "other_operations_parallelism"
>;

type BrowserTransferParallelism = {
  upload: number;
  download: number;
  otherOperations: number;
};

export type BrowserTransferAccessBadge = {
  label: string;
  title: string;
  tone: "danger" | "warning" | "info" | "success";
  indicatorClassName: string;
};

type BrowserCorsAvailability = "enabled" | "disabled" | "unknown";

export function resolveBrowserCorsAvailability(
  status: BucketCorsStatus | null | undefined,
): BrowserCorsAvailability {
  if (!status || status.error) return "unknown";
  return status.enabled ? "enabled" : "disabled";
}

export function resolveBrowserTransferParallelism(
  settings: TransferParallelismSettings | null | undefined,
  useProxyTransfers: boolean,
): BrowserTransferParallelism {
  const uploadFallback = useProxyTransfers
    ? DEFAULT_PROXY_UPLOAD_PARALLELISM
    : DEFAULT_DIRECT_UPLOAD_PARALLELISM;
  const downloadFallback = useProxyTransfers
    ? DEFAULT_PROXY_DOWNLOAD_PARALLELISM
    : DEFAULT_DIRECT_DOWNLOAD_PARALLELISM;
  const uploadValue = useProxyTransfers
    ? settings?.proxy_upload_parallelism
    : settings?.direct_upload_parallelism;
  const downloadValue = useProxyTransfers
    ? settings?.proxy_download_parallelism
    : settings?.direct_download_parallelism;
  const otherOperationsValue =
    settings?.other_operations_parallelism ??
    DEFAULT_OTHER_OPERATIONS_PARALLELISM;

  return {
    upload: clampParallelism(uploadValue ?? uploadFallback, uploadFallback),
    download: clampParallelism(
      downloadValue ?? downloadFallback,
      downloadFallback,
    ),
    otherOperations: clampParallelism(
      otherOperationsValue,
      DEFAULT_OTHER_OPERATIONS_PARALLELISM,
    ),
  };
}

export function isStsCredentialsExpiring(
  expiration: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!expiration) return true;
  const expiresAt = new Date(expiration).getTime();
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - nowMs <= STS_REFRESH_WINDOW_MS;
}

type BrowserTransferWarningsInput = {
  warningMessage: string | null;
  corsFixError: string | null;
  stsCredentialsError: string | null;
  corsEnabled: boolean | null;
  proxyAllowed: boolean;
};

export function buildBrowserTransferWarnings({
  warningMessage,
  corsFixError,
  stsCredentialsError,
  corsEnabled,
  proxyAllowed,
}: BrowserTransferWarningsInput): string[] {
  const items = [warningMessage, corsFixError, stsCredentialsError].filter(
    (item): item is string => Boolean(item),
  );
  if (corsEnabled === false) {
    items.push(CORS_DIRECT_TRANSFER_WARNING);
    if (!proxyAllowed) {
      items.push("Proxy transfers are disabled in settings.");
    }
  }
  return items;
}

export function resolveDirectCredentialStsTooltip(
  contextKind: "connection" | "s3_user" | null,
  locale: UiLanguage = "en",
): string {
  if (contextKind === "connection") {
    return translate({
      en: "STS is not available for S3 connections. Presigned URLs are used instead.",
      fr: "STS n’est pas disponible pour les connexions S3. Des URL présignées sont utilisées.",
      de: "STS ist für S3-Verbindungen nicht verfügbar. Stattdessen werden vorsignierte URLs verwendet.",
      zh: "S3 连接不支持 STS，将使用预签名 URL。",
    }, locale);
  }
  if (contextKind === "s3_user") {
    return translate({
      en: "STS is not available for S3 users. Presigned URLs are used instead.",
      fr: "STS n’est pas disponible pour les utilisateurs S3. Des URL présignées sont utilisées.",
      de: "STS ist für S3-Benutzer nicht verfügbar. Stattdessen werden vorsignierte URLs verwendet.",
      zh: "S3 用户不支持 STS，将使用预签名 URL。",
    }, locale);
  }
  return "";
}

type BrowserTransferAccessBadgeInput = {
  locale?: UiLanguage;
  hasContext: boolean;
  corsEnabled: boolean | null;
  proxyAllowed: boolean;
  useProxyTransfers: boolean;
  sseActive: boolean;
  hasStsCredentials: boolean;
  stsExpirationLabel: string;
  directCredentialStsTooltip: string;
};

export function resolveBrowserTransferAccessBadge({
  locale = "en",
  hasContext,
  corsEnabled,
  proxyAllowed,
  useProxyTransfers,
  sseActive,
  hasStsCredentials,
  stsExpirationLabel,
  directCredentialStsTooltip,
}: BrowserTransferAccessBadgeInput): BrowserTransferAccessBadge | null {
  if (!hasContext) return null;
  if (corsEnabled === false && !proxyAllowed) {
    return {
      label: translate({
        en: "Unavailable",
        fr: "Indisponible",
        de: "Nicht verfügbar",
        zh: "不可用",
      }, locale),
      title:
        translate({
          en: "Download/Upload unavailable: CORS is disabled and proxy transfers are disabled.",
          fr: "Téléchargement et téléversement indisponibles : CORS et les transferts par proxy sont désactivés.",
          de: "Download/Upload nicht verfügbar: CORS und Proxyübertragungen sind deaktiviert.",
          zh: "无法下载或上传：CORS 和代理传输均已禁用。",
        }, locale),
      tone: "danger",
      indicatorClassName:
        "border-rose-200/70 bg-rose-200/60 dark:border-rose-400/40 dark:bg-rose-400/25",
    };
  }
  if (useProxyTransfers) {
    return {
      label: translate({
        en: "Proxy",
        fr: "Proxy",
        de: "Proxy",
        zh: "代理",
      }, locale),
      title: translate({
        en: "Download/Upload mode: Backend proxy transfers are active.",
        fr: "Mode de transfert : proxy du backend actif.",
        de: "Download/Upload-Modus: Backend-Proxyübertragungen sind aktiv.",
        zh: "下载/上传模式：后端代理传输已启用。",
      }, locale),
      tone: "warning",
      indicatorClassName:
        "border-amber-200/70 bg-amber-200/60 dark:border-amber-400/40 dark:bg-amber-400/25",
    };
  }
  if (sseActive) {
    return {
      label: "SSE-C",
      title:
        translate({
          en: "Download/Upload mode: SSE-C customer key is active for this bucket.",
          fr: "Mode de transfert : clé client SSE-C active pour ce bucket.",
          de: "Download/Upload-Modus: Der SSE-C-Kundenschlüssel ist für diesen Bucket aktiv.",
          zh: "下载/上传模式：此存储桶已启用 SSE-C 客户密钥。",
        }, locale),
      tone: "info",
      indicatorClassName:
        "border-sky-200/70 bg-sky-200/60 dark:border-sky-400/40 dark:bg-sky-400/25",
    };
  }
  if (hasStsCredentials) {
    return {
      label: "STS",
      title: stsExpirationLabel
        ? translate({
          en: `Download/Upload mode: STS credentials active (expires at ${stsExpirationLabel}).`,
          fr: `Mode de transfert : identifiants STS actifs (expiration : ${stsExpirationLabel}).`,
          de: `Download/Upload-Modus: STS-Zugangsdaten aktiv (Ablauf: ${stsExpirationLabel}).`,
          zh: `下载/上传模式：STS 凭据已启用（到期时间：${stsExpirationLabel}）。`,
        }, locale)
        : translate({
          en: "Download/Upload mode: STS credentials are active.",
          fr: "Mode de transfert : identifiants STS actifs.",
          de: "Download/Upload-Modus: STS-Zugangsdaten sind aktiv.",
          zh: "下载/上传模式：STS 凭据已启用。",
        }, locale),
      tone: "success",
      indicatorClassName:
        "border-emerald-200/70 bg-emerald-200/60 dark:border-emerald-400/40 dark:bg-emerald-400/25",
    };
  }
  return {
    label: translate({
      en: "Presign",
      fr: "URL présignée",
      de: "Vorsigniert",
      zh: "预签名",
    }, locale),
    title: directCredentialStsTooltip
      ? translate({
        en: `Download/Upload mode: Presigned URLs are active. ${directCredentialStsTooltip}`,
        fr: `Mode de transfert : URL présignées actives. ${directCredentialStsTooltip}`,
        de: `Download/Upload-Modus: Vorsignierte URLs sind aktiv. ${directCredentialStsTooltip}`,
        zh: `下载/上传模式：预签名 URL 已启用。${directCredentialStsTooltip}`,
      }, locale)
      : translate({
        en: "Download/Upload mode: Presigned URLs are active.",
        fr: "Mode de transfert : URL présignées actives.",
        de: "Download/Upload-Modus: Vorsignierte URLs sind aktiv.",
        zh: "下载/上传模式：预签名 URL 已启用。",
      }, locale),
    tone: "success",
    indicatorClassName:
      "border-emerald-200/70 bg-emerald-200/60 dark:border-emerald-400/40 dark:bg-emerald-400/25",
  };
}
