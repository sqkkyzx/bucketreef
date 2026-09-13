/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageHideDeletedFiles,
  messageShowDeletedFiles,
  messageRestoreDeletedFilesInThisFolder,
  messageUpload,
  messageNewFolder,
  messageRefresh,
  messageMore,
  messageOpen,
  messageCopy,
  messageDownload,
  messageDelete,
  messageSelection,
  messageCurrentPath,
  messageComfortable,
  messageCompact,
  messageStatus,
  messageOperationsOverview,
  messageColumns,
} from "../../uiMessages";
import { useI18n } from "../../i18n";
import { ListActionButton, ListBadge } from "../../components/list/ListControls";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type RefObject,
} from "react";

import AnchoredPortalMenu from "../../components/ui/AnchoredPortalMenu";

import { useDismissibleLayer } from "../../components/ui/useDismissibleLayer";
import { cx, uiMenuClass } from "../../components/ui/styles";
import { BrowserToolbarActionMenuItem } from "./BrowserActionPresentation";
import BrowserBucketSelector from "./BrowserBucketSelector";
import BrowserPathNavigator from "./BrowserPathNavigator";
import {
  BrowserColumnsMenu,
  BrowserUploadQuickMenu,
} from "./BrowserToolbarMenus";
import BrowserToolbarToggleMenuItem from "./BrowserToolbarToggleMenuItem";
import type { BrowserActionId, BrowserActionState } from "./browserActions";
import { contextMenuItemClasses, contextMenuItemDisabledClasses, contextMenuSeparatorClasses } from "./browserConstants";
import {
  ChevronDownIcon,
  CompactIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  FolderPlusIcon,
  HistoryIcon,
  ListIcon,
  MoreIcon,
  OpenIcon,
  RefreshIcon,
  SettingsIcon,
  SlidersIcon,
  TrashIcon,
  UploadIcon,
} from "./browserIcons";
import type { BrowserTransferAccessBadge } from "./browserTransferPresentation";

const toolbarControlsGroupClasses = "flex shrink-0 items-center gap-1.5";
const floatingMenuClasses = cx(uiMenuClass, "overflow-hidden p-1.5");
const overflowStatusRowClasses =
  "flex items-start gap-3 px-1 py-1 ui-caption text-slate-600 dark:text-slate-300";
const overflowSectionTitleClasses =
  "px-1 py-1 ui-caption font-semibold text-slate-500 dark:text-slate-400";
const directToolbarPathActionIds = new Set<BrowserActionId>([
  "uploadFiles",
  "uploadFolder",
  "newFolder",
]);
const currentPathMenuActionIds = new Set<BrowserActionId>([
  "details",
  "paste",
  "copyPath",
]);

type ToolbarToggle = {
  checked: boolean;
  onToggle: () => void;
};

type ToolbarColumns = Pick<
  ComponentProps<typeof BrowserColumnsMenu>,
  "columns" | "visibleColumnIds" | "onToggleColumn" | "onReset"
> & {
  summary: string;
};

