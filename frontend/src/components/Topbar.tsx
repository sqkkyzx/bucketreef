/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useI18n, type I18nMessage } from "../i18n";
import { type KeyboardEvent as ReactKeyboardEvent, ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  clearReadUserNotifications,
  deleteUserNotification,
  fetchUserNotifications,
  markUserNotificationsRead,
  type UserNotification,
} from "../api/userNotifications";
import type { EffectiveUserAccess, UiRole, UserAvatarDescriptor } from "../api/users";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  canAccessPrivateConnectionsSection,
  readStoredUser,
  SESSION_USER_UPDATED_EVENT,
} from "../utils/workspaces";
import type { WorkspaceSwitcherModel } from "./EnvironmentSwitcher";
import ThemeToggle from "./ThemeToggle";
import type { TopbarControlDescriptor } from "./topbarControlsLayout";
import AnchoredPortalMenu from "./ui/AnchoredPortalMenu";
import { useDismissibleLayer } from "./ui/useDismissibleLayer";
import UserAvatar from "./UserAvatar";

type TopbarProps = {
  projectName?: string;
  section?: string;
  inlineContent?: ReactNode;
  controlsContent?: ReactNode;
  controlDescriptors?: TopbarControlDescriptor[];
  userEmail?: string | null;
  onLogout?: () => void;
  contextAction?: ReactNode;
  showMobileMenuButton?: boolean;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  showWorkspaceSwitcher?: boolean;
  workspaceSwitcher?: WorkspaceSwitcherModel | null;
  profilePath?: string;
};

type StoredAccountLink = {
  account_id: number;
};

type StoredTopbarUser = {
  full_name?: string | null;
  avatar?: UserAvatarDescriptor | null;
  role?: UiRole | null;
  can_create_manual_private_connections?: boolean | null;
  can_provision_managed_private_connections?: boolean | null;
  effective_access?: Pick<
    EffectiveUserAccess,
    | "can_create_manual_private_connections"
    | "can_provision_managed_private_connections"
    | "has_owned_private_connections"
  > | null;
  authType?: "password" | "s3_session" | "oidc" | "ldap" | null;
  account_links?: StoredAccountLink[] | null;
};

function resolveUiRoleLabel(user: StoredTopbarUser | null, t: ReturnType<typeof useI18n>["t"]): string {
  if (!user) return t({
    en: "Unknown",
    fr: "Inconnu",
    de: "Unbekannt",
    zh: "未知",
  });
  if (user.authType === "s3_session") return t({
    en: "S3 Session",
    fr: "Session S3",
    de: "S3-Sitzung",
    zh: "S3 会话",
  });
  if (user.role === "ui_superadmin") return t({
    en: "Superadmin",
    fr: "Super-administrateur",
    de: "Superadministrator",
    zh: "超级管理员",
  });
  if (user.role === "ui_admin") return t({
    en: "Admin",
    fr: "Administrateur",
    de: "Administrator",
    zh: "管理员",
  });
  if (user.role === "ui_user") return t({
    en: "User",
    fr: "Utilisateur",
    de: "Benutzer",
    zh: "用户",
  });
  if (user.role === "ui_none") return t({
    en: "No access",
    fr: "Aucun accès",
    de: "Kein Zugriff",
    zh: "无访问权限",
  });
  return t({
    en: "Unknown",
    fr: "Inconnu",
    de: "Unbekannt",
    zh: "未知",
  });
}

function compactWorkspaceLabel(label: string | null | undefined, t: ReturnType<typeof useI18n>["t"]): string {
  const normalized = (label ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!normalized) return t({
    en: "Workspace",
    fr: "Espace de travail",
    de: "Arbeitsbereich",
    zh: "工作区",
  });
  if (normalized.toLowerCase() === "administration") return t({
    en: "Admin",
    fr: "Administrateur",
    de: "Administrator",
    zh: "管理员",
  });
  return normalized;
}

