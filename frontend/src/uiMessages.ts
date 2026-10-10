/* Copyright (c) 2026 Laurent Barbe. Licensed under the Apache License, Version 2.0. */
import type { I18nMessage } from "./i18n";

const message = (en: string, zh: string): I18nMessage => ({ en, zh });

export const messageUploadFiles = message("Upload files", "上传文件");
export const messageUploadFolder = message("Upload folder", "上传文件夹");
export const messageNewFolder = message("New folder", "新建文件夹");
export const messageRefresh = message("Refresh", "刷新");
export const messageHideDeletedFiles = message("Hide deleted files", "隐藏已删除文件");
export const messageShowDeletedFiles = message("Show deleted files", "显示已删除文件");
export const messageRestoreDeletedFilesInThisFolder = message("Restore deleted files in this folder", "恢复此文件夹中的已删除文件");
export const messageAdvanced = message("Advanced", "高级");
export const messageComfortable = message("Comfortable", "舒适");
export const messageCompact = message("Compact", "紧凑");
export const messageColumns = message("Columns", "列");
export const messageResetColumns = message("Reset columns", "重置列");
export const messageCurrentPath = message("Current path", "当前路径");
export const messageClose = message("Close", "关闭");
export const messageParentFolder = message("Parent folder", "上级文件夹");
export const messageSelectAll = message("Select all", "全选");
export const messageName = message("Name", "名称");
export const messageActions = message("Actions", "操作");
export const messageTags = message("Tags", "标签");
export const messageExpires = message("Expires", "过期时间");
export const messageDownloadAsZip = message("Download as ZIP", "下载为 ZIP");
export const messageSelectCurrentFilesOrFoldersToArchive = message("Select current files or folders to archive.", "请选择要归档的当前文件或文件夹。");
