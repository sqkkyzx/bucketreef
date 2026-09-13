/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageUploadFiles,
  messageUploadFolder,
  messageNewFolder,
  messageRefresh,
  messageHideDeletedFiles,
  messageShowDeletedFiles,
  messageRestoreDeletedFilesInThisFolder,
  messageAdvanced,
} from "../../uiMessages";
import {
  browserDownloadFolder,
  browserDownload,
  browserVersions,
  browserRestoreToDate,
  browserOpen,
  browserCopyURL,
  browserCopy,
  browserCut,
  browserBulkAttributes,
  browserDelete,
} from "./browserMessages";
import { translate } from "../../i18n";
import type { UiLanguage } from "../../components/language";
import { getSelectionInfo } from "./browserUtils";
import type { BrowserItem, ClipboardState } from "./browserTypes";
import {
  OBJECT_PREVIEW_MAX_BYTES,
  objectPreviewKind,
} from "../shared/ObjectPreview";

export type BrowserActionId =
  | "uploadFiles"
  | "uploadFolder"
  | "newFolder"
  | "paste"
  | "versions"
  | "restoreToDate"
  | "cleanOldVersions"
  | "multipartUploads"
  | "configureBucket"
  | "copyPath"
  | "refresh"
  | "toggleShowFolders"
  | "toggleShowDeleted"
  | "details"
  | "properties"
  | "open"
  | "preview"
  | "download"
  | "createPublicLink"
  | "restore"
  | "copyUrl"
  | "copy"
  | "cut"
  | "bulkAttributes"
  | "advanced"
  | "delete";

export type BrowserActionSection = "layout" | "path" | "selection";
type BrowserActionScope = "path" | "item" | "selection";

export type BrowserActionState = {
  id: BrowserActionId;
  section: BrowserActionSection;
  label: string;
  visible: boolean;
  enabled: boolean;
  disabledReason?: string;
};

export type BrowserActionMap = Record<BrowserActionId, BrowserActionState>;
type BrowserActionHandler = () => void | Promise<void>;
type BrowserActionDispatcherResult =
  | { executed: true }
  | { executed: false; reason: string };
export type BrowserFunctionalProfile = "standard" | "advanced" | "portal";
export type BrowserDensity = "comfortable" | "compact";

export type BrowserCapabilityFacts = {
  canWriteObjects: boolean;
  canDeleteObjects: boolean;
  canRestoreObjects: boolean;
  canCreatePublicLinks: boolean;
};

export const FULL_BROWSER_CAPABILITY_FACTS: BrowserCapabilityFacts = {
  canWriteObjects: true,
  canDeleteObjects: true,
  canRestoreObjects: true,
  canCreatePublicLinks: false,
};

type BrowserItemPrimaryAction =
  | { kind: "open-folder" }
  | { kind: "open-file"; initialTab: "preview" | "properties" }
  | { kind: "open-versions" }
  | { kind: "none" };

type ResolveBrowserActionsInput = {
  locale?: UiLanguage;
  scope: BrowserActionScope;
  items?: BrowserItem[];
  bucketName: string;
  hasS3AccountContext: boolean;
  versioningEnabled: boolean;
  canPaste: boolean;
  clipboardMode?: ClipboardState["mode"] | null;
  copyUrlDisabled?: boolean;
  copyUrlDisabledReason?: string;
  publicLinkAvailable?: boolean;
  restoreAvailable?: boolean;
  detailsAvailable?: boolean;
  currentPath?: string;
  showFolderItems?: boolean;
  showDeletedObjects?: boolean;
  functionalProfile?: BrowserFunctionalProfile;
  capabilityFacts?: BrowserCapabilityFacts;
  previewAvailable?: boolean;
  operationPending?: boolean;
  refreshPending?: boolean;
  multipartUploadsAvailable?: boolean;
  bucketConfigurationAvailable?: boolean;
  bucketConfigurationReadOnly?: boolean;
};

export const CONTEXT_MENU_PATH_ACTION_IDS: BrowserActionId[] = [
  "details",
  "newFolder",
  "uploadFiles",
  "uploadFolder",
  "paste",
  "versions",
  "restoreToDate",
  "cleanOldVersions",
  "multipartUploads",
  "configureBucket",
  "copyPath",
];

export const CONTEXT_MENU_PATH_LAYOUT_ACTION_IDS: BrowserActionId[] = [
  "toggleShowFolders",
  "toggleShowDeleted",
];

