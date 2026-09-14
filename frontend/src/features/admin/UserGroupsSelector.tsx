/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import type { Dispatch, SetStateAction } from "react";
import type { UiGroupSummary } from "../../api/groups";
import { formInlineDeleteClasses } from "../../components/formInlineActionClasses";
import { AdminAssociationLinkedTable, AdminAssociationPickerPanel, adminAssociationCheckboxClass, adminAssociationOptionLabelClass, adminAssociationOptionRowClass } from "./AdminAssociationPicker";
import { useAdminControlText } from "./adminControlMessages";

type UserGroupsSelectorProps = {
  groups: UiGroupSummary[];
  groupsLoaded: boolean;
  groupsLoading: boolean;
  maxVisibleOptions: number;
  selectedIds: number[];
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  visibleGroups: UiGroupSummary[];
  showPanel: boolean;
  setShowPanel: Dispatch<SetStateAction<boolean>>;
  selections: number[];
  setSelections: Dispatch<SetStateAction<number[]>>;
};

export default function UserGroupsSelector({
  groups,
  groupsLoaded,
  groupsLoading,
  maxVisibleOptions,
  selectedIds,
  setSelectedIds,
  search,
  setSearch,
  visibleGroups,
  showPanel,
  setShowPanel,
  selections,
  setSelections,
}: UserGroupsSelectorProps) {
  const { locale, t } = useAdminControlText();
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return (
    <AdminAssociationLinkedTable
      title={t("Linked UI groups")}
      toolbar={{
        countLabel: locale === "zh" ? `已关联 ${selectedIds.length} 个` : `${selectedIds.length} linked`,
        actionLabel: showPanel ? t("Close") : t("Add UI groups"),
        onAction: () => setShowPanel((current) => !current),
      }}
      headers={[{ label: t("Group") }, { label: t("Actions"), align: "right" }]}
      hasItems={selectedIds.length > 0}
      emptyLabel={t("No linked groups yet.")}
      rows={selectedIds.map((groupId) => (
        <tr key={groupId}>
          <td className="ui-table-primary">
            {groupById.get(groupId)?.name ?? (locale === "zh" ? `用户组 #${groupId}` : `Group #${groupId}`)}
          </td>
          <td className="ui-table-actions-cell w-px text-right">
            <button
              type="button"
              className={formInlineDeleteClasses}
              onClick={() =>
                setSelectedIds((current) => current.filter((id) => id !== groupId))
              }
            >
              {t("Remove")}
            </button>
          </td>
        </tr>
      ))}
      picker={
        showPanel ? (
          <AdminAssociationPickerPanel
            title={t("Add UI groups")}
            hint={t("(search by name)")}
            search={search}
            onSearchChange={setSearch}
            searchAriaLabel={t("Search UI groups")}
            loading={groupsLoading}
            availableCount={visibleGroups.length}
            maxVisibleOptions={maxVisibleOptions}
            selectedCount={selections.length}
            loadingLabel={t("Loading groups...")}
            emptyLabel={groupsLoaded ? t("No UI groups available.") : t("No results.")}
            addDisabled={selections.length === 0}
            onCancel={() => {
              setShowPanel(false);
              setSelections([]);
              setSearch("");
            }}
            onAdd={() => {
              setSelectedIds((current) =>
                [...new Set([...current, ...selections])].sort((left, right) => left - right),
              );
              setShowPanel(false);
              setSelections([]);
              setSearch("");
            }}
          >
            {visibleGroups.slice(0, maxVisibleOptions).map((group) => {
              const checked = selections.includes(group.id);
              return (
                <label key={group.id} className={adminAssociationOptionRowClass(checked)}>
                  <span className={adminAssociationOptionLabelClass}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelections((current) =>
                          current.includes(group.id)
                            ? current.filter((id) => id !== group.id)
                            : [...current, group.id],
                        )
                      }
                      className={adminAssociationCheckboxClass}
                    />
                    <span>{group.name}</span>
                  </span>
                  {group.description ? (
                    <span className="max-w-md truncate ui-caption text-slate-500 dark:text-slate-400">
                      {group.description}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </AdminAssociationPickerPanel>
        ) : undefined
      }
    />
  );
}