function formatPercent(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}%`;
}

function formatBytes(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let amount = Math.max(0, value);
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const fractionDigits = amount >= 10 || unitIndex === 0 ? 0 : 1;
  return `${amount.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function formatCount(value: unknown, locale: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString(locale);
}

function formatDateTime(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Topbar({
  section,
  inlineContent,
  controlsContent,
  controlDescriptors,
  userEmail,
  onLogout,
  contextAction,
  showMobileMenuButton = false,
  mobileMenuOpen = false,
  onMobileMenuToggle,
  showWorkspaceSwitcher = true,
  workspaceSwitcher,
  profilePath = "/profile",
}: TopbarProps) {
  const { t, locale } = useI18n();
  const [storedUser, setStoredUser] = useState<StoredTopbarUser | null>(
    () => readStoredUser() as StoredTopbarUser | null,
  );
  const isS3Session = storedUser?.authType === "s3_session";
  const canAccessPrivateConnections =
    !isS3Session && canAccessPrivateConnectionsSection(storedUser);
  const uiRoleLabel = useMemo(() => resolveUiRoleLabel(storedUser, t), [storedUser, t]);

  const isMobileViewport = useMediaQuery("(max-width: 767px)");
  const [controlsAvailableWidth, setControlsAvailableWidth] = useState<number>(Number.POSITIVE_INFINITY);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRootRef = useRef<HTMLDivElement | null>(null);
  const accountMenuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuId = useId();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<I18nMessage | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [deletingNotification, setDeletingNotification] = useState<number | "read" | null>(null);
  const notificationsRootRef = useRef<HTMLDivElement | null>(null);
  const notificationsSurfaceRef = useRef<HTMLDivElement | null>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notificationsMenuId = useId();

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceActiveIndex, setWorkspaceActiveIndex] = useState(-1);
  const workspaceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const workspaceMenuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const workspaceListboxRef = useRef<HTMLDivElement | null>(null);
  const workspaceListboxId = useId();

  const controlsStripRef = useRef<HTMLDivElement | null>(null);

  const accountDisplay = userEmail ?? t({
    en: "Session",
    fr: "Session",
    de: "Sitzung",
    zh: "会话",
  });
  const accountName = storedUser?.full_name?.trim() || accountDisplay;
  const accountAvatarName = accountName === accountDisplay ? null : accountName;
  const showNotifications = !isS3Session;

  useDismissibleLayer({
    open: workspaceMenuOpen,
    insideRefs: [workspaceTriggerRef, workspaceMenuSurfaceRef],
    onDismiss: (reason) => {
      setWorkspaceMenuOpen(false);
      if (reason === "escape") workspaceTriggerRef.current?.focus();
    },
    preventEscapeDefault: true,
  });
  useDismissibleLayer({
    open: accountMenuOpen,
    insideRefs: [accountMenuRootRef, accountMenuSurfaceRef],
    onDismiss: (reason) => {
      setAccountMenuOpen(false);
      if (reason === "escape") accountMenuTriggerRef.current?.focus();
    },
    preventEscapeDefault: true,
  });
  useDismissibleLayer({
    open: notificationsOpen,
    insideRefs: [notificationsRootRef, notificationsSurfaceRef],
    onDismiss: (reason) => {
      setNotificationsOpen(false);
      if (reason === "escape") notificationsTriggerRef.current?.focus();
    },
    preventEscapeDefault: true,
  });

  useEffect(() => {
    const syncStoredUser = () => {
      setStoredUser(readStoredUser() as StoredTopbarUser | null);
    };
    window.addEventListener(SESSION_USER_UPDATED_EVENT, syncStoredUser);
    window.addEventListener("storage", syncStoredUser);
    return () => {
      window.removeEventListener(SESSION_USER_UPDATED_EVENT, syncStoredUser);
      window.removeEventListener("storage", syncStoredUser);
    };
  }, []);
  const loadNotifications = useCallback(async () => {
    if (!showNotifications) return;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await fetchUserNotifications(20);
      setNotifications(response.items);
      setUnreadNotificationsCount(response.unread_count);
    } catch {
      setNotificationsError({
        en: "Unable to load notifications.",
        fr: "Impossible de charger les notifications.",
        de: "Benachrichtigungen konnten nicht geladen werden.",
        zh: "无法加载通知。",
      });
    } finally {
      setNotificationsLoading(false);
    }
  }, [showNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!showNotifications || unreadNotificationsCount <= 0) return;
    setNotificationsError(null);
    try {
      const response = await markUserNotificationsRead({ all: true });
      setUnreadNotificationsCount(response.unread_count);
      await loadNotifications();
    } catch (error) {
      console.warn("Unable to mark notifications as read", error);
      setNotificationsError({
        en: "Unable to mark notifications as read.",
        fr: "Impossible de marquer les notifications comme lues.",
        de: "Benachrichtigungen konnten nicht als gelesen markiert werden.",
        zh: "无法将通知标为已读。",
      });
    }
  }, [loadNotifications, showNotifications, unreadNotificationsCount]);

  const deleteNotification = useCallback(async (notificationId: number) => {
    setNotificationsError(null);
    setDeletingNotification(notificationId);
    try {
      const response = await deleteUserNotification(notificationId);
      setUnreadNotificationsCount(response.unread_count);
      await loadNotifications();
    } catch (error) {
      console.warn("Unable to delete notification", error);
      setNotificationsError({
        en: "Unable to delete notification.",
        fr: "Impossible de supprimer la notification.",
        de: "Benachrichtigung konnte nicht gelöscht werden.",
        zh: "无法删除通知。",
      });
    } finally {
      setDeletingNotification(null);
    }
  }, [loadNotifications]);

  const clearReadNotifications = useCallback(async () => {
    setNotificationsError(null);
    setDeletingNotification("read");
    try {
      const response = await clearReadUserNotifications();
      setUnreadNotificationsCount(response.unread_count);
      await loadNotifications();
    } catch (error) {
      console.warn("Unable to clear read notifications", error);
      setNotificationsError({
        en: "Unable to clear read notifications.",
        fr: "Impossible de supprimer les notifications lues.",
        de: "Gelesene Benachrichtigungen konnten nicht gelöscht werden.",
        zh: "无法清除已读通知。",
      });
    } finally {
      setDeletingNotification(null);
    }
  }, [loadNotifications]);

  const adaptiveControlDescriptors = useMemo(
    () => (controlDescriptors?.filter((control) => control.id !== "workspace") ?? []),
    [controlDescriptors]
  );
  const hasAdaptiveControls = adaptiveControlDescriptors.length > 0;
  const inlineControls = useMemo(() => {
    if (!hasAdaptiveControls) {
      return [] as { id: TopbarControlDescriptor["id"]; mode: "icon" | "icon_label"; descriptor: TopbarControlDescriptor }[];
    }
    const sorted = [...adaptiveControlDescriptors].sort((left, right) => left.priority - right.priority);
    const iconGap = 8;
    const iconOnlyWidth =
      sorted.reduce((sum, item) => sum + item.estimatedIconWidth, 0) + Math.max(0, sorted.length - 1) * iconGap;
    let remainingWidth = Math.max(0, Math.floor(controlsAvailableWidth) - iconOnlyWidth);

    return sorted.map((descriptor) => {
      if (isMobileViewport) {
        return { id: descriptor.id, mode: "icon" as const, descriptor };
      }
      const labelExtraWidth = Math.max(0, descriptor.estimatedLabelWidth - descriptor.estimatedIconWidth);
      if (remainingWidth >= labelExtraWidth) {
        remainingWidth -= labelExtraWidth;
        return { id: descriptor.id, mode: "icon_label" as const, descriptor };
      }
      return { id: descriptor.id, mode: "icon" as const, descriptor };
    });
  }, [adaptiveControlDescriptors, controlsAvailableWidth, hasAdaptiveControls, isMobileViewport]);

  const workspaceOptions = useMemo(() => workspaceSwitcher?.options ?? [], [workspaceSwitcher]);
  const workspaceSelectedIndex = useMemo(() => {
    if (!workspaceSwitcher) return -1;
    return workspaceOptions.findIndex((option) => option.value === workspaceSwitcher.currentWorkspaceId);
  }, [workspaceOptions, workspaceSwitcher]);

  useEffect(() => {
    if (!showNotifications) return;
    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadNotifications, showNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void loadNotifications();
  }, [loadNotifications, notificationsOpen]);

  useEffect(() => {
    if (!hasAdaptiveControls) return;
    const target = controlsStripRef.current;
    if (!target) return;

    const update = () => {
      const width = target.getBoundingClientRect().width;
      if (width > 0) {
        setControlsAvailableWidth(Math.floor(width));
      }
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        update();
      });
      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [hasAdaptiveControls]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    setWorkspaceActiveIndex(workspaceSelectedIndex >= 0 ? workspaceSelectedIndex : workspaceOptions.length > 0 ? 0 : -1);
    requestAnimationFrame(() => {
      workspaceListboxRef.current?.focus();
    });
  }, [workspaceMenuOpen, workspaceOptions.length, workspaceSelectedIndex]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    if (workspaceOptions.length === 0) {
      setWorkspaceActiveIndex(-1);
      return;
    }
    if (workspaceActiveIndex < 0 || workspaceActiveIndex >= workspaceOptions.length) {
      setWorkspaceActiveIndex(0);
    }
  }, [workspaceActiveIndex, workspaceMenuOpen, workspaceOptions.length]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const queryMenuItems = () =>
      Array.from(accountMenuSurfaceRef.current?.querySelectorAll<HTMLButtonElement>("[data-account-menu-item='true']") ?? []);

    const focusMenuItem = (index: number) => {
      const items = queryMenuItems();
      if (items.length === 0) return;
      const normalizedIndex = (index + items.length) % items.length;
      items[normalizedIndex].focus();
    };

    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        setAccountMenuOpen(false);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const activeElement = document.activeElement as HTMLElement | null;
      const items = queryMenuItems();
      if (items.length === 0) return;
      const currentIndex = activeElement ? items.findIndex((item) => item === activeElement) : -1;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusMenuItem(currentIndex + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusMenuItem(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusMenuItem(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        focusMenuItem(items.length - 1);
      }
    };

    requestAnimationFrame(() => {
      focusMenuItem(0);
    });

    document.addEventListener("keydown", handleMenuKeyDown);
    return () => {
      document.removeEventListener("keydown", handleMenuKeyDown);
    };
  }, [accountMenuOpen]);

  const triggerLogout = () => {
    setAccountMenuOpen(false);
    onLogout?.();
  };

  const activateWorkspaceByIndex = (index: number) => {
    if (!workspaceSwitcher) return;
    if (index < 0 || index >= workspaceOptions.length) return;
    const option = workspaceOptions[index];
    setWorkspaceMenuOpen(false);
    if (option.value !== workspaceSwitcher.currentWorkspaceId) {
      workspaceSwitcher.onChange(option.value);
    }
    workspaceTriggerRef.current?.focus();
  };

  const handleWorkspaceListboxKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setWorkspaceMenuOpen(false);
      workspaceTriggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setWorkspaceMenuOpen(false);
      return;
    }
    if (workspaceOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setWorkspaceActiveIndex((current) => (current < 0 ? 0 : (current + 1) % workspaceOptions.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setWorkspaceActiveIndex((current) =>
        current < 0 ? workspaceOptions.length - 1 : (current - 1 + workspaceOptions.length) % workspaceOptions.length
      );
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setWorkspaceActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setWorkspaceActiveIndex(workspaceOptions.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (workspaceActiveIndex >= 0) activateWorkspaceByIndex(workspaceActiveIndex);
    }
  };

  const workspaceTriggerLabel = workspaceSwitcher
    ? compactWorkspaceLabel(workspaceSwitcher.currentWorkspaceLabel, t)
    : compactWorkspaceLabel(section, t);
  const showWorkspaceInTopbar = showWorkspaceSwitcher;

  const renderWorkspaceSelector = (placement: "sidebar" | "topbar") => {
    const sidebarPlacement = placement === "sidebar";

    if (workspaceSwitcher) {
      return (
        <div className="relative min-w-0 shrink-0">
          <button
            ref={workspaceTriggerRef}
            type="button"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
            aria-label={t({
              en: "Switch workspace",
              fr: "Changer d’espace de travail",
              de: "Arbeitsbereich wechseln",
              zh: "切换工作区",
            })}
            aria-haspopup="listbox"
            aria-expanded={workspaceMenuOpen}
            aria-controls={workspaceMenuOpen ? workspaceListboxId : undefined}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              setWorkspaceMenuOpen(true);
            }}
            className={`shell-control inline-flex min-w-0 items-center rounded-lg border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
              sidebarPlacement
                ? "h-10 w-full px-3"
                : "h-10 w-[140px] px-3"
            } ${workspaceMenuOpen ? "shell-control-active" : ""}`}
          >
            <span className="min-w-0 flex-1 leading-tight">
              <span className="shell-muted-text block truncate text-[10px] font-medium">{t({
                en: "Workspace",
                fr: "Espace de travail",
                de: "Arbeitsbereich",
                zh: "工作区",
              })}</span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold leading-4 text-[var(--shell-text)]">
                {workspaceTriggerLabel}
              </span>
            </span>
            <ChevronDownIcon
              className={`shell-icon-muted ml-2 h-4 w-4 shrink-0 transition-transform ${
                workspaceMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {workspaceMenuOpen && (
            <AnchoredPortalMenu
              open={workspaceMenuOpen}
              anchorRef={workspaceTriggerRef}
              placement="bottom-start"
              minWidth={240}
              className="shell-menu overflow-hidden rounded-lg border p-1.5"
            >
              <div ref={workspaceMenuSurfaceRef}>
                <div
                  id={workspaceListboxId}
                  ref={workspaceListboxRef}
                  className="max-h-72 overflow-y-auto focus:outline-none"
                  role="listbox"
                  tabIndex={0}
                  aria-label={t({
                    en: "Switch workspace",
                    fr: "Changer d’espace de travail",
                    de: "Arbeitsbereich wechseln",
                    zh: "切换工作区",
                  })}
                  aria-activedescendant={
                    workspaceActiveIndex >= 0 ? `${workspaceListboxId}-option-${workspaceActiveIndex}` : undefined
                  }
                  onKeyDown={handleWorkspaceListboxKeyDown}
                >
                  {workspaceOptions.map((option, index) => {
                    const active = workspaceSwitcher.currentWorkspaceId === option.value;
                    const highlighted = workspaceOptions[workspaceActiveIndex]?.value === option.value;
                    return (
                      <button
                        key={option.value}
                        id={`${workspaceListboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        onMouseEnter={() => setWorkspaceActiveIndex(index)}
                        onClick={() => activateWorkspaceByIndex(index)}
                        className={`flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left transition ${
                          active
                            ? "shell-menu-item-active"
                            : highlighted
                              ? "shell-menu-item-highlighted"
                              : "shell-menu-item hover:bg-[var(--shell-hover)]"
                        }`}
                      >
                        <span className="mt-0.5 h-4 w-4 shrink-0">
                          {active ? <CheckIcon className="h-4 w-4" /> : null}
                        </span>
                        {option.icon && (
                          <span className="shell-icon-muted mt-0.5 h-4 w-4 shrink-0">{option.icon}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate ui-caption font-semibold">{option.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </AnchoredPortalMenu>
          )}
        </div>
      );
    }

    return (
      <div className={`shell-control flex min-w-0 items-center gap-2 rounded-lg border ${sidebarPlacement ? "h-10 px-3" : "h-10 w-[140px] px-3"}`}>
        <span className="min-w-0 leading-[1.05]">
          <span className="shell-muted-text block truncate text-[10px] font-medium">{t({
            en: "Workspace",
            fr: "Espace de travail",
            de: "Arbeitsbereich",
            zh: "工作区",
          })}</span>
          {workspaceTriggerLabel && (
            <span className="mt-0.5 block truncate text-[12px] font-semibold leading-4 text-[var(--shell-text)]">
              {workspaceTriggerLabel}
            </span>
          )}
        </span>
      </div>
    );
  };

  const renderNotificationItem = (item: UserNotification) => {
    const payload = item.payload ?? {};
    const isOperationalCheck = item.type === "quota_alert" || item.type === "endpoint_health";
    const occurredAt = formatDateTime(
      (isOperationalCheck ? payload.checked_at as string | undefined : undefined) ?? item.created_at, locale
    );
    const ratio = formatPercent(payload.usage_ratio_pct);
    const usedBytes = formatBytes(payload.used_bytes);
    const quotaBytes = formatBytes(payload.quota_size_bytes);
    const usedObjects = formatCount(payload.used_objects, locale);
    const quotaObjects = formatCount(payload.quota_objects, locale);
    const endpointName = typeof payload.endpoint_name === "string" ? payload.endpoint_name : null;
    const targetUserEmail = typeof payload.target_user_email === "string" ? payload.target_user_email : null;
    const provider =
      typeof payload.provider_type === "string" && typeof payload.provider_id === "string"
        ? `${payload.provider_type}:${payload.provider_id}`
        : null;
    const currentStatus = typeof payload.current_status === "string" ? payload.current_status : null;
    const checkMode = typeof payload.check_mode === "string" ? payload.check_mode : null;
    const latency = typeof payload.latency_ms === "number" ? `${Math.round(payload.latency_ms)} ms` : null;
    const expiresAt = formatDateTime(typeof payload.expires_at === "string" ? payload.expires_at : null, locale);
    const severityLabel = item.severity === "error" ? t({
      en: "Error",
      fr: "Erreur",
      de: "Fehler",
      zh: "错误",
    }) : item.severity === "warning" ? t({
      en: "Warning",
      fr: "Avertissement",
      de: "Warnung",
      zh: "警告",
    }) : t({
      en: "Info",
      fr: "Information",
      de: "Information",
      zh: "信息",
    });
    const severityClass =
      item.severity === "error"
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700/70 dark:bg-red-950/30 dark:text-red-200"
        : item.severity === "warning"
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700/70 dark:bg-blue-950/30 dark:text-blue-200";
    return (
      <li
        key={item.id}
        className={`rounded-md border px-3 py-2 ${
          item.read_at ? "border-[color:var(--shell-border-soft)]" : "border-[color:var(--shell-border)] bg-[var(--shell-hover)]"
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate ui-caption font-semibold text-[var(--shell-text)]">{item.title}</p>
            <p className="mt-0.5 ui-caption text-[var(--shell-text)]">{item.message}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClass}`}>
              {severityLabel}
            </span>
            <button
              type="button"
              onClick={() => void deleteNotification(item.id)}
              disabled={deletingNotification !== null}
              aria-label={t({ en: `Delete notification: ${item.title}`, fr: `Supprimer la notification : ${item.title}`, de: `Benachrichtigung löschen: ${item.title}`, zh: `删除通知：${item.title}` })}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--shell-muted)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingNotification === item.id ? t({
                en: "Deleting...",
                fr: "Suppression…",
                de: "Wird gelöscht…",
                zh: "正在删除…",
              }) : t({
                en: "Delete",
                fr: "Supprimer",
                de: "Löschen",
                zh: "删除",
              })}
            </button>
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 ui-caption text-[var(--shell-muted)]">
          {ratio && (
            <>
              <dt>{t({
                en: "Usage",
                fr: "Utilisation",
                de: "Auslastung",
                zh: "使用率",
              })}</dt>
              <dd className="text-right font-semibold text-[var(--shell-text)]">{ratio}</dd>
            </>
          )}
          {usedBytes && (
            <>
              <dt>{t({
                en: "Storage",
                fr: "Stockage",
                de: "Speicher",
                zh: "存储",
              })}</dt>
              <dd className="text-right text-[var(--shell-text)]">
                {usedBytes}
                {quotaBytes ? ` / ${quotaBytes}` : ""}
              </dd>
            </>
          )}
          {usedObjects && (
            <>
              <dt>{t({
                en: "Objects",
                fr: "Objets",
                de: "Objekte",
                zh: "对象",
              })}</dt>
              <dd className="text-right text-[var(--shell-text)]">
                {usedObjects}
                {quotaObjects ? ` / ${quotaObjects}` : ""}
              </dd>
            </>
          )}
          {endpointName && (
            <>
              <dt>{t({
                en: "Endpoint",
                fr: "Point de terminaison",
                de: "Endpunkt",
                zh: "端点",
              })}</dt>
              <dd className="truncate text-right text-[var(--shell-text)]">{endpointName}</dd>
            </>
          )}
          {targetUserEmail && (
            <>
              <dt>{t({
                en: "User",
                fr: "Utilisateur",
                de: "Benutzer",
                zh: "用户",
              })}</dt>
              <dd className="truncate text-right text-[var(--shell-text)]">{targetUserEmail}</dd>
            </>
          )}
          {provider && (
            <>
              <dt>{t({
                en: "Provider",
                fr: "Fournisseur",
                de: "Anbieter",
                zh: "提供方",
              })}</dt>
              <dd className="truncate text-right text-[var(--shell-text)]">{provider}</dd>
            </>
          )}
          {currentStatus && (
            <>
              <dt>{t({
                en: "Status",
                fr: "État",
                de: "Status",
                zh: "状态",
              })}</dt>
              <dd className="text-right font-semibold capitalize text-[var(--shell-text)]">{currentStatus}</dd>
            </>
          )}
          {checkMode && (
            <>
              <dt>{t({
                en: "Check",
                fr: "Vérification",
                de: "Prüfung",
                zh: "检查",
              })}</dt>
              <dd className="text-right uppercase text-[var(--shell-text)]">{checkMode}</dd>
            </>
          )}
          {latency && (
            <>
              <dt>{t({
                en: "Latency",
                fr: "Latence",
                de: "Latenz",
                zh: "延迟",
              })}</dt>
              <dd className="text-right text-[var(--shell-text)]">{latency}</dd>
            </>
          )}
          {expiresAt && (
            <>
              <dt>{t({
                en: "Expires",
                fr: "Expiration",
                de: "Läuft ab",
                zh: "到期时间",
              })}</dt>
              <dd className="text-right text-[var(--shell-text)]">{expiresAt}</dd>
            </>
          )}
          {occurredAt && (
            <>
              <dt>{isOperationalCheck ? t({
                en: "Checked",
                fr: "Vérifié",
                de: "Geprüft",
                zh: "检查时间",
              }) : t({
                en: "Created",
                fr: "Créé",
                de: "Erstellt",
                zh: "创建时间",
              })}</dt>
              <dd className="text-right text-[var(--shell-text)]">{occurredAt}</dd>
            </>
          )}
        </dl>
      </li>
    );
  };

  return (
    <>
      <div
        data-topbar
        className="shell-topbar z-[45] shrink-0"
      >
        <div className="flex h-14 min-w-0 items-center gap-2.5 px-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showMobileMenuButton && (
              <button
                type="button"
                onClick={onMobileMenuToggle}
                aria-label={mobileMenuOpen ? t({
                  en: "Close navigation",
                  fr: "Fermer la navigation",
                  de: "Navigation schließen",
                  zh: "关闭导航",
                }) : t({
                  en: "Open navigation",
                  fr: "Ouvrir la navigation",
                  de: "Navigation öffnen",
                  zh: "打开导航",
                })}
                aria-controls="mobile-navigation-panel"
                aria-expanded={mobileMenuOpen}
                className="shell-control inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 md:hidden"
              >
                <HamburgerIcon className="h-4 w-4" />
              </button>
            )}

            {showWorkspaceInTopbar ? renderWorkspaceSelector("topbar") : null}

            {hasAdaptiveControls ? (
              <div ref={controlsStripRef} className="flex min-w-0 flex-1 items-center">
                <div className="flex min-w-0 items-center gap-2">
                  {inlineControls.map((entry) => {
                    return <div key={entry.id}>{entry.descriptor.renderControl(entry.mode)}</div>;
                  })}
                </div>
              </div>
            ) : (
              controlsContent && <div className="hidden min-w-0 items-center md:flex">{controlsContent}</div>
            )}
          </div>

          {inlineContent && <div className="hidden min-w-0 items-center pl-1 xl:flex">{inlineContent}</div>}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {contextAction && <div className="hidden sm:flex">{contextAction}</div>}

            <ThemeToggle />

            {showNotifications && (
              <div ref={notificationsRootRef} className="relative">
                <button
                  ref={notificationsTriggerRef}
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label={t({
                    en: "Notifications",
                    fr: "Notifications",
                    de: "Benachrichtigungen",
                    zh: "通知",
                  })}
                  aria-haspopup="menu"
                  aria-expanded={notificationsOpen}
                  aria-controls={notificationsOpen ? notificationsMenuId : undefined}
                  className={`shell-control relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    notificationsOpen ? "shell-control-active" : ""
                  }`}
                >
                  <BellIcon className="h-4 w-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <AnchoredPortalMenu
                    open={notificationsOpen}
                    anchorRef={notificationsTriggerRef}
                    placement="bottom-end"
                    minWidth={360}
                    className="shell-menu w-[22.5rem] max-w-[calc(100vw-1.5rem)] rounded-lg border p-0"
                  >
                    <div
                      id={notificationsMenuId}
                      ref={notificationsSurfaceRef}
                      role="menu"
                      aria-label={t({
                        en: "Notifications",
                        fr: "Notifications",
                        de: "Benachrichtigungen",
                        zh: "通知",
                      })}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--shell-border-soft)] px-3 py-2">
                        <div>
                          <p className="ui-caption font-semibold text-[var(--shell-text)]">{t({
                            en: "Notifications",
                            fr: "Notifications",
                            de: "Benachrichtigungen",
                            zh: "通知",
                          })}</p>
                          <p className="shell-muted-text ui-caption">{t({ en: `${unreadNotificationsCount} unread`, fr: `${unreadNotificationsCount} non lues`, de: `${unreadNotificationsCount} ungelesen`, zh: `${unreadNotificationsCount} 条未读` })}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void clearReadNotifications()}
                            disabled={notifications.length === 0 || deletingNotification !== null}
                            className="rounded-md px-2 py-1 ui-caption font-semibold text-[var(--shell-muted)] transition hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingNotification === "read" ? t({
                              en: "Clearing...",
                              fr: "Suppression…",
                              de: "Wird geleert…",
                              zh: "正在清除…",
                            }) : t({
                              en: "Clear read",
                              fr: "Supprimer les notifications lues",
                              de: "Gelesene löschen",
                              zh: "清除已读",
                            })}
                          </button>
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            disabled={unreadNotificationsCount <= 0 || deletingNotification !== null}
                            className="rounded-md px-2 py-1 ui-caption font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-200 dark:hover:bg-white/[0.06]"
                          >
                            {t({
                              en: "Mark all as read",
                              fr: "Tout marquer comme lu",
                              de: "Alle als gelesen markieren",
                              zh: "全部标为已读",
                            })}</button>
                        </div>
                      </div>

                      <div className="max-h-[28rem] overflow-y-auto p-2">
                        {notificationsError && (
                          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 ui-caption text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-200">
                            {t(notificationsError)}
                          </div>
                        )}
                        {notificationsLoading && notifications.length === 0 ? (
                          <div className="rounded-md border border-[color:var(--shell-border-soft)] px-3 py-6 text-center ui-caption text-[var(--shell-muted)]">
                            {t({
                              en: "Loading notifications...",
                              fr: "Chargement des notifications…",
                              de: "Benachrichtigungen werden geladen…",
                              zh: "正在加载通知…",
                            })}</div>
                        ) : notifications.length === 0 ? (
                          <div className="rounded-md border border-[color:var(--shell-border-soft)] px-3 py-6 text-center ui-caption text-[var(--shell-muted)]">
                            {t({
                              en: "No notifications.",
                              fr: "Aucune notification.",
                              de: "Keine Benachrichtigungen.",
                              zh: "暂无通知。",
                            })}</div>
                        ) : (
                          <ul className="space-y-2">{notifications.map(renderNotificationItem)}</ul>
                        )}
                      </div>
                    </div>
                  </AnchoredPortalMenu>
                )}
              </div>
            )}

            <div ref={accountMenuRootRef} className="relative">
              <button
                ref={accountMenuTriggerRef}
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label={t({ en: `Account actions for ${accountDisplay}`, fr: `Actions du compte ${accountDisplay}`, de: `Kontoaktionen für ${accountDisplay}`, zh: `${accountDisplay} 的账户操作` })}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls={accountMenuOpen ? accountMenuId : undefined}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  setAccountMenuOpen(true);
                }}
                className="inline-flex h-9 items-center gap-0 rounded-lg border border-transparent bg-transparent px-1 text-left transition hover:bg-[var(--shell-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:gap-2 sm:px-1.5"
              >
                <UserAvatar
                  avatar={storedUser?.avatar}
                  name={accountAvatarName}
                  email={accountDisplay}
                  size="md"
                  className="border-[var(--shell-surface)] shadow-none"
                />
                <span className="hidden min-w-0 max-w-40 truncate text-[12px] font-semibold text-[var(--shell-text)] sm:block lg:max-w-52">
                  {accountDisplay}
                </span>
                <ChevronDownIcon
                  className={`shell-icon-muted hidden h-4 w-4 transition-transform sm:block ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountMenuOpen && (
                <AnchoredPortalMenu open={accountMenuOpen} anchorRef={accountMenuTriggerRef} placement="bottom-end" minWidth={288}>
                  <div
                    id={accountMenuId}
                    ref={accountMenuSurfaceRef}
                    role="menu"
                    aria-label={t({
                      en: "Account actions",
                      fr: "Actions du compte",
                      de: "Kontoaktionen",
                      zh: "账户操作",
                    })}
                    className="shell-menu w-72 rounded-lg border p-1.5"
                  >
                    <div className="shell-menu-muted mb-1 flex items-center gap-2.5 rounded-md border px-2.5 py-2">
                      <UserAvatar
                        avatar={storedUser?.avatar}
                        name={accountAvatarName}
                        email={accountDisplay}
                        size="lg"
                        className="border-[var(--shell-surface)] shadow-none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="shell-muted-text ui-caption">{t({
                          en: "Signed in as",
                          fr: "Connecté en tant que",
                          de: "Angemeldet als",
                          zh: "当前登录身份",
                        })}</p>
                        <p className="truncate ui-caption font-semibold text-[var(--shell-text)]">{accountName}</p>
                        {accountName !== accountDisplay ? (
                          <p className="shell-muted-text truncate ui-caption">{accountDisplay}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="shell-menu-muted inline-flex items-center rounded-full px-2 py-0.5 ui-caption font-semibold text-[var(--shell-text)]">
                            {uiRoleLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={`${profilePath}?tab=profile`}
                      role="menuitem"
                      data-account-menu-item="true"
                      onClick={() => setAccountMenuOpen(false)}
                      className="shell-menu-item flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition"
                    >
                      <UserIcon className="shell-icon-muted mt-0.5 h-4 w-4" />
                      <span>
                        <span className="block ui-caption font-semibold text-[var(--shell-text)]">
                          {t({
                            en: "User profile",
                            fr: "Profil utilisateur",
                            de: "Benutzerprofil",
                            zh: "用户资料",
                          })}</span>
                        <span className="shell-muted-text block ui-caption">
                          {t({
                            en: "Personal details and preferences",
                            fr: "Informations personnelles et préférences",
                            de: "Persönliche Angaben und Einstellungen",
                            zh: "个人信息和偏好设置",
                          })}</span>
                      </span>
                    </a>

                    {canAccessPrivateConnections && (
                      <a
                        href={`${profilePath}?tab=connections`}
                        role="menuitem"
                        data-account-menu-item="true"
                        onClick={() => setAccountMenuOpen(false)}
                        className="shell-menu-item flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition"
                      >
                        <LinkIcon className="shell-icon-muted mt-0.5 h-4 w-4" />
                        <span>
                          <span className="block ui-caption font-semibold text-[var(--shell-text)]">
                            {t({
                              en: "Private S3 connections",
                              fr: "Connexions S3 privées",
                              de: "Private S3-Verbindungen",
                              zh: "私有 S3 连接",
                            })}</span>
                          <span className="shell-muted-text block ui-caption">
                            {t({
                              en: "Manage your endpoints and credentials",
                              fr: "Gérez vos points de terminaison et identifiants",
                              de: "Endpunkte und Zugangsdaten verwalten",
                              zh: "管理您的端点和凭据",
                            })}</span>
                        </span>
                      </a>
                    )}

                    <div className="my-1 border-t border-[color:var(--shell-border-soft)]" />
                    <button
                      type="button"
                      role="menuitem"
                      data-account-menu-item="true"
                      onClick={triggerLogout}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left ui-caption font-semibold text-primary-700 transition hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-white/[0.06]"
                    >
                      <LogoutIcon className="h-4 w-4" />
                      <span>{t({
                        en: "Sign out",
                        fr: "Se déconnecter",
                        de: "Abmelden",
                        zh: "退出登录",
                      })}</span>
                    </button>
                  </div>
                </AnchoredPortalMenu>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

function HamburgerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m5 7 5 6 5-6" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m4.5 10.5 3.2 3.2 7.8-7.8" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="8" r="3.25" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14a4 4 0 0 1 0-5.66L12.34 6a4 4 0 0 1 5.66 5.66L16.5 13.2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10a4 4 0 0 1 0 5.66L11.66 18a4 4 0 0 1-5.66-5.66L7.5 10.8" />
    </svg>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M18 9.5a6 6 0 1 0-12 0c0 6-2.25 6.5-2.25 6.5h16.5S18 15.5 18 9.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 19a2.25 2.25 0 0 0 4.5 0" />
    </svg>
  );
}

function LogoutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 16.5 20 12l-5-4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H9" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19.5H6A2.5 2.5 0 0 1 3.5 17V7A2.5 2.5 0 0 1 6 4.5h6" />
    </svg>
  );
}
