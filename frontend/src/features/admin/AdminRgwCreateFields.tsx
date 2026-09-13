/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import {
  adminRgwUserDetails,
  adminRgwEmail,
  adminRgwTags,
  adminRgwAddATagForThisRGWUser,
  adminRgwLoadingExistingTagCatalog,
} from "./adminRgwMessages";
import { useI18n } from "../../i18n";
import type { ComponentProps } from "react";
import UiInput from "../../components/ui/UiInput";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import UiTagEditor from "../../components/UiTagEditor";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import type { UiTagDefinition } from "../../utils/uiTags";
import AdminRgwEndpointField from "./AdminRgwEndpointField";
import AdminQuotaFields from "./AdminQuotaFields";

type Draft = {
  name: string; uid?: string; email: string; storage_endpoint_id: string;
  quota_max_size_gb: string; quota_max_size_unit: string; quota_max_objects: string;
  tags: UiTagDefinition[];
};

export default function AdminRgwCreateFields({kind, value, onChange, errors, busy, endpoint, tags}: {
  kind: "account" | "user"; value: Draft; onChange: (patch: Partial<Draft>) => void;
  errors: Record<string, string | undefined>; busy: boolean;
  endpoint: Omit<ComponentProps<typeof AdminRgwEndpointField>, "value" | "onChange" | "error">;
  tags: { catalog: ComponentProps<typeof UiTagEditor>["catalog"]; loading: boolean; error: string | null };
}) {
  const { t } = useI18n();
  return <>
    <SettingsSection presentation="compact" title={kind === "account" ? t({
      en: "Account details",
      fr: "Détails du compte",
      de: "Kontodetails",
      zh: "账户详情",
    }) : t(adminRgwUserDetails)}>
      <div className="settings-fields">
        <div className="grid gap-3 md:grid-cols-2">
          <UiInput label={kind === "account" ? t({
            en: "Account name *",
            fr: "Nom du compte *",
            de: "Kontoname *",
            zh: "账户名称 *",
          }) : t({
            en: "Display name *",
            fr: "Nom affiché *",
            de: "Anzeigename *",
            zh: "显示名称 *",
          })} name="name" value={value.name}
            error={errors.name} required onChange={event => onChange({name: event.target.value})} />
          {kind === "user" && <UiInput label={t({
            en: "UID (optional)",
            fr: "UID (facultatif)",
            de: "UID (optional)",
            zh: "UID（可选）",
          })} name="uid" value={value.uid ?? ""} placeholder="user-123"
            onChange={event => onChange({uid: event.target.value})} />}
          <UiInput label={kind === "account" ? t({
            en: "Email contact",
            fr: "E-mail de contact",
            de: "Kontakt-E-Mail",
            zh: "联系邮箱",
          }) : t(adminRgwEmail)} name="email" type="email" value={value.email}
            error={errors.email} placeholder="contact@example.com" onChange={event => onChange({email: event.target.value})} />
        </div>
        <AdminRgwEndpointField {...endpoint} value={value.storage_endpoint_id} error={errors.storage_endpoint_id}
          onChange={storage_endpoint_id => onChange({storage_endpoint_id})} />
        {tags.error && <UiInlineMessage tone="warning">{tags.error}</UiInlineMessage>}
        <UiTagEditor label={t(adminRgwTags)} tags={value.tags} catalog={tags.catalog} disabled={busy}
          onChange={next => onChange({tags: next})} placeholder={kind === "account" ? t({
            en: "Add a tag for this account",
            fr: "Ajouter une étiquette à ce compte",
            de: "Tag für dieses Konto hinzufügen",
            zh: "为此账户添加标签",
          }) : t(adminRgwAddATagForThisRGWUser)}
          hint={tags.loading ? t(adminRgwLoadingExistingTagCatalog) : undefined} />
      </div>
    </SettingsSection>
    <AdminQuotaFields compact errors={errors} storageValue={value.quota_max_size_gb} storageUnit={value.quota_max_size_unit}
      objectValue={value.quota_max_objects} disabled={busy}
      onStorageValueChange={quota_max_size_gb => onChange({quota_max_size_gb})}
      onStorageUnitChange={quota_max_size_unit => onChange({quota_max_size_unit})}
      onObjectValueChange={quota_max_objects => onChange({quota_max_objects})} />
  </>;
}
