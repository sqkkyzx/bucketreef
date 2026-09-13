/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import ConfirmActionDialog from "../../../components/ConfirmActionDialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchOidcAdminProviders,
  fetchLdapAdminProviders,
  deleteOidcAdminProvider,
  deleteLdapAdminProvider,
  type OidcProviderAdminItem,
  type LdapProviderAdminItem,
} from "../../../api/authSettings";
import {
  isRecentWebAuthnVerificationCancelled,
  useRecentWebAuthnStepUp,
} from "../../../auth/useRecentWebAuthnStepUp";
import {
  SettingsItem,
  SettingsSection,
} from "../../../components/settings/SettingsLayout";
import {
  SettingsButton,
} from "../../../components/settings/SettingsControls";
import UiBadge from "../../../components/ui/UiBadge";
import UiInlineMessage from "../../../components/ui/UiInlineMessage";
import { extractApiError } from "../../../utils/apiError";
import { useAdminControlText } from "../adminControlMessages";

type Provider = OidcProviderAdminItem | LdapProviderAdminItem;
export default function AuthProviderList({ kind }: { kind: "oidc" | "ldap" }) {
  const { locale, t } = useAdminControlText();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { runWithStepUp, verificationDialog } = useRecentWebAuthnStepUp();
  const name = kind.toUpperCase();
  const path = `/admin/authentication-settings/${kind}`;
  const fetchProviders = useCallback(
    () =>
      kind === "oidc" ? fetchOidcAdminProviders() : fetchLdapAdminProviders(),
    [kind],
  );
  useEffect(() => {
    let active = true;
    fetchProviders()
      .then((value) => {
        if (active) setProviders(value);
      })
      .catch((err) => {
        if (active)
          setError(extractApiError(err, locale === "zh" ? `无法加载 ${name} 提供商。` : `Unable to load ${name} providers.`));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchProviders, locale, name]);
  const remove = async () => {
    if (!selected?.editable || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await runWithStepUp(() =>
        kind === "oidc"
          ? deleteOidcAdminProvider(selected.provider_id)
          : deleteLdapAdminProvider(selected.provider_id),
      );
      setProviders((current) =>
        current.filter(
          (provider) => provider.provider_id !== selected.provider_id,
        ),
      );
      setSelected(null);
      setMessage(locale === "zh" ? `${name} 提供商已删除。` : `${name} provider deleted.`);
    } catch (err) {
      if (!isRecentWebAuthnVerificationCancelled(err))
        setError(extractApiError(err, locale === "zh" ? `无法删除 ${name} 提供商。` : `Unable to delete ${name} provider.`));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <SettingsSection
      presentation="compact"
      title={locale === "zh" ? `${name} 提供商` : `${name} providers`}
      description={t("Login providers. Environment-managed settings remain locked.")}
    >
      <div className="mb-2 flex justify-end">
        <SettingsButton
          variant="secondary"
          disabled={busy}
          onClick={() => navigate(`${path}/new`)}
        >
          {locale === "zh" ? `添加 ${name} 提供商` : `Add ${name} provider`}
        </SettingsButton>
      </div>
      {error && <UiInlineMessage tone="error">{error}</UiInlineMessage>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">{locale === "zh" ? `正在加载 ${name} 提供商…` : `Loading ${name} providers...`}</p>
      ) : (
        providers.length === 0 && (
          <p className="py-3 settings-readonly">
            {locale === "zh" ? `尚未配置 ${name} 提供商。` : `No ${name} providers configured.`}
          </p>
        )
      )}
      {providers.map((provider) => (
        <SettingsItem
          compact
          key={provider.provider_id}
          title={provider.display_name}
          description={provider.provider_id}
          status={
            <>
              <UiBadge tone={provider.enabled ? "success" : "neutral"}>
                {provider.enabled ? t("Enabled") : t("Disabled")}
              </UiBadge>
              <UiBadge tone="neutral">
                {provider.source === "environment" ? t("Environment") : t("UI")}
              </UiBadge>
            </>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <SettingsButton
                variant="secondary"
                disabled={busy}
                aria-label={locale === "zh" ? `${provider.editable ? t("Edit") : t("View")} ${name} 提供商 ${provider.provider_id}` : `${provider.editable ? t("Edit") : t("View")} ${name} provider ${provider.provider_id}`}
                onClick={() =>
                  navigate(
                    `${path}/providers/${encodeURIComponent(provider.provider_id)}`,
                  )
                }
              >
                {provider.editable ? t("Edit") : t("View")}
              </SettingsButton>
              {provider.editable && (
                <SettingsButton
                  variant="ghost"
                  disabled={busy}
                  aria-label={locale === "zh" ? `删除 ${name} 提供商 ${provider.provider_id}` : `Delete ${name} provider ${provider.provider_id}`}
                  onClick={() => setSelected(provider)}
                >
                  {t("Delete")}
                </SettingsButton>
              )}
            </div>
          }
        />
      ))}
      {selected && (
        <ConfirmActionDialog
          title={locale === "zh" ? `删除 ${name} 提供商？` : `Delete ${name} provider?`}
          description={locale === "zh" ? `从登录选项中移除 ${selected.display_name}（${selected.provider_id}）。` : `Remove ${selected.display_name} (${selected.provider_id}) from sign-in options.`}
          confirmLabel={t("Delete provider")}
          loading={busy}
          warning={error ? <span role="alert">{error}</span> : undefined}
          impacts={[
            t("Users will no longer be able to sign in through this provider."),
          ]}
          onCancel={() => {
            if (!busy) setSelected(null);
          }}
          onConfirm={remove}
        />
      )}
      {verificationDialog}
    </SettingsSection>
  );
}
