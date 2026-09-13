import {
  messageCurrentPath,
  messageClose,
} from "../../uiMessages";
import {
  browserName,
  browserSearchOptions,
  browserType,
  browserStorageClass,
} from "./browserMessages";
import { useI18n } from "../../i18n";
import { ListActionButton } from "../../components/list/ListControls";
import type { RefObject } from "react";

import {
  toolbarCompactInputClasses,
  toolbarCompactSelectClasses,
} from "../../components/toolbarControlClasses";
import AnchoredPortalMenu from "../../components/ui/AnchoredPortalMenu";
import {
  cx,
  uiCheckboxClass,
  uiMenuClass,
  uiMutedTextClass,
} from "../../components/ui/styles";

import { ChevronDownIcon, SearchIcon, SlidersIcon } from "./browserIcons";

const searchInputClasses = cx(
  toolbarCompactInputClasses,
  "h-8 w-full py-1.5 text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500",
);
const selectClasses = cx(toolbarCompactSelectClasses, "h-9 w-full");
const optionCardClasses =
  "inline-flex items-center gap-2 rounded-md border border-[color:var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-1.5 ui-caption font-medium text-[var(--ui-text)] shadow-[var(--ui-shadow-soft)]";
const labelClasses = cx("ui-caption font-medium", uiMutedTextClass);
const menuClasses = cx(uiMenuClass, "overflow-hidden p-1.5");

type BrowserSearchScope = "prefix" | "bucket";
type BrowserObjectTypeFilter = "all" | "file" | "folder";

type BrowserObjectSearchHeaderProps = {
  rootRef: RefObject<HTMLDivElement>;
  optionsButtonRef: RefObject<HTMLButtonElement>;
  optionsMenuRef: RefObject<HTMLDivElement>;
  advancedOptionsEnabled: boolean;
  optionsOpen: boolean;
  filter: string;
  objectNounPlural: string;
  nameSortActive: boolean;
  sortDirection: "asc" | "desc";
  advancedOptionsActive: boolean;
  hasSearchQuery: boolean;
  searchScope: BrowserSearchScope;
  recursive: boolean;
  exactMatch: boolean;
  caseSensitive: boolean;
  typeFilter: BrowserObjectTypeFilter;
  storageFilter: string;
  storageClasses: readonly string[];
  canReset: boolean;
  onSortName: () => void;
  onFilterChange: (value: string) => void;
  onToggleOptions: () => void;
  onScopeChange: (scope: BrowserSearchScope) => void;
  onRecursiveChange: (enabled: boolean) => void;
  onExactMatchChange: (enabled: boolean) => void;
  onCaseSensitiveChange: (enabled: boolean) => void;
  onTypeFilterChange: (filter: BrowserObjectTypeFilter) => void;
  onStorageFilterChange: (filter: string) => void;
  onClear: () => void;
  onClose: () => void;
};

