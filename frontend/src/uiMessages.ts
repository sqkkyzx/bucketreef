/* Copyright (c) 2026 Laurent Barbe. Licensed under the Apache License, Version 2.0. */
import type { I18nMessage } from "./i18n";

const message = (en: string, fr: string, de: string, zh: string): I18nMessage => ({ en, fr, de, zh });

export const messageUploadFiles = message("Upload files", "Téléverser des fichiers", "Dateien hochladen", "上传文件");
export const messageUploadFolder = message("Upload folder", "Téléverser un dossier", "Ordner hochladen", "上传文件夹");
export const messageNewFolder = message("New folder", "Nouveau dossier", "Neuer Ordner", "新建文件夹");
export const messageRefresh = message("Refresh", "Actualiser", "Aktualisieren", "刷新");
export const messageHideDeletedFiles = message("Hide deleted files", "Masquer les fichiers supprimés", "Gelöschte Dateien ausblenden", "隐藏已删除文件");
export const messageShowDeletedFiles = message("Show deleted files", "Afficher les fichiers supprimés", "Gelöschte Dateien anzeigen", "显示已删除文件");
export const messageRestoreDeletedFilesInThisFolder = message("Restore deleted files in this folder", "Restaurer les fichiers supprimés de ce dossier", "Gelöschte Dateien in diesem Ordner wiederherstellen", "恢复此文件夹中的已删除文件");
export const messageAdvanced = message("Advanced", "Avancé", "Erweitert", "高级");
export const messageComfortable = message("Comfortable", "Confortable", "Komfortabel", "舒适");
export const messageCompact = message("Compact", "Compact", "Kompakt", "紧凑");
export const messageColumns = message("Columns", "Colonnes", "Spalten", "列");
export const messageResetColumns = message("Reset columns", "Réinitialiser les colonnes", "Spalten zurücksetzen", "重置列");
export const messageCurrentPath = message("Current path", "Chemin actuel", "Aktueller Pfad", "当前路径");
export const messageClose = message("Close", "Fermer", "Schließen", "关闭");
export const messageParentFolder = message("Parent folder", "Dossier parent", "Übergeordneter Ordner", "上级文件夹");
export const messageSelectAll = message("Select all", "Tout sélectionner", "Alle auswählen", "全选");
export const messageName = message("Name", "Nom", "Name", "名称");
export const messageActions = message("Actions", "Actions", "Aktionen", "操作");
export const messageTags = message("Tags", "Étiquettes", "Tags", "标签");
export const messageExpires = message("Expires", "Expire", "Läuft ab", "过期时间");
