/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageObjects,
} from "../uiMessages";
import { useI18n } from "../i18n";
import { BucketOverview } from "../api/stats";
import { formatBytes, formatCompactNumber } from "../utils/format";
import PageBanner from "./PageBanner";
import { cx, uiCardClass, uiCardMutedClass, uiLabelClass, uiMutedTextClass, uiTitleTextClass } from "./ui/styles";
import UsageTile from "./UsageTile";

type QuotaProps = {
  used?: number | null;
  quotaBytes?: number | null;
};

type ObjectQuotaProps = {
  used?: number | null;
  quota?: number | null;
};

type StorageUsageCardProps = {
  accountName?: string;
  storage: QuotaProps;
  objects: ObjectQuotaProps;
  bucketOverview?: BucketOverview | null;
  loading?: boolean;
  metricsDisabled?: boolean;
  errorMessage?: string | null;
};

export default function StorageUsageCard({
  accountName,
  storage,
  objects,
  bucketOverview,
  loading,
  metricsDisabled,
  errorMessage,
}: StorageUsageCardProps) {
  const { t } = useI18n();
  const hasBucketStats = Boolean(bucketOverview && bucketOverview.bucket_count > 0);

  return (
    <section className={cx(uiCardClass, "space-y-4 p-4")}>
      <header className="space-y-1">
        <p className="ui-caption font-semibold uppercase tracking-wide text-primary">{t({
          en: "Storage Usage",
          fr: "Utilisation du stockage",
          de: "Speichernutzung",
          zh: "存储用量",
        })}</p>
        <h3 className={cx("ui-section", uiTitleTextClass)}>
          {accountName ? t({
            en: `Storage usage for ${accountName}`,
            fr: `Utilisation du stockage de ${accountName}`,
            de: `Speichernutzung für ${accountName}`,
            zh: `${accountName} 的存储用量`,
          }) : t({
            en: "S3Account storage usage",
            fr: "Utilisation du stockage du compte S3",
            de: "Speichernutzung des S3-Kontos",
            zh: "S3 账户存储用量",
          })}
        </h3>
      </header>

      {metricsDisabled && <PageBanner tone="warning">{t({
        en: "Storage metrics are not available for these credentials.",
        fr: "Les métriques de stockage ne sont pas disponibles pour ces identifiants.",
        de: "Für diese Anmeldedaten sind keine Speichermetriken verfügbar.",
        zh: "当前凭据无法查看存储指标。",
      })}</PageBanner>}

      {!metricsDisabled && errorMessage && <PageBanner tone="error">{errorMessage}</PageBanner>}

      <div className="grid gap-2 sm:grid-cols-2">
        <UsageTile
          label={t({
            en: "Storage",
            fr: "Stockage",
            de: "Speicher",
            zh: "存储空间",
          })}
          used={storage.used}
          quota={storage.quotaBytes}
          formatter={formatBytes}
          quotaFormatter={formatBytes}
          loading={loading}
          emptyHint={t({
            en: "No storage quota defined.",
            fr: "Aucun quota de stockage défini.",
            de: "Kein Speicherkontingent festgelegt.",
            zh: "未设置存储配额。",
          })}
        />
        <UsageTile
          label={t({
            en: "Objects",
            fr: "Objets",
            de: "Objekte",
            zh: "对象数量",
          })}
          used={objects.used}
          quota={objects.quota}
          formatter={formatCompactNumber}
          quotaFormatter={(value) => (value != null ? value.toLocaleString() : "-")}
          loading={loading}
          unitHint={t(messageObjects)}
          emptyHint={t({
            en: "No object quota defined.",
            fr: "Aucun quota d’objets défini.",
            de: "Kein Objektkontingent festgelegt.",
            zh: "未设置对象数量配额。",
          })}
        />
      </div>

      {hasBucketStats && bucketOverview && !metricsDisabled && (
        <div className="grid gap-2 sm:grid-cols-3">
          <BucketStatCard
            label={t({
              en: "Active buckets",
              fr: "Buckets actifs",
              de: "Aktive Buckets",
              zh: "非空存储桶",
            })}
            value={`${bucketOverview.non_empty_buckets}/${bucketOverview.bucket_count}`}
            hint={t({
              en: "With data",
              fr: "Avec des données",
              de: "Mit Daten",
              zh: "包含数据",
            })}
          />
          <BucketStatCard label={t({
            en: "Empty buckets",
            fr: "Buckets vides",
            de: "Leere Buckets",
            zh: "空存储桶",
          })} value={bucketOverview.empty_buckets.toString()} hint={t({
            en: "No objects",
            fr: "Aucun objet",
            de: "Keine Objekte",
            zh: "没有对象",
          })} />
          <BucketStatCard
            label={t({
              en: "Average size",
              fr: "Taille moyenne",
              de: "Durchschnittliche Größe",
              zh: "平均大小",
            })}
            value={bucketOverview.avg_bucket_size_bytes ? formatBytes(bucketOverview.avg_bucket_size_bytes) : "—"}
            hint={
              bucketOverview.avg_objects_per_bucket
                ? `${formatCompactNumber(bucketOverview.avg_objects_per_bucket)} ${t(messageObjects)}`
                : t({
                  en: "Object count unavailable",
                  fr: "Nombre d’objets indisponible",
                  de: "Objektanzahl nicht verfügbar",
                  zh: "对象数量不可用",
                })
            }
          />
        </div>
      )}
    </section>
  );
}

type BucketStatProps = {
  label: string;
  value: string;
  hint?: string;
};

function BucketStatCard({ label, value, hint }: BucketStatProps) {
  return (
    <div className={cx(uiCardMutedClass, "p-3")}>
      <p className={uiLabelClass}>{label}</p>
      <p className={cx("mt-1.5 ui-title", uiTitleTextClass)}>{value}</p>
      {hint && <p className={cx("ui-caption", uiMutedTextClass)}>{hint}</p>}
    </div>
  );
}