export const CONTEXT_MENU_ITEM_ACTION_IDS: BrowserActionId[] = [
  "details",
  "preview",
  "versions",
  "properties",
  "open",
  "download",
  "createPublicLink",
  "restore",
  "copyUrl",
  "copy",
  "cut",
  "bulkAttributes",
  "restoreToDate",
  "delete",
];

export const CONTEXT_MENU_SELECTION_ACTION_IDS: BrowserActionId[] = [
  "download",
  "open",
  "copyUrl",
  "copy",
  "cut",
  "bulkAttributes",
  "restoreToDate",
  "advanced",
  "delete",
];

export const TOOLBAR_MORE_PATH_ACTION_IDS: BrowserActionId[] = [
  "details",
  "uploadFiles",
  "uploadFolder",
  "newFolder",
  "paste",
  "versions",
  "restoreToDate",
  "cleanOldVersions",
  "multipartUploads",
  "configureBucket",
  "copyPath",
];

export const TOOLBAR_MORE_SELECTION_FULL_ACTION_IDS: BrowserActionId[] = [
  "download",
  "open",
  "copyUrl",
  "copy",
  "cut",
  "bulkAttributes",
  "advanced",
  "restoreToDate",
  "delete",
];

export const TOOLBAR_MORE_SELECTION_OVERFLOW_ACTION_IDS: BrowserActionId[] = [
  "copyUrl",
  "cut",
  "bulkAttributes",
  "advanced",
  "restoreToDate",
];

const ALL_ACTION_IDS: BrowserActionId[] = [
  "uploadFiles",
  "uploadFolder",
  "newFolder",
  "paste",
  "versions",
  "restoreToDate",
  "cleanOldVersions",
  "multipartUploads",
  "configureBucket",
  "copyPath",
  "refresh",
  "toggleShowFolders",
  "toggleShowDeleted",
  "details",
  "properties",
  "open",
  "preview",
  "download",
  "createPublicLink",
  "restore",
  "copyUrl",
  "copy",
  "cut",
  "bulkAttributes",
  "advanced",
  "delete",
];

const defaultSectionByActionId: Record<BrowserActionId, BrowserActionSection> = {
  uploadFiles: "path",
  uploadFolder: "path",
  newFolder: "path",
  paste: "path",
  versions: "path",
  restoreToDate: "path",
  cleanOldVersions: "path",
  multipartUploads: "path",
  configureBucket: "path",
  copyPath: "path",
  refresh: "path",
  toggleShowFolders: "layout",
  toggleShowDeleted: "layout",
  details: "selection",
  properties: "selection",
  open: "selection",
  preview: "selection",
  download: "selection",
  createPublicLink: "selection",
  restore: "selection",
  copyUrl: "selection",
  copy: "selection",
  cut: "selection",
  bulkAttributes: "selection",
  advanced: "selection",
  delete: "selection",
};

const createHiddenState = (id: BrowserActionId): BrowserActionState => ({
  id,
  section: defaultSectionByActionId[id],
  label: "",
  visible: false,
  enabled: false,
});

export const getVisibleBrowserActions = (actions: BrowserActionMap, ids: readonly BrowserActionId[]) =>
  ids.map((id) => actions[id]).filter((action) => action.visible);

export function runBrowserAction(
  action: BrowserActionState,
  handlers: Partial<Record<BrowserActionId, BrowserActionHandler>>,
  locale: UiLanguage = "en",
): BrowserActionDispatcherResult {
  if (!action.visible) {
    return { executed: false, reason: translate({
      en: "This action is not available in the current Browser profile.",
      fr: "Cette action n’est pas disponible dans le profil actuel de l’explorateur.",
      de: "Diese Aktion ist im aktuellen Browserprofil nicht verfügbar.",
      zh: "当前浏览器配置不支持此操作。",
    }, locale) };
  }
  if (!action.enabled) {
    return {
      executed: false,
      reason: action.disabledReason ?? translate({
        en: "This action is temporarily unavailable.",
        fr: "Cette action est temporairement indisponible.",
        de: "Diese Aktion ist vorübergehend nicht verfügbar.",
        zh: "此操作暂时不可用。",
      }, locale),
    };
  }
  const handler = handlers[action.id];
  if (!handler) {
    return { executed: false, reason: translate({
      en: "This action is not supported from this surface.",
      fr: "Cette action n’est pas prise en charge depuis cette interface.",
      de: "Diese Aktion wird in dieser Oberfläche nicht unterstützt.",
      zh: "当前界面不支持此操作。",
    }, locale) };
  }
  void handler();
  return { executed: true };
}

