/* Copyright (c) 2026 Laurent Barbe. Licensed under the Apache License, Version 2.0. */
import { useCallback } from "react";
import type { I18nMessage } from "../../i18n";
import { useI18n } from "../../i18n";
const messages: Record<string, readonly [string, string, string]> = {
  "Search scope": [
    "Portée de recherche",
    "Suchbereich",
    "搜索范围"
  ],
  "Rename": [
    "Renommer",
    "Umbenennen",
    "重命名"
  ],
  "Parent folder": [
    "Dossier parent",
    "Übergeordneter Ordner",
    "上级文件夹"
  ],
  "Personal to your account, synchronized across browsers.": [
    "Personnels à votre compte et synchronisés entre navigateurs.",
    "Persönlich für Ihr Konto, browserübergreifend synchronisiert.",
    "仅属于您的账户，在不同浏览器间同步。"
  ],
  "Demo: saved locally for this identity.": [
    "Démo : enregistré localement pour cette identité.",
    "Demo: lokal für diese Identität gespeichert.",
    "演示：仅为当前身份保存在本地。"
  ],
  "Name": [
    "Nom",
    "Name",
    "名称"
  ],
  "Refresh": [
    "Actualiser",
    "Aktualisieren",
    "刷新"
  ],
  "Remove": [
    "Supprimer",
    "Entfernen",
    "移除"
  ],
  "No saved items in this workspace.": [
    "Aucun élément enregistré dans cet espace.",
    "Keine gespeicherten Einträge in diesem Arbeitsbereich.",
    "此工作区中没有已保存项。"
  ],
  "Select loaded items": [
    "Sélectionner les éléments chargés",
    "Geladene Einträge auswählen",
    "选择已加载项"
  ],
  "Synchronization requires a UI account. Temporary S3 sessions cannot save favorites to an account.": [
    "La synchronisation nécessite un compte UI. Les sessions S3 temporaires ne peuvent pas enregistrer de favoris dans un compte.",
    "Die Synchronisierung benötigt ein UI-Konto. Temporäre S3-Sitzungen können keine Favoriten im Konto speichern.",
    "同步需要 UI 账户。临时 S3 会话不能将收藏保存到账户。"
  ],
  "Favorites": [
    "Favoris",
    "Favoriten",
    "收藏"
  ],
  "Add to favorites": [
    "Ajouter aux favoris",
    "Zu Favoriten hinzufügen",
    "添加到收藏"
  ],
  "Remove from favorites": [
    "Retirer des favoris",
    "Aus Favoriten entfernen",
    "从收藏中移除"
  ],
  "Locations": [
    "Emplacements",
    "Orte",
    "位置"
  ],
  "Search favorites": [
    "Rechercher un favori",
    "Favoriten suchen",
    "搜索收藏"
  ],
  "Type": [
    "Type",
    "Typ",
    "类型"
  ],
  "Files": [
    "Fichiers",
    "Dateien",
    "文件"
  ],
  "Folders": [
    "Dossiers",
    "Ordner",
    "文件夹"
  ],
  "Storage class": [
    "Classe de stockage",
    "Speicherklasse",
    "存储类别"
  ],
  "Close": [
    "Fermer",
    "Schließen",
    "关闭"
  ],
  "Columns": [
    "Colonnes",
    "Spalten",
    "列"
  ],
  "Folders panel": [
    "Panneau des dossiers",
    "Ordnerbereich",
    "文件夹面板"
  ]
};
export function useBrowserText() {
  const { locale } = useI18n();
  return useCallback((message: string) => messages[message]?.[({ fr: 0, de: 1, zh: 2 } as Record<string, number>)[locale]] ?? message, [locale]);
}

const browserMessage = (en: string, fr: string, de: string, zh: string): I18nMessage => ({ en, fr, de, zh });

export const browserDownloadFolder = browserMessage("Download folder", "Télécharger le dossier", "Ordner herunterladen", "下载文件夹");
export const browserDownload = browserMessage("Download", "Télécharger", "Herunterladen", "下载");
export const browserVersions = browserMessage("Versions", "Versions", "Versionen", "版本");
export const browserRestoreToDate = browserMessage("Restore to date", "Restaurer à une date", "Bis zu einem Datum wiederherstellen", "恢复到指定日期");
export const browserOpen = browserMessage("Open", "Ouvrir", "Öffnen", "打开");
export const browserCopyURL = browserMessage("Copy URL", "Copier l’URL", "URL kopieren", "复制 URL");
export const browserCopy = browserMessage("Copy", "Copier", "Kopieren", "复制");
export const browserCut = browserMessage("Cut", "Couper", "Ausschneiden", "剪切");
export const browserBulkAttributes = browserMessage("Bulk attributes", "Attributs en masse", "Massenattribute", "批量属性");
export const browserDelete = browserMessage("Delete", "Supprimer", "Löschen", "删除");
export const browserActive = browserMessage("Active", "Actif", "Aktiv", "活动");
export const browserType = browserMessage("Type", "Type", "Typ", "类型");
export const browserStorageClass = browserMessage("Storage class", "Classe de stockage", "Speicherklasse", "存储类别");
export const browserName = browserMessage("Name", "Nom", "Name", "名称");
export const browserSearchOptions = browserMessage("Search options", "Options de recherche", "Suchoptionen", "搜索选项");
export const browserActions = browserMessage("Actions", "Actions", "Aktionen", "操作");