export default function BrowserObjectSearchHeader({
  rootRef,
  optionsButtonRef,
  optionsMenuRef,
  advancedOptionsEnabled,
  optionsOpen,
  filter,
  objectNounPlural,
  nameSortActive,
  sortDirection,
  advancedOptionsActive,
  hasSearchQuery,
  searchScope,
  recursive,
  exactMatch,
  caseSensitive,
  typeFilter,
  storageFilter,
  storageClasses,
  canReset,
  onSortName,
  onFilterChange,
  onToggleOptions,
  onScopeChange,
  onRecursiveChange,
  onExactMatchChange,
  onCaseSensitiveChange,
  onTypeFilterChange,
  onStorageFilterChange,
  onClear,
  onClose,
}: BrowserObjectSearchHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 items-center gap-2 pr-3">
      <button
        type="button"
        onClick={onSortName}
        className="group inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap text-left text-slate-500 transition hover:text-primary-700 dark:text-slate-400 dark:hover:text-primary-100"
      >
        <span>{t(browserName)}</span>
        <ChevronDownIcon
          className={`h-3 w-3 transition ${
            nameSortActive ? "opacity-100" : "opacity-30"
          } ${nameSortActive && sortDirection === "asc" ? "-rotate-180" : ""}`}
        />
      </button>
      <div
        ref={rootRef}
        className="relative w-48 min-w-0 flex-1 sm:w-56 md:w-64 normal-case"
      >
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIcon className="h-3 w-3" />
        </span>
        <input
          type="text"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={t({
            en: `Search ${objectNounPlural}`,
            fr: objectNounPlural === "files" ? "Rechercher des fichiers" : "Rechercher des objets",
            de: objectNounPlural === "files" ? "Dateien suchen" : "Objekte suchen",
            zh: objectNounPlural === "files" ? "搜索文件" : "搜索对象",
          })}
          aria-label={t({
            en: `Search ${objectNounPlural}`,
            fr: objectNounPlural === "files" ? "Rechercher des fichiers" : "Rechercher des objets",
            de: objectNounPlural === "files" ? "Dateien suchen" : "Objekte suchen",
            zh: objectNounPlural === "files" ? "搜索文件" : "搜索对象",
          })}
          className={`${searchInputClasses} ui-list-control-with-icon ${
            advancedOptionsEnabled ? "pr-9" : "pr-3"
          } normal-case`}
        />
        {advancedOptionsEnabled && (
          <button
            ref={optionsButtonRef}
            type="button"
            onClick={onToggleOptions}
            className={`absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
              advancedOptionsActive
                ? "text-primary-700 hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-500/20"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            }`}
            aria-haspopup="menu"
            aria-expanded={optionsOpen}
            aria-label={t(browserSearchOptions)}
            title={t(browserSearchOptions)}
          >
            <SlidersIcon className="h-3 w-3" />
          </button>
        )}
        <AnchoredPortalMenu
          open={advancedOptionsEnabled && optionsOpen}
          anchorRef={optionsButtonRef}
          placement="bottom-end"
          offset={8}
          minWidth={288}
          className={`w-72 ${menuClasses}`}
        >
          <div ref={optionsMenuRef} className="space-y-3">
            <label className="block space-y-1">
              <span className={labelClasses}>{t({
                en: "Scope",
                fr: "Portée",
                de: "Bereich",
                zh: "范围",
              })}</span>
              <select
                value={searchScope}
                onChange={(event) =>
                  onScopeChange(event.target.value as BrowserSearchScope)
                }
                className={selectClasses}
                aria-label={t({
                  en: "Search scope",
                  fr: "Portée de recherche",
                  de: "Suchbereich",
                  zh: "搜索范围",
                })}
                disabled={!hasSearchQuery}
              >
                <option value="prefix">{t(messageCurrentPath)}</option>
                <option value="bucket">{t({
                  en: "Whole bucket",
                  fr: "Tout le bucket",
                  de: "Gesamter Bucket",
                  zh: "整个存储桶",
                })}</option>
              </select>
            </label>
            <label className={optionCardClasses}>
              <input
                type="checkbox"
                checked={recursive}
                onChange={(event) => onRecursiveChange(event.target.checked)}
                disabled={!hasSearchQuery || searchScope === "bucket"}
                className={uiCheckboxClass}
                aria-label={t({
                  en: "Search recursively in subfolders",
                  fr: "Rechercher récursivement dans les sous-dossiers",
                  de: "Unterordner rekursiv durchsuchen",
                  zh: "递归搜索子文件夹",
                })}
              />
              <span>{t({
                en: "Recursive",
                fr: "Récursif",
                de: "Rekursiv",
                zh: "递归",
              })}</span>
            </label>
            <label className={optionCardClasses}>
              <input
                type="checkbox"
                checked={exactMatch}
                onChange={(event) => onExactMatchChange(event.target.checked)}
                disabled={!hasSearchQuery}
                className={uiCheckboxClass}
                aria-label={t({
                  en: "Use exact match",
                  fr: "Utiliser la correspondance exacte",
                  de: "Exakte Übereinstimmung verwenden",
                  zh: "使用精确匹配",
                })}
              />
              <span>{t({
                en: "Exact match",
                fr: "Correspondance exacte",
                de: "Exakte Übereinstimmung",
                zh: "精确匹配",
              })}</span>
            </label>
            <label className={optionCardClasses}>
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(event) => onCaseSensitiveChange(event.target.checked)}
                disabled={!hasSearchQuery}
                className={uiCheckboxClass}
                aria-label={t({
                  en: "Case-sensitive search",
                  fr: "Recherche sensible à la casse",
                  de: "Groß-/Kleinschreibung beachten",
                  zh: "区分大小写搜索",
                })}
              />
              <span>{t({
                en: "Case-sensitive",
                fr: "Sensible à la casse",
                de: "Groß-/Kleinschreibung beachten",
                zh: "区分大小写",
              })}</span>
            </label>
            <label className="block space-y-1">
              <span className={labelClasses}>{t(browserType)}</span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  onTypeFilterChange(
                    event.target.value as BrowserObjectTypeFilter,
                  )
                }
                className={selectClasses}
                aria-label={t({
                  en: "Object type filter",
                  fr: "Filtre du type d’objet",
                  de: "Objekttypfilter",
                  zh: "对象类型筛选",
                })}
              >
                <option value="all">{t({
                  en: "All",
                  fr: "Tous",
                  de: "Alle",
                  zh: "全部",
                })}</option>
                <option value="file">{t({
                  en: "Files",
                  fr: "Fichiers",
                  de: "Dateien",
                  zh: "文件",
                })}</option>
                <option value="folder">{t({
                  en: "Folders",
                  fr: "Dossiers",
                  de: "Ordner",
                  zh: "文件夹",
                })}</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelClasses}>{t(browserStorageClass)}</span>
              <select
                value={storageFilter}
                onChange={(event) =>
                  onStorageFilterChange(event.target.value)
                }
                className={selectClasses}
                aria-label={t({
                  en: "Storage class filter",
                  fr: "Filtre de classe de stockage",
                  de: "Speicherklassenfilter",
                  zh: "存储类别筛选",
                })}
              >
                <option value="all">{t({
                  en: "All classes",
                  fr: "Toutes les classes",
                  de: "Alle Klassen",
                  zh: "全部类别",
                })}</option>
                {storageClasses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <ListActionButton
                type="button"
                onClick={onClear}
                disabled={!canReset}
              >
                {t({
                  en: "Clear",
                  fr: "Effacer",
                  de: "Leeren",
                  zh: "清除",
                })}</ListActionButton>
              <ListActionButton
                type="button"
                onClick={onClose}

              >
                {t(messageClose)}</ListActionButton>
            </div>
          </div>
        </AnchoredPortalMenu>
      </div>
    </div>
  );
}