const STANDARD_PATH_ACTION_IDS = new Set<BrowserActionId>([
  "uploadFiles",
  "uploadFolder",
  "newFolder",
  "paste",
  "copyPath",
  "toggleShowDeleted",
  "refresh",
]);

const STANDARD_SELECTION_ACTION_IDS = new Set<BrowserActionId>([
  "details",
  "properties",
  "open",
  "preview",
  "download",
  "copy",
  "cut",
  "delete",
]);

const PORTAL_PATH_ACTION_IDS = new Set<BrowserActionId>([
  "uploadFiles",
  "uploadFolder",
  "newFolder",
  "copyPath",
  "toggleShowDeleted",
  "restore",
  "refresh",
]);

const PORTAL_SELECTION_ACTION_IDS = new Set<BrowserActionId>([
  "details",
  "open",
  "preview",
  "download",
  "createPublicLink",
  "restore",
  "delete",
]);

const WRITE_ACTION_IDS = new Set<BrowserActionId>([
  "uploadFiles",
  "uploadFolder",
  "newFolder",
  "paste",
  "copy",
  "cut",
  "bulkAttributes",
]);

function applyBrowserFunctionalPolicy(
  actions: BrowserActionMap,
  profile: BrowserFunctionalProfile,
  capabilityFacts: BrowserCapabilityFacts,
  items: BrowserItem[] = [],
): BrowserActionMap {
  const canOpenSingleFolder = items.length === 1 && items[0]?.type === "folder";
  return Object.fromEntries(
    Object.entries(actions).map(([id, action]) => {
      const actionId = id as BrowserActionId;
      const profileAllows =
        profile === "advanced" ||
        (profile === "standard" &&
          (STANDARD_PATH_ACTION_IDS.has(actionId) ||
            STANDARD_SELECTION_ACTION_IDS.has(actionId))) ||
        (profile === "portal" &&
          (PORTAL_PATH_ACTION_IDS.has(actionId) ||
            PORTAL_SELECTION_ACTION_IDS.has(actionId) ||
            (actionId === "open" && canOpenSingleFolder)));
      const capabilityAllows =
        (!WRITE_ACTION_IDS.has(actionId) || capabilityFacts.canWriteObjects) &&
        (actionId !== "delete" || capabilityFacts.canDeleteObjects) &&
        ((actionId !== "restoreToDate" && actionId !== "restore") ||
          capabilityFacts.canRestoreObjects) &&
        (actionId !== "createPublicLink" || capabilityFacts.canCreatePublicLinks);
      const allowed = profileAllows && capabilityAllows;
      return [
        actionId,
        allowed ? action : { ...action, visible: false, enabled: false },
      ];
    }),
  ) as BrowserActionMap;
}

export const isBrowserItemPreviewAvailable = (item: BrowserItem): boolean =>
  item.type === "file" &&
  !item.isDeleted &&
  typeof item.sizeBytes === "number" &&
  item.sizeBytes >= 0 &&
  item.sizeBytes <= OBJECT_PREVIEW_MAX_BYTES &&
  objectPreviewKind(item.name) !== "generic";

export function resolveItemPrimaryAction(
  item: BrowserItem,
  options: { versioningEnabled: boolean },
): BrowserItemPrimaryAction {
  if (item.type === "folder") {
    return { kind: "open-folder" };
  }
  if (item.isDeleted) {
    return options.versioningEnabled ? { kind: "open-versions" } : { kind: "none" };
  }
  return {
    kind: "open-file",
    initialTab: "preview",
  };
}

