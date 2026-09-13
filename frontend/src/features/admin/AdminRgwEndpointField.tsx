/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import {
  messageLoading,
} from "../../uiMessages";
import { useI18n } from "../../i18n";
import type { StorageEndpoint } from "../../api/storageEndpoints";
import UiSelect from "../../components/ui/UiSelect";
import UiInlineMessage from "../../components/ui/UiInlineMessage";

export default function AdminRgwEndpointField({
  label, value, onChange, endpoints, loading, operation, permissionLoading, permissionError, canWrite, error,
}: {
  label: string; value: string; onChange: (value: string) => void;
  endpoints: StorageEndpoint[]; loading: boolean; operation: "accounts" | "users";
  permissionLoading: boolean; permissionError: string | null; canWrite: boolean; error?: string;
}) {
  const { t } = useI18n();
  return <div className="settings-fields">
    <UiSelect label={label} name="storage_endpoint_id" value={value} required error={error}
      onChange={event => onChange(event.target.value)} disabled={loading || endpoints.length === 0}>
      <option value="" disabled>{loading ? t(messageLoading) : endpoints.length ? t({
        en: "Select",
        fr: "Sélectionner",
        de: "Auswählen",
        zh: "选择",
      }) : operation === "accounts" ? t({
        en: "No Ceph endpoint with account API enabled",
        fr: "Aucun point de terminaison Ceph avec l’API des comptes activée",
        de: "Kein Ceph-Endpunkt mit aktivierter Konto-API",
        zh: "没有启用账户 API 的 Ceph 端点",
      }) : t({
        en: "No Ceph endpoint with admin enabled",
        fr: "Aucun point de terminaison Ceph avec l’administration activée",
        de: "Kein Ceph-Endpunkt mit aktivierter Administration",
        zh: "没有启用管理功能的 Ceph 端点",
      })}</option>
      {endpoints.map(endpoint => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}{endpoint.is_default ? t({
        en: " (default)",
        fr: " (par défaut)",
        de: " (Standard)",
        zh: "（默认）",
      }) : ""}</option>)}
    </UiSelect>
    {value && (permissionLoading ? <UiInlineMessage tone="info" role="status">{t({
      en: "Checking endpoint permissions...",
      fr: "Vérification des autorisations du point de terminaison…",
      de: "Endpunktberechtigungen werden geprüft…",
      zh: "正在检查端点权限…",
    })}</UiInlineMessage>
      : permissionError ? <UiInlineMessage tone="warning">{t({
        en: `${permissionError}. Validation is disabled until permissions can be verified.`,
        fr: `${permissionError}. La validation est désactivée tant que les autorisations ne peuvent pas être vérifiées.`,
        de: `${permissionError}. Die Validierung ist deaktiviert, bis die Berechtigungen geprüft werden können.`,
        zh: `${permissionError}。权限验证完成前，无法提交。`,
      })}</UiInlineMessage>
      : !canWrite ? <UiInlineMessage tone="warning">{t({
        en: `Selected endpoint does not allow this operation: missing ${operation}=write.`,
        fr: `Le point de terminaison sélectionné n’autorise pas cette opération : ${operation}=write manquant.`,
        de: `Der ausgewählte Endpunkt erlaubt diese Aktion nicht: ${operation}=write fehlt.`,
        zh: `所选端点不允许此操作：缺少 ${operation}=write。`,
      })}</UiInlineMessage> : null)}
  </div>;
}
