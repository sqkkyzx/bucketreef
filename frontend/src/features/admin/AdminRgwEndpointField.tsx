/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import type { StorageEndpoint } from "../../api/storageEndpoints";
import UiSelect from "../../components/ui/UiSelect";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import { useI18n } from "../../i18n";
import { rgwMessages } from "./adminRgwMessages";

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
      <option value="" disabled>{loading ? t(rgwMessages.loading) : endpoints.length ? t({ en: "Select", zh: "请选择" }) : operation === "accounts" ? t({ en: "No Ceph endpoint with account API enabled", zh: "没有启用账户 API 的 Ceph 端点" }) : t({ en: "No Ceph endpoint with admin enabled", zh: "没有启用管理 API 的 Ceph 端点" })}</option>
      {endpoints.map(endpoint => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}{endpoint.is_default ? " (default)" : ""}</option>)}
    </UiSelect>
    {value && (permissionLoading ? <UiInlineMessage tone="info" role="status">{t({ en: "Checking endpoint permissions...", zh: "正在检查端点权限…" })}</UiInlineMessage>
      : permissionError ? <UiInlineMessage tone="warning">{permissionError}. {t({ en: "Validation is disabled until permissions can be verified.", zh: "在验证权限前将停用校验。" })}</UiInlineMessage>
      : !canWrite ? <UiInlineMessage tone="warning">{t({ en: "Selected endpoint does not allow this operation: missing", zh: "所选端点不允许此操作：缺少" })} <code>{operation}=write</code>.</UiInlineMessage> : null)}
  </div>;
}
