/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  adminRgwNoLimit,
} from "./adminRgwMessages";
import { useI18n } from "../../i18n";
import { WorkflowSection } from "../../components/WorkflowPage";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";

type AdminQuotaFieldsProps = {
  storageValue: string;
  storageUnit: string;
  objectValue: string;
  disabled: boolean;
  compact?: boolean;
  errors?: Record<string, string | undefined>;
  onStorageValueChange: (value: string) => void;
  onStorageUnitChange: (value: string) => void;
  onObjectValueChange: (value: string) => void;
};

export default function AdminQuotaFields({
  storageValue,
  storageUnit,
  objectValue,
  disabled,
  compact = false,
  errors = {},
  onStorageValueChange,
  onStorageUnitChange,
  onObjectValueChange,
}: AdminQuotaFieldsProps) {
  const { t } = useI18n();
  const Section = compact ? SettingsSection : WorkflowSection;
  return (
    <Section
      presentation="compact"
      title={t({
        en: "Quotas",
        fr: "Quotas",
        de: "Kontingente",
        zh: "配额",
      })}
      description={t({
        en: "Set optional storage and object limits. Leave a value empty to disable that limit.",
        fr: "Définissez des limites facultatives de stockage et d’objets. Laissez un champ vide pour désactiver sa limite.",
        de: "Optionale Speicher- und Objektlimits festlegen. Lassen Sie einen Wert leer, um das jeweilige Limit zu deaktivieren.",
        zh: "设置可选的存储容量和对象数量上限。留空可禁用对应限制。",
      })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2">
          <UiInput
            label={t({
              en: "Storage quota",
              fr: "Quota de stockage",
              de: "Speicherkontingent",
              zh: "存储配额",
            })}
            name="quota_max_size_gb"
            error={errors.quota_max_size_gb}
            type="number"
            min={0}
            step="any"
            value={storageValue}
            disabled={disabled}
            onChange={(event) => onStorageValueChange(event.target.value)}
            placeholder={t(adminRgwNoLimit)}
          />
          <UiSelect
            label={t({
              en: "Unit",
              fr: "Unité",
              de: "Einheit",
              zh: "单位",
            })}
            aria-label={t({
              en: "Storage quota unit",
              fr: "Unité du quota de stockage",
              de: "Einheit des Speicherkontingents",
              zh: "存储配额单位",
            })}
            value={storageUnit}
            disabled={disabled}
            onChange={(event) => onStorageUnitChange(event.target.value)}
          >
            <option value="MiB">MiB</option>
            <option value="GiB">GiB</option>
            <option value="TiB">TiB</option>
          </UiSelect>
        </div>
        <UiInput
          label={t({
            en: "Object quota",
            fr: "Quota d’objets",
            de: "Objektkontingent",
            zh: "对象数量配额",
          })}
          name="quota_max_objects"
          error={errors.quota_max_objects}
          type="number"
          min={0}
          step={1}
          value={objectValue}
          disabled={disabled}
          onChange={(event) => onObjectValueChange(event.target.value)}
          placeholder={t(adminRgwNoLimit)}
        />
      </div>
    </Section>
  );
}
