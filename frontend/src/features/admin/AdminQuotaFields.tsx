/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { WorkflowSection } from "../../components/WorkflowPage";
import { SettingsSection } from "../../components/settings/SettingsLayout";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import { useI18n } from "../../i18n";
import { rgwMessages } from "./adminRgwMessages";

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
      title={t(rgwMessages.quotas)}
      description={t({ en: "Set optional storage and object limits. Leave a value empty to disable that limit.", zh: "设置可选的存储空间和对象限制。留空即可停用对应限制。" })}
    >
      <div className={compact ? "settings-fields sm:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2">
          <UiInput
            label={t(rgwMessages.storageQuota)}
            name="quota_max_size_gb"
            error={errors.quota_max_size_gb}
            type="number"
            min={0}
            step="any"
            value={storageValue}
            disabled={disabled}
            onChange={(event) => onStorageValueChange(event.target.value)}
            placeholder={t(rgwMessages.noLimit)}
          />
          <UiSelect
            label={t(rgwMessages.unit)}
            aria-label={t({ en: "Storage quota unit", zh: "存储配额单位" })}
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
          label={t(rgwMessages.objectQuota)}
          name="quota_max_objects"
          error={errors.quota_max_objects}
          type="number"
          min={0}
          step={1}
          value={objectValue}
          disabled={disabled}
          onChange={(event) => onObjectValueChange(event.target.value)}
          placeholder={t(rgwMessages.noLimit)}
        />
      </div>
    </Section>
  );
}