type BrowserToolbarProps = {
  compactMode: boolean;
  bucketSelector: ComponentProps<typeof BrowserBucketSelector>;
  pathNavigator: ComponentProps<typeof BrowserPathNavigator>;
  deletedObjects: {
    showToggle: boolean;
    showDeleted: boolean;
    showRestore: boolean;
    restoreEnabled: boolean;
  };
  contextActions: {
    visible: boolean;
    canUploadFiles: boolean;
    canUploadFolder: boolean;
    canCreateFolder: boolean;
    canRefresh: boolean;
  };
  selectionActions: {
    visible: boolean;
    mobileViewport: boolean;
    summary: string;
    canOpen: boolean;
    canCopy: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  menuResetKey: string;
  moreMenu: {
    view?: {
      compactMode: boolean;
      onSetCompactMode: (compact: boolean) => void;
    };
    status: {
      visible: boolean;
      accessBadge: BrowserTransferAccessBadge | null;
      operationsCount?: number;
      onOpenOperations: () => void;
    };
    layout: {
      folders?: ToolbarToggle;
    };
    columns?: ToolbarColumns;
    pathActions: BrowserActionState[];
    selectionActions: BrowserActionState[];
    selectionOverflow: boolean;
    sse?: {
      enabled: boolean;
      active: boolean;
      onOpen: () => void;
    };
  };
  fileInputRef: RefObject<HTMLInputElement>;
  folderInputRef: RefObject<HTMLInputElement>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFolderInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunPathAction: (actionId: BrowserActionId) => void;
  onRunSelectionAction: (actionId: BrowserActionId) => void;
};

export default function BrowserToolbar({
  compactMode,
  bucketSelector,
  pathNavigator,
  deletedObjects,
  contextActions,
  selectionActions,
  menuResetKey,
  moreMenu,
  fileInputRef,
  folderInputRef,
  onFileInputChange,
  onFolderInputChange,
  onRunPathAction,
  onRunSelectionAction,
}: BrowserToolbarProps) {
  const { t } = useI18n();
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const columnsButtonRef = useRef<HTMLButtonElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const toolbarShellClasses = compactMode
    ? "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
    : "flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between";
  const toolbarActionsClasses = compactMode
    ? "flex shrink-0 flex-wrap items-center justify-end gap-2"
    : "flex w-full flex-wrap items-center justify-end gap-2 2xl:w-auto";
  const selectionActionsClasses = compactMode
    ? "hidden shrink-0 items-center gap-1.5 md:flex"
    : "hidden w-full shrink-0 flex-wrap items-center justify-end gap-2 md:flex 2xl:w-auto";

  const hasViewSection = Boolean(moreMenu.view);
  const hasStatusSection = moreMenu.status.visible;
  const hasLayoutSection = Boolean(moreMenu.layout.folders);
  const hasColumnsSection = Boolean(moreMenu.columns);
  const menuPathActions = moreMenu.pathActions.filter(
    (action) => !directToolbarPathActionIds.has(action.id),
  );
  const currentPathMenuActions = menuPathActions.filter((action) =>
    currentPathMenuActionIds.has(action.id),
  );
  const technicalPathMenuActions = menuPathActions.filter(
    (action) => !currentPathMenuActionIds.has(action.id),
  );
  const hasCurrentPathActions = currentPathMenuActions.length > 0;
  const hasTechnicalPathActions = technicalPathMenuActions.length > 0;
  const hasPathActions = hasCurrentPathActions || hasTechnicalPathActions;
  const hasSelectionActions = moreMenu.selectionActions.length > 0;
  const sse = moreMenu.sse;
  const hasSecondaryActionsSection =
    hasPathActions || hasSelectionActions || Boolean(sse);
  const hasPrioritizedSelectionActions =
    moreMenu.selectionOverflow && hasSelectionActions;
  const hasTrailingActionsSection =
    (hasSelectionActions && !hasPrioritizedSelectionActions) || Boolean(sse);
  const hasMoreMenu =
    hasViewSection ||
    hasStatusSection ||
    hasLayoutSection ||
    hasColumnsSection ||
    hasSecondaryActionsSection;
  const closeMoreMenu = () => {
    setColumnsMenuOpen(false);
    setMoreMenuOpen(false);
  };
  const runMoreAction = (action: () => void) => {
    closeMoreMenu();
    action();
  };
  const toggleMoreMenu = () => {
    setUploadMenuOpen(false);
    setColumnsMenuOpen(false);
    setMoreMenuOpen((current) => !current);
  };
  const toggleUploadMenu = () => {
    closeMoreMenu();
    setUploadMenuOpen((current) => !current);
  };
  const runUploadAction = (actionId: "uploadFiles" | "uploadFolder") => {
    setUploadMenuOpen(false);
    onRunPathAction(actionId);
  };

  useDismissibleLayer({
    open: moreMenuOpen,
    insideRefs: [
      moreButtonRef,
      moreMenuRef,
      columnsButtonRef,
      columnsMenuRef,
    ],
    onDismiss: closeMoreMenu,
  });

  useDismissibleLayer({
    open: uploadMenuOpen,
    insideRefs: [uploadButtonRef, uploadMenuRef],
    onDismiss: () => setUploadMenuOpen(false),
  });

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [menuResetKey]);

  useEffect(() => {
    if (!hasMoreMenu && moreMenuOpen) {
      setMoreMenuOpen(false);
    }
  }, [hasMoreMenu, moreMenuOpen]);

  useEffect(() => {
    if (!moreMenuOpen && columnsMenuOpen) {
      setColumnsMenuOpen(false);
    }
  }, [columnsMenuOpen, moreMenuOpen]);

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="toolbar"
        aria-label={t({
          en: "Browser context bar",
          fr: "Barre de contexte de l’explorateur",
          de: "Kontextleiste des Browsers",
          zh: "对象浏览器上下文栏",
        })}
        data-density={compactMode ? "compact" : "comfortable"}
        className={toolbarShellClasses}
      >
        <div className="flex min-w-0 w-full flex-1 flex-col gap-2 md:flex-row md:items-stretch lg:items-center">
          <BrowserBucketSelector {...bucketSelector} />
          <BrowserPathNavigator {...pathNavigator} />
        </div>
        <div className={toolbarActionsClasses}>
          {deletedObjects.showToggle && (
            <ListActionButton iconOnly={compactMode} variant="secondary"
              type="button"

              aria-pressed={deletedObjects.showDeleted}
              aria-label={
                deletedObjects.showDeleted
                  ? t(messageHideDeletedFiles)
                  : t(messageShowDeletedFiles)
              }
              onClick={() => onRunPathAction("toggleShowDeleted")}
              title={
                deletedObjects.showDeleted
                  ? t(messageHideDeletedFiles)
                  : t(messageShowDeletedFiles)
              }
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {!compactMode && (
                <span>
                  {deletedObjects.showDeleted
                    ? t(messageHideDeletedFiles)
                    : t(messageShowDeletedFiles)}
                </span>
              )}
            </ListActionButton>
          )}
          {deletedObjects.showRestore && (
            <ListActionButton iconOnly={compactMode} variant="secondary"
              type="button"

              aria-label={t(messageRestoreDeletedFilesInThisFolder)}
              title={t(messageRestoreDeletedFilesInThisFolder)}
              onClick={() => onRunPathAction("restore")}
              disabled={!deletedObjects.restoreEnabled}
            >
              <HistoryIcon className="h-3.5 w-3.5" />
              {!compactMode && <span>{t(messageRestoreDeletedFilesInThisFolder)}</span>}
            </ListActionButton>
          )}
          {contextActions.visible && (
            <div className={compactMode ? toolbarControlsGroupClasses : "flex shrink-0 flex-wrap items-center gap-2"}>
              <ListActionButton iconOnly={compactMode} variant="primary"
                ref={uploadButtonRef}
                type="button"
                onClick={toggleUploadMenu}
                disabled={
                  !contextActions.canUploadFiles &&
                  !contextActions.canUploadFolder
                }
                aria-haspopup={
                  contextActions.canUploadFiles || contextActions.canUploadFolder
                    ? "menu"
                    : undefined
                }
                aria-expanded={
                  contextActions.canUploadFiles || contextActions.canUploadFolder
                    ? uploadMenuOpen
                    : undefined
                }
                aria-label={t(messageUpload)}
                title={t(messageUpload)}
              >
                <UploadIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageUpload)}</span>}
              </ListActionButton>
              <BrowserUploadQuickMenu
                open={uploadMenuOpen}
                anchorRef={uploadButtonRef}
                menuRef={uploadMenuRef}
                canUploadFiles={contextActions.canUploadFiles}
                canUploadFolder={contextActions.canUploadFolder}
                onUploadFiles={() => runUploadAction("uploadFiles")}
                onUploadFolder={() => runUploadAction("uploadFolder")}
              />
              <ListActionButton iconOnly={compactMode} variant="secondary"
                type="button"
                onClick={() => onRunPathAction("newFolder")}
                disabled={!contextActions.canCreateFolder}
                aria-label={t(messageNewFolder)}
                title={t(messageNewFolder)}
              >
                <FolderPlusIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageNewFolder)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="secondary"
                type="button"
                onClick={() => onRunPathAction("refresh")}
                disabled={!contextActions.canRefresh}
                aria-label={t(messageRefresh)}
                title={t(messageRefresh)}
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageRefresh)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="secondary"
                ref={moreButtonRef}
                type="button"
                onClick={toggleMoreMenu}
                disabled={!hasMoreMenu}
                aria-haspopup={hasMoreMenu ? "menu" : undefined}
                aria-expanded={hasMoreMenu ? moreMenuOpen : undefined}
                aria-label={t(messageMore)}
                title={t(messageMore)}
              >
                <MoreIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageMore)}</span>}
              </ListActionButton>
            </div>
          )}
          {selectionActions.visible && !selectionActions.mobileViewport && (
            <div className={selectionActionsClasses}>
              <p
                role="status"
                aria-live="polite"
                className="max-w-48 truncate rounded-md border border-[color:var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1.5 ui-caption font-semibold text-primary-700 dark:text-primary-100"
              >
                {selectionActions.summary}
              </p>
              <ListActionButton iconOnly={compactMode} variant="secondary"
                type="button"
                onClick={() => onRunSelectionAction("open")}
                disabled={!selectionActions.canOpen}
                aria-label={t(messageOpen)}
                title={t(messageOpen)}
              >
                <OpenIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageOpen)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="secondary"
                type="button"
                onClick={() => onRunSelectionAction("copy")}
                disabled={!selectionActions.canCopy}
                aria-label={t(messageCopy)}
                title={t(messageCopy)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageCopy)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="primary"
                type="button"
                onClick={() => onRunSelectionAction("download")}
                disabled={!selectionActions.canDownload}
                aria-label={t(messageDownload)}
                title={t(messageDownload)}
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageDownload)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="danger"
                type="button"
                onClick={() => onRunSelectionAction("delete")}
                disabled={!selectionActions.canDelete}
                aria-label={t(messageDelete)}
                title={t(messageDelete)}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageDelete)}</span>}
              </ListActionButton>
              <ListActionButton iconOnly={compactMode} variant="secondary"
                ref={moreButtonRef}
                type="button"
                onClick={toggleMoreMenu}
                disabled={!hasMoreMenu}
                aria-haspopup={hasMoreMenu ? "menu" : undefined}
                aria-expanded={hasMoreMenu ? moreMenuOpen : undefined}
                aria-label={t(messageMore)}
                title={t(messageMore)}
              >
                <MoreIcon className="h-3.5 w-3.5" />
                {!compactMode && <span>{t(messageMore)}</span>}
              </ListActionButton>
            </div>
          )}
        </div>
      </div>

      {hasMoreMenu && (
        <AnchoredPortalMenu
          open={moreMenuOpen}
          anchorRef={moreButtonRef}
          placement="bottom-end"
          offset={6}
          minWidth={288}
          className={`w-80 ${floatingMenuClasses}`}
        >
          <div
            ref={moreMenuRef}
            role="menu"
            aria-label={t(messageMore)}
            className="max-h-[min(76vh,36rem)] overflow-y-auto"
          >
            {hasPrioritizedSelectionActions && (
              <>
                <p className={overflowSectionTitleClasses}>{t(messageSelection)}</p>
                {moreMenu.selectionActions.map((action) => (
                  <BrowserToolbarActionMenuItem
                    key={action.id}
                    action={action}
                    onSelect={() =>
                      runMoreAction(() => onRunSelectionAction(action.id))
                    }
                  />
                ))}
              </>
            )}

            {hasCurrentPathActions && !hasPrioritizedSelectionActions && (
              <>
                <p className={overflowSectionTitleClasses}>{t(messageCurrentPath)}</p>
                {currentPathMenuActions.map((action) => (
                  <BrowserToolbarActionMenuItem
                    key={action.id}
                    action={action}
                    onSelect={() =>
                      runMoreAction(() => onRunPathAction(action.id))
                    }
                  />
                ))}
              </>
            )}

            {hasTechnicalPathActions && !hasPrioritizedSelectionActions && (
              <>
                {hasCurrentPathActions && (
                  <div className={contextMenuSeparatorClasses} />
                )}
                <p className={overflowSectionTitleClasses}>{t({
                  en: "Technical tools",
                  fr: "Outils techniques",
                  de: "Technische Werkzeuge",
                  zh: "技术工具",
                })}</p>
                {technicalPathMenuActions.map((action) => (
                  <BrowserToolbarActionMenuItem
                    key={action.id}
                    action={action}
                    onSelect={() =>
                      runMoreAction(() => onRunPathAction(action.id))
                    }
                  />
                ))}
              </>
            )}

            {!hasPrioritizedSelectionActions &&
              hasPathActions &&
              (hasViewSection ||
                hasStatusSection ||
                hasLayoutSection ||
                hasColumnsSection ||
                hasTrailingActionsSection) && (
                <div className={contextMenuSeparatorClasses} />
              )}

            {!hasPrioritizedSelectionActions && moreMenu.view && (
              <>
                <p className={overflowSectionTitleClasses}>{t({
                  en: "Browser view",
                  fr: "Vue de l’explorateur",
                  de: "Browseransicht",
                  zh: "浏览器视图",
                })}</p>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!moreMenu.view.compactMode}
                  className={contextMenuItemClasses}
                  onClick={() =>
                    runMoreAction(() =>
                      moreMenu.view?.onSetCompactMode(false),
                    )
                  }
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  {t(messageComfortable)}{!moreMenu.view.compactMode && (
                    <span
                      aria-hidden="true"
                      className="ml-auto text-primary-600 dark:text-primary-300"
                    >
                      ✓
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={moreMenu.view.compactMode}
                  className={contextMenuItemClasses}
                  onClick={() =>
                    runMoreAction(() =>
                      moreMenu.view?.onSetCompactMode(true),
                    )
                  }
                >
                  <CompactIcon className="h-3.5 w-3.5" />
                  {t(messageCompact)}{moreMenu.view.compactMode && (
                    <span
                      aria-hidden="true"
                      className="ml-auto text-primary-600 dark:text-primary-300"
                    >
                      ✓
                    </span>
                  )}
                </button>
              </>
            )}

            {!hasPrioritizedSelectionActions && hasStatusSection && (
              <>
                {hasViewSection && (
                  <div className={contextMenuSeparatorClasses} />
                )}
                <p className={overflowSectionTitleClasses}>{t(messageStatus)}</p>
                {moreMenu.status.accessBadge && (
                  <div
                    className={overflowStatusRowClasses}
                    title={moreMenu.status.accessBadge.title}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full border ${moreMenu.status.accessBadge.indicatorClassName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-700 dark:text-slate-100">
                          {t({ en: "Transfers", fr: "Transferts", de: "Übertragungen", zh: "传输" })}
                        </p>
                        <ListBadge
                          tone={moreMenu.status.accessBadge.tone}
                          className="shrink-0 whitespace-nowrap"
                          title={moreMenu.status.accessBadge.title}
                        >
                          {moreMenu.status.accessBadge.label}
                        </ListBadge>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        {moreMenu.status.accessBadge.title}
                      </p>
                    </div>
                  </div>
                )}
                {moreMenu.status.operationsCount !== undefined && (
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={t(messageOperationsOverview)}
                    className={contextMenuItemClasses}
                    onClick={() =>
                      runMoreAction(moreMenu.status.onOpenOperations)
                    }
                  >
                    <ListIcon className="h-3.5 w-3.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{t(messageOperationsOverview)}</span>
                      <span
                        aria-hidden="true"
                        className="block text-[11px] font-medium leading-tight text-slate-400 dark:text-slate-500"
                      >
                        {t({ en: moreMenu.status.operationsCount === 1 ? "1 operation" : `${moreMenu.status.operationsCount} operations`, fr: `${moreMenu.status.operationsCount} opération${moreMenu.status.operationsCount === 1 ? "" : "s"}`, de: `${moreMenu.status.operationsCount} Vorg${moreMenu.status.operationsCount === 1 ? "ang" : "änge"}`, zh: `${moreMenu.status.operationsCount} 项操作` })}
                      </span>
                    </span>
                  </button>
                )}
              </>
            )}

            {!hasPrioritizedSelectionActions && hasLayoutSection && (
              <>
                {(hasViewSection || hasStatusSection) && (
                  <div className={contextMenuSeparatorClasses} />
                )}
                <p className={overflowSectionTitleClasses}>{t({
                  en: "Panels",
                  fr: "Panneaux",
                  de: "Bereiche",
                  zh: "面板",
                })}</p>
                {moreMenu.layout.folders && (
                  <BrowserToolbarToggleMenuItem
                    label={t({
                      en: "Folders panel",
                      fr: "Panneau des dossiers",
                      de: "Ordnerbereich",
                      zh: "文件夹面板",
                    })}
                    icon={<FolderIcon className="h-3.5 w-3.5" />}
                    {...moreMenu.layout.folders}
                  />
                )}
              </>
            )}

            {!hasPrioritizedSelectionActions && moreMenu.columns && (
              <>
                {(hasViewSection || hasStatusSection || hasLayoutSection) && (
                  <div className={contextMenuSeparatorClasses} />
                )}
                <p className={overflowSectionTitleClasses}>{t(messageColumns)}</p>
                <button
                  ref={columnsButtonRef}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={columnsMenuOpen}
                  className={contextMenuItemClasses}
                  onClick={() => setColumnsMenuOpen((current) => !current)}
                >
                  <SlidersIcon className="h-3.5 w-3.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{t(messageColumns)}</span>
                    <span className="block text-[11px] font-medium leading-tight text-slate-400 dark:text-slate-500">
                      {moreMenu.columns.summary}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 shrink-0 transition ${
                      columnsMenuOpen ? "" : "-rotate-90"
                    }`}
                  />
                </button>
                <BrowserColumnsMenu
                  open={columnsMenuOpen}
                  anchorRef={columnsButtonRef}
                  menuRef={columnsMenuRef}
                  columns={moreMenu.columns.columns}
                  visibleColumnIds={moreMenu.columns.visibleColumnIds}
                  onToggleColumn={moreMenu.columns.onToggleColumn}
                  onReset={moreMenu.columns.onReset}
                />
              </>
            )}

            {!hasPrioritizedSelectionActions && hasTrailingActionsSection && (
              <>
                {(hasStatusSection ||
                  hasViewSection ||
                  hasLayoutSection ||
                  hasColumnsSection) && (
                  <div className={contextMenuSeparatorClasses} />
                )}
                {hasSelectionActions && !hasPrioritizedSelectionActions && (
                  <>
                    <p className={overflowSectionTitleClasses}>{t(messageSelection)}</p>
                    {moreMenu.selectionActions.map((action) => (
                      <BrowserToolbarActionMenuItem
                        key={action.id}
                        action={action}
                        onSelect={() =>
                          runMoreAction(() => onRunSelectionAction(action.id))
                        }
                      />
                    ))}
                  </>
                )}
                {sse && (
                  <>
                    {hasSelectionActions && !hasPrioritizedSelectionActions && (
                      <div className={contextMenuSeparatorClasses} />
                    )}
                    <p className={overflowSectionTitleClasses}>{t({
                      en: "Security",
                      fr: "Sécurité",
                      de: "Sicherheit",
                      zh: "安全",
                    })}</p>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${contextMenuItemClasses} ${
                        !sse.enabled
                          ? contextMenuItemDisabledClasses
                          : ""
                      }`}
                      onClick={() => runMoreAction(sse.onOpen)}
                      disabled={!sse.enabled}
                      title={
                        sse.active
                          ? t({
                            en: "SSE-C enabled for this bucket.",
                            fr: "SSE-C est activé pour ce bucket.",
                            de: "SSE-C ist für diesen Bucket aktiviert.",
                            zh: "此存储桶已启用 SSE-C。",
                          })
                          : t({
                            en: "Configure SSE-C key for this bucket.",
                            fr: "Configurer la clé SSE-C de ce bucket.",
                            de: "SSE-C-Schlüssel für diesen Bucket konfigurieren.",
                            zh: "配置此存储桶的 SSE-C 密钥。",
                          })
                      }
                    >
                      <SettingsIcon className="h-3.5 w-3.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block">SSE-C</span>
                        <span className="block text-[11px] font-medium leading-tight text-slate-400 dark:text-slate-500">
                          {sse.active
                            ? t({
                              en: "Enabled for this bucket",
                              fr: "Activé pour ce bucket",
                              de: "Für diesen Bucket aktiviert",
                              zh: "已为此存储桶启用",
                            })
                            : t({
                              en: "Configure customer key",
                              fr: "Configurer la clé client",
                              de: "Kundenschlüssel konfigurieren",
                              zh: "配置客户提供的密钥",
                            })}
                        </span>
                      </span>
                      <span
                        className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          sse.active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {sse.active ? t({
                          en: "On",
                          fr: "Activé",
                          de: "Ein",
                          zh: "开",
                        }) : t({
                          en: "Off",
                          fr: "Désactivé",
                          de: "Aus",
                          zh: "关",
                        })}
                      </span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </AnchoredPortalMenu>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFolderInputChange}
      />
    </div>
  );
}
