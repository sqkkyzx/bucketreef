import type { ManagerToolAccess } from "../../api/users";
import {
  SettingsItem,
  SettingsSection,
  SettingsToggleAction,
} from "../../components/settings/SettingsLayout";
import {
  type ManagerToolDefinition,
  type ManagerToolKey,
  normalizeManagerToolAccess,
} from "./adminAccessConfig";
import type { UiTone } from "../../components/ui/styles";
import { useAdminControlText } from "./adminControlMessages";

type WorkspaceAccessToggle = {
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  ariaLabel: string;
  onChange: (value: boolean) => void;
  badge?: {
    visible?: boolean;
    label: string;
    tone?: UiTone;
  };
};

export function AdminAccessToggleSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: WorkspaceAccessToggle[];
}) {
  return (
    <SettingsSection title={title} description={description} presentation="compact">
      {items.map((item) => {
        const disabled = Boolean(item.disabled);
        return (
          <SettingsItem
            key={item.ariaLabel}
            title={item.title}
            description={item.description}
            compact
            action={
              <SettingsToggleAction
                checked={item.checked}
                disabled={disabled}
                onChange={item.onChange}
                ariaLabel={item.ariaLabel}
                badge={item.badge}
              />
            }
          />
        );
      })}
    </SettingsSection>
  );
}

export function WorkspaceAccessSection({
  description,
  cephAdmin,
  storageOps,
}: {
  description: string;
  cephAdmin: WorkspaceAccessToggle;
  storageOps: WorkspaceAccessToggle;
}) {
  const { t } = useAdminControlText();
  return (
    <AdminAccessToggleSection
      title={t("Mass management workspaces")}
      description={t(description)}
      items={[cephAdmin, storageOps]}
    />
  );
}

export function BrowserAccessSection({
  checked,
  onChange,
  description = "Configure Browser features for this admin subject.",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}) {
  const { t } = useAdminControlText();
  return (
    <AdminAccessToggleSection
      title={t("Browser")}
      description={t(description)}
      items={[{
        title: t("Technical S3 tools"),
        description: t("Adds versions, metadata, batch operations, and bucket maintenance tools to /browser. Display density (rows and action toolbar) and optional panels remain personal choices for every Browser user."),
        checked,
        onChange,
        ariaLabel: t("Enable technical S3 tools"),
      }]}
    />
  );
}

export function ManagerToolAccessSection({
  title,
  description,
  tools,
  access,
  onChange,
  isToolDisabled,
  additionalItems = [],
}: {
  title: string;
  description: string;
  tools: ManagerToolDefinition[];
  access?: ManagerToolAccess | null;
  onChange: (key: ManagerToolKey, value: boolean) => void;
  isToolDisabled?: (tool: ManagerToolDefinition) => boolean;
  additionalItems?: WorkspaceAccessToggle[];
}) {
  const { t } = useAdminControlText();
  const normalizedAccess = normalizeManagerToolAccess(access);
  return (
    <AdminAccessToggleSection
      title={t(title)}
      description={t(description)}
      items={[...additionalItems, ...tools.map<WorkspaceAccessToggle>((tool) => ({
        title: t(tool.title),
        description: t(tool.description),
        checked: Boolean(normalizedAccess[tool.key]),
        disabled: isToolDisabled ? isToolDisabled(tool) : !tool.enabled,
        onChange: (value) => onChange(tool.key, value),
        ariaLabel: tool.title,
        badge: { visible: !tool.enabled, label: t("Disabled globally"), tone: "neutral" },
      }))]}
    />
  );
}
