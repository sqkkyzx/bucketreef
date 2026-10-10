import { useI18n, type I18nMessage } from "../../i18n";
import type { PointerEventHandler, ReactNode } from "react";

import { ChevronDownIcon } from "./browserIcons";
import {
  COLUMN_RESIZER_HITBOX_WIDTH_PX,
  createLazyColumnCacheEntry,
  type BrowserColumnId,
  type BrowserSortKey,
  type ColumnDefinition,
  type LazyColumnCacheEntry,
  type LazyFieldStatus,
} from "./browserObjectTableModel";
import type { BrowserItem } from "./browserTypes";
import { formatDateTime } from "./browserUtils";

type BrowserTranslate = (message: I18nMessage) => string;

function renderLazyCellValue(
  status: LazyFieldStatus,
  value: string | number | null,
  t: BrowserTranslate,
): ReactNode {
  if (status === "idle") {
    return "—";
  }
  if (status === "error") {
    return t({ en: "Unavailable", zh: "不可用" });
  }
  if (status === "ready") {
    if (typeof value === "number") {
      return value.toLocaleString();
    }
    return value || "—";
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300 dark:bg-slate-600" />
      {t({ en: "Loading...", zh: "正在加载…" })}
    </span>
  );
}

function formatExpiresCellValue(value: string | null): string | null {
  return value ? formatDateTime(value) : null;
}

function formatRestoreStatusCellValue(
  value: string | null,
  t: BrowserTranslate,
): string | null {
  if (!value) return null;
  const prefixLabel = "Restored until ";
  if (!value.startsWith(prefixLabel)) {
    return value;
  }
  const rawDate = value.slice(prefixLabel.length).trim();
  if (!rawDate) return t({ en: "Restored", zh: "已恢复" });
  const formattedDate = formatDateTime(rawDate);
  return t({
    en: `${prefixLabel}${formattedDate}`,
    zh: `恢复截止 ${formattedDate}`,
  });
}

type BrowserObjectColumnValueProps = {
  item: BrowserItem;
  columnId: BrowserColumnId;
  lazyEntry?: LazyColumnCacheEntry;
};

export function BrowserObjectColumnValue({
  item,
  columnId,
  lazyEntry,
}: BrowserObjectColumnValueProps): ReactNode {
  const { t } = useI18n();
  if (columnId === "type") {
    if (item.type === "folder") {
      return item.isHistorical
        ? t({ en: "Historical folder", zh: "历史文件夹" })
        : item.isDeleted
          ? t({ en: "Deleted folder", zh: "已删除文件夹" })
          : t({ en: "Folder", zh: "文件夹" });
    }
    return item.isDeleted
      ? t({ en: "Deleted object", zh: "已删除对象" })
      : t({ en: "Object", zh: "对象" });
  }
  if (columnId === "size") {
    return item.size;
  }
  if (columnId === "modified") {
    return item.modified;
  }
  if (columnId === "storageClass") {
    return item.storageClass ?? "—";
  }
  if (columnId === "etag") {
    return item.etag ?? "—";
  }

  if (item.type !== "file" || item.isDeleted) {
    return "—";
  }
  const resolvedLazyEntry = lazyEntry ?? createLazyColumnCacheEntry();
  if (columnId === "contentType") {
    return renderLazyCellValue(
      resolvedLazyEntry.metadataStatus,
      resolvedLazyEntry.contentType,
      t,
    );
  }
  if (columnId === "tagsCount") {
    return renderLazyCellValue(
      resolvedLazyEntry.tagsStatus,
      resolvedLazyEntry.tagsCount,
      t,
    );
  }
  if (columnId === "metadataCount") {
    return renderLazyCellValue(
      resolvedLazyEntry.metadataStatus,
      resolvedLazyEntry.metadataCount,
      t,
    );
  }
  if (columnId === "cacheControl") {
    return renderLazyCellValue(
      resolvedLazyEntry.metadataStatus,
      resolvedLazyEntry.cacheControl,
      t,
    );
  }
  if (columnId === "expires") {
    return renderLazyCellValue(
      resolvedLazyEntry.metadataStatus,
      formatExpiresCellValue(resolvedLazyEntry.expires),
      t,
    );
  }
  if (columnId === "restoreStatus") {
    return renderLazyCellValue(
      resolvedLazyEntry.metadataStatus,
      formatRestoreStatusCellValue(resolvedLazyEntry.restoreStatus, t),
      t,
    );
  }
  return "—";
}

type BrowserObjectColumnHeaderContentProps = {
  column: ColumnDefinition;
  sortKey: BrowserSortKey;
  sortDirection: "asc" | "desc";
  onSort: (sortKey: BrowserSortKey) => void;
};

export function BrowserObjectColumnHeaderContent({
  column,
  sortKey,
  sortDirection,
  onSort,
}: BrowserObjectColumnHeaderContentProps) {
  const sortable = column.sortable;
  if (!sortable) {
    return <span className="inline-flex h-6 items-center">{column.label}</span>;
  }
  const active = sortKey === sortable;
  return (
    <button
      type="button"
      onClick={() => onSort(sortable)}
      className="group inline-flex h-6 items-center gap-1 text-left text-slate-500 transition hover:text-primary-700 dark:text-slate-400 dark:hover:text-primary-100"
    >
      <span>{column.label}</span>
      <ChevronDownIcon
        className={`h-3 w-3 transition ${active ? "opacity-100" : "opacity-30"} ${
          active && sortDirection === "asc" ? "-rotate-180" : ""
        }`}
      />
    </button>
  );
}

type BrowserColumnResizeHandleProps = {
  label: string;
  active: boolean;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onReset: () => void;
};

export function BrowserColumnResizeHandle({
  label,
  active,
  onPointerDown,
  onReset,
}: BrowserColumnResizeHandleProps) {
  const { t } = useI18n();
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t({
        en: `Resize ${label} column`, zh: `调整${label}列宽`,
      })}
      title={t({
        en: `Resize ${label} column`, zh: `调整${label}列宽`,
      })}
      className="absolute inset-y-0 right-0 z-10 translate-x-1/2 cursor-col-resize touch-none select-none"
      style={{ width: `${COLUMN_RESIZER_HITBOX_WIDTH_PX}px` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onReset();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className={`mx-auto h-full w-0.5 rounded-full bg-slate-200 transition dark:bg-slate-700 ${
          active
            ? "bg-primary dark:bg-primary-300"
            : "hover:bg-slate-300 dark:hover:bg-slate-500"
        }`}
      />
    </div>
  );
}
