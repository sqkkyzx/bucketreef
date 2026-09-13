import {
  messageUpload,
  messageUploadFiles,
  messageUploadFolder,
  messageColumns,
  messageResetColumns,
} from "../../uiMessages";
import { useI18n } from "../../i18n";
import type { RefObject } from "react";

import AnchoredPortalMenu from "../../components/ui/AnchoredPortalMenu";
import { cx, uiMenuClass } from "../../components/ui/styles";
import {
  contextMenuItemClasses,
  contextMenuItemDisabledClasses,
  contextMenuSeparatorClasses,
} from "./browserConstants";
import { FolderIcon, SlidersIcon, UploadIcon } from "./browserIcons";
import type {
  BrowserColumnId,
  ColumnDefinition,
} from "./browserObjectTableModel";

const menuClasses = cx(uiMenuClass, "overflow-hidden p-1.5");

type BrowserUploadQuickMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  canUploadFiles: boolean;
  canUploadFolder: boolean;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
};

export function BrowserUploadQuickMenu({
  open,
  anchorRef,
  menuRef,
  canUploadFiles,
  canUploadFolder,
  onUploadFiles,
  onUploadFolder,
}: BrowserUploadQuickMenuProps) {
  const { t } = useI18n();
  return (
    <AnchoredPortalMenu
      open={open}
      anchorRef={anchorRef}
      placement="bottom-end"
      offset={6}
      minWidth={224}
      className={`w-56 ${menuClasses}`}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={t(messageUpload)}
        className="max-h-[min(70vh,20rem)] overflow-y-auto"
      >
        <button
          type="button"
          role="menuitem"
          className={`${contextMenuItemClasses} ${!canUploadFiles ? contextMenuItemDisabledClasses : ""}`}
          onClick={onUploadFiles}
          disabled={!canUploadFiles}
        >
          <UploadIcon className="h-3.5 w-3.5" />
          {t(messageUploadFiles)}</button>
        <button
          type="button"
          role="menuitem"
          className={`${contextMenuItemClasses} ${!canUploadFolder ? contextMenuItemDisabledClasses : ""}`}
          onClick={onUploadFolder}
          disabled={!canUploadFolder}
        >
          <FolderIcon className="h-3.5 w-3.5" />
          {t(messageUploadFolder)}</button>
      </div>
    </AnchoredPortalMenu>
  );
}

type BrowserColumnsMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  columns: readonly Pick<ColumnDefinition, "id" | "label">[];
  visibleColumnIds: ReadonlySet<BrowserColumnId>;
  onToggleColumn: (columnId: BrowserColumnId) => void;
  onReset: () => void;
};

export function BrowserColumnsMenu({
  open,
  anchorRef,
  menuRef,
  columns,
  visibleColumnIds,
  onToggleColumn,
  onReset,
}: BrowserColumnsMenuProps) {
  const { t } = useI18n();
  return (
    <AnchoredPortalMenu
      open={open}
      anchorRef={anchorRef}
      placement="bottom-end"
      offset={6}
      minWidth={256}
      className={`w-72 ${menuClasses}`}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={t(messageColumns)}
        className="max-h-[min(70vh,24rem)] overflow-y-auto"
      >
        <div className="px-3 pb-2 pt-2">
          <p className="ui-caption font-semibold text-slate-700 dark:text-slate-100">
            {t({
              en: "Object columns",
              fr: "Colonnes des objets",
              de: "Objektspalten",
              zh: "对象列",
            })}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t({
              en: "Only base listing columns can be sorted.",
              fr: "Seules les colonnes de base peuvent être triées.",
              de: "Nur die Basisspalten der Liste können sortiert werden.",
              zh: "仅基础列表列支持排序。",
            })}</p>
        </div>
        <div className={contextMenuSeparatorClasses} />
        {columns.map((column) => {
          const checked = visibleColumnIds.has(column.id);
          return (
            <button
              key={column.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              className={contextMenuItemClasses}
              onClick={() => onToggleColumn(column.id)}
            >
              <span
                aria-hidden="true"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-bold"
              >
                {checked ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">{column.label}</span>
            </button>
          );
        })}
        <div className={contextMenuSeparatorClasses} />
        <button
          type="button"
          role="menuitem"
          className={contextMenuItemClasses}
          onClick={onReset}
        >
          <SlidersIcon className="h-3.5 w-3.5" />
          {t(messageResetColumns)}</button>
      </div>
    </AnchoredPortalMenu>
  );
}