export const resolveBrowserActions = ({
  locale = "en",
  scope,
  items = [],
  bucketName,
  hasS3AccountContext,
  versioningEnabled,
  canPaste,
  clipboardMode = null,
  copyUrlDisabled = false,
  copyUrlDisabledReason,
  publicLinkAvailable = false,
  restoreAvailable = false,
  detailsAvailable = false,
  currentPath = "",
  showFolderItems = true,
  showDeletedObjects = false,
  functionalProfile = "advanced",
  capabilityFacts = FULL_BROWSER_CAPABILITY_FACTS,
  previewAvailable = false,
  operationPending = false,
  refreshPending = false,
  multipartUploadsAvailable = false,
  bucketConfigurationAvailable = false,
  bucketConfigurationReadOnly = false,
}: ResolveBrowserActionsInput): BrowserActionMap => {
  const states = ALL_ACTION_IDS.reduce<BrowserActionMap>((acc, id) => {
    acc[id] = createHiddenState(id);
    return acc;
  }, {} as BrowserActionMap);
  const selectionInfo = getSelectionInfo(items);
  const hasBucket = Boolean(bucketName);
  const canUseContextActions = hasBucket && hasS3AccountContext;
  const isSingle = selectionInfo.isSingle;
  const primary = selectionInfo.primary;
  const isPrimaryFile = primary?.type === "file";
  const isPrimaryFolder = primary?.type === "folder";
  const isPrimaryDeleted = Boolean(primary?.isDeleted);
  const pasteLabel = clipboardMode === "move" ? translate({
    en: "Paste (Move)",
    fr: "Coller (déplacer)",
    de: "Einfügen (verschieben)",
    zh: "粘贴（移动）",
  }, locale) : translate({
    en: "Paste",
    fr: "Coller",
    de: "Einfügen",
    zh: "粘贴",
  }, locale);
  const downloadLabel =
    scope === "item"
      ? isPrimaryFolder
        ? translate(browserDownloadFolder, locale)
        : translate(browserDownload, locale)
      : selectionInfo.canDownloadFolder
        ? translate(browserDownloadFolder, locale)
        : translate(browserDownload, locale);

  const finalize = () => {
    const resolved = applyBrowserFunctionalPolicy(
      states,
      functionalProfile,
      capabilityFacts,
      items,
    );
    if (!operationPending) return resolved;
    return Object.fromEntries(
      Object.entries(resolved).map(([id, action]) => [
        id,
        action.visible && action.enabled
          ? {
              ...action,
              enabled: false,
              disabledReason: translate({
                en: "Wait for the current operation to finish.",
                fr: "Attendez la fin de l’opération en cours.",
                de: "Warten Sie, bis der aktuelle Vorgang abgeschlossen ist.",
                zh: "请等待当前操作完成。",
              }, locale),
            }
          : action,
      ]),
    ) as BrowserActionMap;
  };

  const setState = (id: BrowserActionId, next: Partial<BrowserActionState>) => {
    states[id] = { ...states[id], ...next };
  };

  if (scope === "path") {
    setState("details", {
      section: "path",
      label: translate({
        en: "Path details",
        fr: "Détails du chemin",
        de: "Pfaddetails",
        zh: "路径详情",
      }, locale),
      visible: functionalProfile === "advanced" && hasBucket,
      enabled: functionalProfile === "advanced" && canUseContextActions,
    });
    setState("uploadFiles", {
      label: translate(messageUploadFiles, locale),
      visible: true,
      enabled: canUseContextActions,
    });
    setState("uploadFolder", {
      label: translate(messageUploadFolder, locale),
      visible: true,
      enabled: canUseContextActions,
    });
    setState("newFolder", {
      label: translate(messageNewFolder, locale),
      visible: true,
      enabled: canUseContextActions,
    });
    setState("paste", {
      label: pasteLabel,
      visible: true,
      enabled: canPaste,
      disabledReason: canPaste
        ? undefined
        : translate({
          en: "Clipboard is empty or unavailable in this context.",
          fr: "Le presse-papiers est vide ou indisponible dans ce contexte.",
          de: "Die Zwischenablage ist leer oder in diesem Kontext nicht verfügbar.",
          zh: "剪贴板为空或在当前上下文中不可用。",
        }, locale),
    });
    setState("copyPath", {
      label: translate({
        en: "Copy path",
        fr: "Copier le chemin",
        de: "Pfad kopieren",
        zh: "复制路径",
      }, locale),
      visible: true,
      enabled: Boolean(currentPath),
    });
    setState("refresh", {
      label: translate(messageRefresh, locale),
      visible: true,
      enabled: canUseContextActions && !refreshPending,
      disabledReason: refreshPending
        ? translate({
          en: "Objects are already loading.",
          fr: "Le chargement des objets est déjà en cours.",
          de: "Objekte werden bereits geladen.",
          zh: "对象正在加载中。",
        }, locale)
        : undefined,
    });
    setState("multipartUploads", {
      label: translate({
        en: "Multipart uploads",
        fr: "Téléversements multiparties",
        de: "Mehrteilige Uploads",
        zh: "分段上传",
      }, locale),
      visible: multipartUploadsAvailable,
      enabled: multipartUploadsAvailable && canUseContextActions,
      disabledReason: canUseContextActions
        ? undefined
        : translate({
          en: "Select a bucket to inspect multipart uploads.",
          fr: "Sélectionnez un bucket pour consulter les téléversements multiparties.",
          de: "Wählen Sie einen Bucket, um mehrteilige Uploads anzuzeigen.",
          zh: "请选择存储桶以查看分段上传。",
        }, locale),
    });
    setState("configureBucket", {
      label: bucketConfigurationReadOnly ? translate({
        en: "Bucket details",
        fr: "Détails du bucket",
        de: "Bucket-Details",
        zh: "存储桶详情",
      }, locale) : translate({
        en: "Bucket settings",
        fr: "Paramètres du bucket",
        de: "Bucket-Einstellungen",
        zh: "存储桶设置",
      }, locale),
      visible: bucketConfigurationAvailable,
      enabled: bucketConfigurationAvailable && canUseContextActions,
      disabledReason: canUseContextActions
        ? undefined
        : translate({
          en: "Select a bucket to configure it.",
          fr: "Sélectionnez un bucket pour le configurer.",
          de: "Wählen Sie einen Bucket zur Konfiguration.",
          zh: "请选择要配置的存储桶。",
        }, locale),
    });
    setState("toggleShowFolders", {
      label: showFolderItems ? translate({
        en: "Hide folders",
        fr: "Masquer les dossiers",
        de: "Ordner ausblenden",
        zh: "隐藏文件夹",
      }, locale) : translate({
        en: "Show folders",
        fr: "Afficher les dossiers",
        de: "Ordner anzeigen",
        zh: "显示文件夹",
      }, locale),
      visible: true,
      enabled: true,
    });
    if (versioningEnabled) {
      setState("versions", {
        label: translate(browserVersions, locale),
        visible: true,
        enabled: canUseContextActions,
      });
      setState("restoreToDate", {
        label: translate(browserRestoreToDate, locale),
        visible: true,
        enabled: canUseContextActions,
      });
      setState("cleanOldVersions", {
        label: translate({
          en: "Clean old versions",
          fr: "Nettoyer les anciennes versions",
          de: "Alte Versionen bereinigen",
          zh: "清理旧版本",
        }, locale),
        visible: true,
        enabled: canUseContextActions,
      });
      setState("toggleShowDeleted", {
        label: showDeletedObjects
          ? translate(messageHideDeletedFiles, locale)
          : translate(messageShowDeletedFiles, locale),
        visible: true,
        enabled: true,
      });
      if (restoreAvailable && currentPath) {
        setState("restore", {
          label: translate(messageRestoreDeletedFilesInThisFolder, locale),
          visible: true,
          enabled: canUseContextActions,
        });
      }
    }
    return finalize();
  }

  if (scope === "item") {
    setState("details", {
      label: translate({
        en: "Details",
        fr: "Détails",
        de: "Details",
        zh: "详情",
      }, locale),
      visible:
        isSingle &&
        Boolean(primary) &&
        detailsAvailable,
      enabled:
        isSingle &&
        Boolean(primary) &&
        detailsAvailable,
    });
    if (isPrimaryFile && versioningEnabled) {
      setState("versions", {
        label: translate(browserVersions, locale),
        visible: true,
        enabled: canUseContextActions,
      });
    }
    if (isPrimaryFolder) {
      setState("open", {
        label: translate(browserOpen, locale),
        visible: true,
        enabled: hasBucket && selectionInfo.canOpen,
      });
    }
    if (isPrimaryFile) {
      setState("preview", {
        label: translate({
          en: "Preview",
          fr: "Aperçu",
          de: "Vorschau",
          zh: "预览",
        }, locale),
        visible: previewAvailable,
        enabled: canUseContextActions && !isPrimaryDeleted,
      });
      setState("properties", {
        label: translate({
          en: "Properties",
          fr: "Propriétés",
          de: "Eigenschaften",
          zh: "属性",
        }, locale),
        visible: true,
        enabled: canUseContextActions && (!isPrimaryDeleted || versioningEnabled),
      });
    }
    if (isSingle && Boolean(primary)) {
      setState("download", {
        label: downloadLabel,
        visible: true,
        enabled: canUseContextActions && !isPrimaryDeleted,
      });
    }
    if (isPrimaryFile && !isPrimaryDeleted) {
      if (publicLinkAvailable) {
        setState("createPublicLink", {
          label: translate({
            en: "Create public link",
            fr: "Créer un lien public",
            de: "Öffentlichen Link erstellen",
            zh: "创建公开链接",
          }, locale),
          visible: true,
          enabled: canUseContextActions,
        });
      }
      setState("copyUrl", {
        label: translate(browserCopyURL, locale),
        visible: true,
        enabled: canUseContextActions && !copyUrlDisabled,
        disabledReason: copyUrlDisabled ? copyUrlDisabledReason : undefined,
      });
    }
    if (isPrimaryFile && isPrimaryDeleted && versioningEnabled && restoreAvailable) {
      setState("restore", {
        label: translate({
          en: "Restore",
          fr: "Restaurer",
          de: "Wiederherstellen",
          zh: "恢复",
        }, locale),
        visible: true,
        enabled: canUseContextActions,
      });
    }
    if (selectionInfo.items.length > 0) {
      setState("copy", {
        label: translate(browserCopy, locale),
        visible: true,
        enabled: hasBucket && selectionInfo.canCopyItems,
      });
      setState("cut", {
        label: translate(browserCut, locale),
        visible: true,
        enabled: hasBucket && selectionInfo.canCutItems,
      });
      setState("bulkAttributes", {
        label: translate(browserBulkAttributes, locale),
        visible: true,
        enabled: canUseContextActions && selectionInfo.canBulkAttributes,
      });
      setState("delete", {
        label: translate(browserDelete, locale),
        visible: true,
        enabled: canUseContextActions && selectionInfo.canDelete,
      });
    }
    if (versioningEnabled) {
      setState("restoreToDate", {
        label: translate(browserRestoreToDate, locale),
        visible: true,
        enabled: canUseContextActions,
      });
    }
    return finalize();
  }

  if (selectionInfo.items.length > 0) {
    if (selectionInfo.canDownloadFolder || selectionInfo.canDownloadFiles) {
      setState("download", {
        label: downloadLabel,
        visible: true,
        enabled: canUseContextActions,
      });
    }
    if (isSingle && selectionInfo.primary) {
      setState("details", {
        label: translate({
          en: "Open full details",
          fr: "Ouvrir les détails complets",
          de: "Vollständige Details öffnen",
          zh: "打开完整详情",
        }, locale),
        visible: true,
        enabled: canUseContextActions,
      });
      setState("open", {
        label: translate(browserOpen, locale),
        visible: true,
        enabled:
          hasBucket &&
          canUseContextActions &&
          (!isPrimaryDeleted || versioningEnabled),
      });
    }
    if (selectionInfo.canCopyUrl && selectionInfo.primary) {
      setState("copyUrl", {
        label: translate(browserCopyURL, locale),
        visible: true,
        enabled: canUseContextActions && !copyUrlDisabled,
        disabledReason: copyUrlDisabled ? copyUrlDisabledReason : undefined,
      });
    }
    setState("copy", {
      label: translate(browserCopy, locale),
      visible: true,
      enabled: hasBucket && selectionInfo.canCopyItems,
    });
    setState("cut", {
      label: translate(browserCut, locale),
      visible: true,
      enabled: hasBucket && selectionInfo.canCutItems,
    });
    setState("bulkAttributes", {
      label: translate(browserBulkAttributes, locale),
      visible: true,
      enabled: canUseContextActions && selectionInfo.canBulkAttributes,
    });
    if (selectionInfo.canAdvanced) {
      setState("advanced", {
        label: translate(messageAdvanced, locale),
        visible: true,
        enabled: canUseContextActions,
      });
    }
    setState("delete", {
      label: translate(browserDelete, locale),
      visible: true,
      enabled: canUseContextActions && selectionInfo.canDelete,
    });
    if (versioningEnabled) {
      setState("restoreToDate", {
        label: translate(browserRestoreToDate, locale),
        visible: true,
        enabled: canUseContextActions,
      });
    }
  }
  return finalize();
};
