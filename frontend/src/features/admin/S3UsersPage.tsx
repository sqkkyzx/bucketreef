/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageName,
  messageGeneral,
} from "../../uiMessages";
import {
  adminRgwAdmin,
  adminRgwRGWUsers,
  adminRgwUnexpectedError,
  adminRgwSelectACephEndpoint,
  adminRgwEndpoint,
  adminRgwActions,
  adminRgwEdit,
  adminRgwKeys,
  adminRgwDeleting,
  adminRgwDelete,
  adminRgwImport,
  adminRgwCreateUser,
  adminRgwCreating,
  adminRgwCephEndpoint,
  adminRgwImportRGWUsers,
  adminRgwBackToRGWUsers,
  adminRgwLinkedUIUsers,
  adminRgwLinkedUIGroups,
  adminRgwUserDetails,
  adminRgwEmail,
  adminRgwTags,
  adminRgwAddATagForThisRGWUser,
  adminRgwLoadingExistingTagCatalog,
  adminRgwClose,
  adminRgwAddUIUsers,
  adminRgwUser,
  adminRgwRemove,
  adminRgwAddUIGroups,
  adminRgwBucketQuotaManagement,
  adminRgwCephS3UserKeys,
  adminRgwManagedPrivateConnectionProvisioning,
  adminRgwCancel,
  adminRgwSaving,
} from "./adminRgwMessages";
import type { PageBreadcrumb } from "../../components/PageHeader";
import { useI18n } from "../../i18n";
import TableSortControls from "../../components/list/TableSortControls";
import { ListActions, ListActionButton, ListActionLink } from "../../components/list/ListControls";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  S3User,
  createS3User,
  deleteS3User,
  getS3User,
  getS3UserWithBuckets,
  importS3Users,
  listS3Users,
  updateS3User,
  type UpdateS3UserPayload,
  type S3UserGroupLink,
  type S3UserUserLink,
} from "../../api/s3Users";
import { listMinimalGroups, type UiGroupSummary } from "../../api/groups";
import { getStorageEndpoint, listStorageEndpoints, StorageEndpoint } from "../../api/storageEndpoints";
import { listMinimalUsers, type UserSummary } from "../../api/users";
import ActiveFiltersBar from "../../components/ActiveFiltersBar";
import ListPageSection from "../../components/list/ListPageSection";
import PageHeader from "../../components/PageHeader";
import ToolbarSearchInput from "../../components/ToolbarSearchInput";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import SettingsForm from "../../components/settings/SettingsForm";
import { SettingsDialog } from "../../components/settings/SettingsControls";
import AdminRgwEndpointField from "./AdminRgwEndpointField";
import AdminRgwCreateFields from "./AdminRgwCreateFields";
import { useAdminRgwFormValidation, rgwCreateErrors, rgwImportEntries } from "./useAdminRgwFormValidation";
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import UiCheckboxField from "../../components/ui/UiCheckboxField";
import WorkflowPage, {
  WorkflowActions,
  WorkflowMetadata,
  WorkflowSection,
  workflowPageHostClass,
} from "../../components/WorkflowPage";
import WorkflowTabs from "../../components/WorkflowTabs";
import PageBanner from "../../components/PageBanner";
import DataTableShell, {
  dataTableDefaultActionProps,
  type DataTableColumn,
} from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import StorageUsageCard from "../../components/StorageUsageCard";
import UiTagBadgeList from "../../components/UiTagBadgeList";
import UiTagEditor from "../../components/UiTagEditor";
import UiButton from "../../components/ui/UiButton";
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import UiInput from "../../components/ui/UiInput";
import UiTextarea from "../../components/ui/UiTextarea";

import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import { useTagCatalog } from "../../hooks/useTagCatalog";
import { extractApiError } from "../../utils/apiError";
import { stableSignature } from "../../utils/stableSignature";
import { nextSortState } from "../../utils/sortValues";
import { matchesExactTextCandidate, type TextMatchMode } from "../../utils/textMatch";
import { buildUiTagItems, extractUiTagLabels, normalizeUiTags, type UiTagDefinition } from "../../utils/uiTags";
import { isAdminLikeRole, readStoredUser } from "../../utils/workspaces";
import { AdminAssociationCheckboxOptions, AdminAssociationPickerPanel, AdminAssociationSectionHeader, adminAssociationPanelClass, adminAssociationTableContainerClass as associationTableContainerClass } from "./AdminAssociationPicker";
import AdminAssociationAdvancedSettings from "./AdminAssociationAdvancedSettings";
import { AdminAccessToggleSection } from "./AdminAccessSections";
import AdminQuotaFields from "./AdminQuotaFields";
import { buildAdminQuotaSizeEditorValue } from "./adminQuotaForm";
import { AssociationPrincipalStack, type AssociationPrincipalItem } from "./AssociationSummary";
import { useAdminS3UserStats } from "./useAdminS3UserStats";

type SortField = "name" | "uid";
type EditTab = "general" | "users" | "groups" | "privileged";

function getS3UserSearchCandidates(user: S3User): Array<string | number | null | undefined> {
  return [
    user.name,
    user.rgw_user_uid,
    user.email,
    ...(user.user_links ?? []).flatMap((link) => [
      link.user_email,
      link.user_full_name,
    ]),
    ...(user.group_links ?? []).map((link) => link.group_name),
    ...extractUiTagLabels(user.tags),
  ];
}

export default function S3UsersPage() {
  const { t, locale } = useI18n();
  const rgwBreadcrumbs = (...trailing: PageBreadcrumb[]) => adminPageBreadcrumbs("rgw-users", ...trailing).map((crumb, index) => ({ ...crumb, label: index === 0 ? t(adminRgwAdmin) : index === 1 ? t(adminRgwRGWUsers) : crumb.label }));
  const [users, setUsers] = useState<S3User[]>([]);
  const [portalUsers, setPortalUsers] = useState<UserSummary[]>([]);
  const [portalUsersLoaded, setPortalUsersLoaded] = useState(false);
  const [uiGroups, setUiGroups] = useState<UiGroupSummary[]>([]);
  const [uiGroupsLoaded, setUiGroupsLoaded] = useState(false);
  const [uiGroupsLoading, setUiGroupsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filter, setFilter] = useState("");
  const [quickFilterMode, setQuickFilterMode] = useState<TextMatchMode>("contains");
  const [sort, setSort] = useState<{ field: SortField; direction: "asc" | "desc" }>({
    field: "name",
    direction: "asc",
  });
  const MAX_LINK_OPTIONS = 10;
  const [storageEndpoints, setStorageEndpoints] = useState<StorageEndpoint[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [endpointsLoaded, setEndpointsLoaded] = useState(false);
  const [endpointUsersWrite, setEndpointUsersWrite] = useState<Record<number, boolean>>({});
  const [endpointBucketsWrite, setEndpointBucketsWrite] = useState<Record<number, boolean>>({});
  const [endpointPermissionLoading, setEndpointPermissionLoading] = useState<Record<number, boolean>>({});
  const [endpointPermissionErrors, setEndpointPermissionErrors] = useState<Record<number, string | null>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    uid: "",
    email: "",
    tags: [] as UiTagDefinition[],
    quota_max_size_gb: "",
    quota_max_size_unit: "GiB",
    quota_max_objects: "",
    storage_endpoint_id: "",
  });
  const [createInitialSignature, setCreateInitialSignature] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importEndpointId, setImportEndpointId] = useState("");
  const [importInitialSignature, setImportInitialSignature] = useState("");

  const [editingUser, setEditingUser] = useState<S3User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    tags: [] as UiTagDefinition[],
    user_links: [] as S3UserUserLink[],
    group_links: [] as S3UserGroupLink[],
    quota_max_size_gb: "",
    quota_max_size_unit: "GiB",
    quota_max_objects: "",
    allow_bucket_quota_management: false,
    allow_access_key_management: false,
    allow_managed_private_connection_provisioning: false,
  });
  const [editInitialSignature, setEditInitialSignature] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("general");
  const [portalUserSearch, setPortalUserSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [showEditPortalUserPanel, setShowEditPortalUserPanel] = useState(false);
  const [showEditGroupPanel, setShowEditGroupPanel] = useState(false);
  const [editPortalUserSelections, setEditPortalUserSelections] = useState<number[]>([]);
  const [editGroupSelections, setEditGroupSelections] = useState<number[]>([]);
  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };
  const clearAllFilters = () => {
    setFilter("");
    setQuickFilterMode("contains");
    setPage(1);
  };
  const toggleQuickFilterMode = () => {
    setQuickFilterMode((prev) => (prev === "contains" ? "exact" : "contains"));
    setPage(1);
  };
  const toggleSort = (field: SortField) => {
    setSort((current) => nextSortState(current, field, "desc"));
    setPage(1);
  };
  const quickFilterActive = filter.trim().length > 0;
  const handlePageChange = (nextPage: number) => {
    if (nextPage === page) return;
    setPage(Math.max(1, nextPage));
  };
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [userToDelete, setUserToDelete] = useState<S3User | null>(null);
  const [deleteFromRgw, setDeleteFromRgw] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const deleteModalHasResources =
    userToDelete != null && (userToDelete.bucket_count == null || userToDelete.bucket_count > 0);
  const editingUserId = editingUser?.id ?? null;
  const {
    stats: editingUsageStats,
    loading: editingUsageLoading,
    error: editingUsageError,
  } = useAdminS3UserStats(editingUserId, Boolean(editingUserId));
  const showEditGeneralTab = editTab === "general";
  const showEditUsersTab = editTab === "users";
  const showEditGroupsTab = editTab === "groups";
  const currentUser = useMemo(() => readStoredUser(), []);
  const canManagePrivilegedTargets = isAdminLikeRole(currentUser?.role);
  const showEditPrivilegedTab = canManagePrivilegedTargets && editTab === "privileged";
  const {
    catalog: adminTagCatalog,
    loading: adminTagCatalogLoading,
    error: adminTagCatalogError,
  } = useTagCatalog(
    { kind: "admin", domain: "admin_managed" },
    Boolean(showCreateModal || editingUser)
  );

  const extractError = useCallback((err: unknown) => extractApiError(err, t(adminRgwUnexpectedError)), [t]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const quick = filter.trim();
      if (quick && quickFilterMode === "exact") {
        const allMatches: S3User[] = [];
        let nextPage = 1;
        while (true) {
          const response = await listS3Users({
            page: nextPage,
            page_size: 200,
            search: quick,
            sort_by: sort.field,
            sort_dir: sort.direction,
            include_quota: false,
          });
          allMatches.push(...response.items);
          if (!response.has_next) break;
          nextPage += 1;
        }

        const exactMatches = allMatches.filter((user) => {
          return matchesExactTextCandidate(getS3UserSearchCandidates(user), quick);
        });
        const totalExact = exactMatches.length;
        const totalPages = Math.max(1, Math.ceil(totalExact / pageSize));
        if (totalExact > 0 && page > totalPages) {
          setPage(totalPages);
          return;
        }
        const start = (page - 1) * pageSize;
        setUsers(exactMatches.slice(start, start + pageSize));
        setTotalUsers(totalExact);
      } else {
        const response = await listS3Users({
          page,
          page_size: pageSize,
          search: quick || undefined,
          sort_by: sort.field,
          sort_dir: sort.direction,
          include_quota: false,
        });
        const totalPages = Math.max(1, Math.ceil((response.total || 0) / pageSize));
        if (response.total > 0 && page > totalPages) {
          setPage(totalPages);
          return;
        }
        setUsers(response.items);
        setTotalUsers(response.total);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [filter, quickFilterMode, pageSize, page, sort.field, sort.direction, extractError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const loadPortalUsersIfNeeded = useCallback(async () => {
    if (portalUsersLoaded) return;
    try {
      const data = await listMinimalUsers();
      setPortalUsers(data);
      setPortalUsersLoaded(true);
    } catch {
      setPortalUsers([]);
    }
  }, [portalUsersLoaded]);

  const loadGroupsIfNeeded = useCallback(async () => {
    if (uiGroupsLoaded || uiGroupsLoading) return;
    setUiGroupsLoading(true);
    try {
      const data = await listMinimalGroups();
      setUiGroups(data);
      setUiGroupsLoaded(true);
    } catch {
      setUiGroups([]);
    } finally {
      setUiGroupsLoading(false);
    }
  }, [uiGroupsLoaded, uiGroupsLoading]);

  const loadEndpointsIfNeeded = useCallback(async () => {
    if (endpointsLoaded || loadingEndpoints) return;
    setLoadingEndpoints(true);
    try {
      const data = await listStorageEndpoints();
      setStorageEndpoints(data);
      setEndpointsLoaded(true);
    } catch {
      setStorageEndpoints([]);
    } finally {
      setLoadingEndpoints(false);
    }
  }, [endpointsLoaded, loadingEndpoints]);

  const hasLinkedPortalUsers = useMemo(
    () => users.some((user) => (user.user_links?.length ?? 0) > 0),
    [users]
  );

  useEffect(() => {
    if (!hasLinkedPortalUsers) return;
    void loadPortalUsersIfNeeded();
  }, [hasLinkedPortalUsers, loadPortalUsersIfNeeded]);

  const fetchEndpointUsersWritePermission = useCallback(
    async (endpointId: number) => {
      if (!Number.isFinite(endpointId) || endpointId <= 0) return;
      if (endpointPermissionLoading[endpointId]) return;
      setEndpointPermissionLoading((prev) => ({ ...prev, [endpointId]: true }));
      try {
        const endpoint = await getStorageEndpoint(endpointId, { include_admin_ops_permissions: true });
        setEndpointUsersWrite((prev) => ({ ...prev, [endpointId]: Boolean(endpoint.admin_ops_permissions?.users_write) }));
        setEndpointBucketsWrite((prev) => ({ ...prev, [endpointId]: Boolean(endpoint.admin_ops_permissions?.buckets_write) }));
        setEndpointPermissionErrors((prev) => ({ ...prev, [endpointId]: null }));
      } catch (err) {
        setEndpointUsersWrite((prev) => ({ ...prev, [endpointId]: false }));
        setEndpointBucketsWrite((prev) => ({ ...prev, [endpointId]: false }));
        setEndpointPermissionErrors((prev) => ({ ...prev, [endpointId]: extractError(err) }));
      } finally {
        setEndpointPermissionLoading((prev) => ({ ...prev, [endpointId]: false }));
      }
    },
    [endpointPermissionLoading, extractError]
  );

  const portalUserOptions = useMemo(() => portalUsers.map((u) => ({ id: u.id, label: u.email })), [portalUsers]);
  const portalUserLabelById = useMemo(() => {
    const map = new Map<number, string>();
    portalUsers.forEach((u) => map.set(u.id, u.email));
    return map;
  }, [portalUsers]);
  const groupLabelById = useMemo(() => {
    const map = new Map<number, string>();
    uiGroups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [uiGroups]);
  const renderUserAssociations = (user: S3User) => {
    const userItems: AssociationPrincipalItem[] = (user.user_links ?? []).map((link) => {
      return {
        id: link.user_id,
        kind: "user",
        label: link.user_full_name || link.user_email || t({
          en: `User #${link.user_id}`,
          fr: `Utilisateur n° ${link.user_id}`,
          de: `Benutzer #${link.user_id}`,
          zh: `用户 #${link.user_id}`,
        }),
        email: link.user_email,
        avatar: link.user_avatar,
      };
    });
    const groupItems: AssociationPrincipalItem[] = (user.group_links ?? []).map((link) => ({
      id: link.group_id,
      kind: "group" as const,
      label: link.group_name || t({
        en: `Group #${link.group_id}`,
        fr: `Groupe n° ${link.group_id}`,
        de: `Gruppe #${link.group_id}`,
        zh: `用户组 #${link.group_id}`,
      }),
      avatar: link.group_avatar,
    }));
    return <AssociationPrincipalStack items={[...userItems, ...groupItems]} />;
  };
  const availablePortalUsers = useMemo(() => {
    const query = portalUserSearch.trim().toLowerCase();
    return portalUserOptions.filter(
      (opt) => !editForm.user_links.some((link) => link.user_id === opt.id) && (!query || opt.label.toLowerCase().includes(query))
    );
  }, [portalUserOptions, editForm.user_links, portalUserSearch]);
  const availableGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return uiGroups.filter(
      (group) => !editForm.group_links.some((link) => link.group_id === group.id) && (!query || group.name.toLowerCase().includes(query))
    );
  }, [editForm.group_links, groupSearch, uiGroups]);
  const visiblePortalUsers = useMemo(
    () => availablePortalUsers.slice(0, MAX_LINK_OPTIONS),
    [availablePortalUsers]
  );
  const visibleGroups = useMemo(
    () => availableGroups.slice(0, MAX_LINK_OPTIONS),
    [availableGroups]
  );
  const cephEndpoints = useMemo(() => storageEndpoints.filter((ep) => ep.provider === "ceph"), [storageEndpoints]);
  const adminCephEndpoints = useMemo(
    () => cephEndpoints.filter((ep) => Boolean(ep.capabilities?.admin)),
    [cephEndpoints]
  );
  const editingEndpointId = editingUser?.storage_endpoint_id ?? null;
  const allowUserQuotaUpdates = editingEndpointId ? endpointUsersWrite[editingEndpointId] === true : false;
  const editingEndpointCanWriteBuckets = editingEndpointId ? endpointBucketsWrite[editingEndpointId] === true : false;

  useEffect(() => {
    const defaultCeph =
      adminCephEndpoints.find((ep) => ep.is_default) || adminCephEndpoints[0];
    const firstCephId = defaultCeph ? String(defaultCeph.id) : "";
    setCreateForm((prev) => ({
      ...prev,
      storage_endpoint_id: adminCephEndpoints.some((endpoint) => String(endpoint.id) === prev.storage_endpoint_id)
        ? prev.storage_endpoint_id
        : firstCephId,
    }));
    setImportEndpointId((prev) =>
      adminCephEndpoints.some((endpoint) => String(endpoint.id) === prev) ? prev : firstCephId
    );
  }, [adminCephEndpoints]);

  useEffect(() => {
    if (!showCreateModal) return;
    if (!createForm.storage_endpoint_id) return;
    const endpointId = Number(createForm.storage_endpoint_id);
    if (!Number.isFinite(endpointId) || endpointId <= 0) return;
    if (Object.prototype.hasOwnProperty.call(endpointUsersWrite, endpointId)) return;
    void fetchEndpointUsersWritePermission(endpointId);
  }, [showCreateModal, createForm.storage_endpoint_id, endpointUsersWrite, fetchEndpointUsersWritePermission]);

  useEffect(() => {
    if (!showImportModal) return;
    if (!importEndpointId) return;
    const endpointId = Number(importEndpointId);
    if (!Number.isFinite(endpointId) || endpointId <= 0) return;
    if (Object.prototype.hasOwnProperty.call(endpointUsersWrite, endpointId)) return;
    void fetchEndpointUsersWritePermission(endpointId);
  }, [showImportModal, importEndpointId, endpointUsersWrite, fetchEndpointUsersWritePermission]);

  useEffect(() => {
    if (!editingEndpointId) return;
    if (Object.prototype.hasOwnProperty.call(endpointUsersWrite, editingEndpointId)) return;
    void fetchEndpointUsersWritePermission(editingEndpointId);
  }, [editingEndpointId, endpointUsersWrite, fetchEndpointUsersWritePermission]);

  const toggleEditPortalUserSelection = (userId: number) => {
    setEditPortalUserSelections((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };
  const toggleEditGroupSelection = (groupId: number) => {
    setEditGroupSelections((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const loadEditQuota = async (userId: number) => {
    try {
      const detail = await getS3User(userId, { include_quota: true });
      setEditingUser((prev) => (prev && prev.id === userId ? { ...prev, ...detail } : prev));
      setEditForm((prev) => {
        if (prev.quota_max_size_gb !== "" || prev.quota_max_objects !== "") {
          return prev;
        }
        const quota = buildAdminQuotaSizeEditorValue(detail.quota_max_size_gb);
        return {
          ...prev,
          quota_max_size_gb: quota.value,
          quota_max_size_unit: quota.unit,
          quota_max_objects: detail.quota_max_objects != null ? String(detail.quota_max_objects) : "",
        };
      });
    } catch {
      // Quota is optional for editing; ignore load failures.
    }
  };

  const openEditModal = (user: S3User) => {
    void loadPortalUsersIfNeeded();
    void loadGroupsIfNeeded();
    void loadEndpointsIfNeeded();
    const quota = buildAdminQuotaSizeEditorValue(user.quota_max_size_gb);
    const nextEditForm = {
      name: user.name,
      email: user.email ?? "",
      tags: normalizeUiTags(user.tags),
      user_links: (user.user_links ?? []).map((link) => ({
        ...link,
        allow_manager_browser_data_access: Boolean(link.allow_manager_browser_data_access),
      })),
      group_links: (user.group_links ?? []).map((link) => ({
        ...link,
        allow_manager_browser_data_access: Boolean(link.allow_manager_browser_data_access),
      })),
      quota_max_size_gb: quota.value,
      quota_max_size_unit: quota.unit,
      quota_max_objects: user.quota_max_objects != null ? String(user.quota_max_objects) : "",
      allow_bucket_quota_management: Boolean(user.allow_bucket_quota_management),
      allow_access_key_management: Boolean(user.allow_access_key_management),
      allow_managed_private_connection_provisioning: Boolean(
        user.allow_managed_private_connection_provisioning
      ),
    };
    setEditingUser(user);
    setEditForm(nextEditForm);
    setEditInitialSignature(stableSignature({ editForm: { ...nextEditForm, tags: normalizeUiTags(nextEditForm.tags) } }));
    setEditError(null);
    setEditTab("general");
    setPortalUserSearch("");
    setGroupSearch("");
    setShowEditPortalUserPanel(false);
    setShowEditGroupPanel(false);
    setEditPortalUserSelections([]);
    setEditGroupSelections([]);
    if (user.quota_max_size_gb == null && user.quota_max_objects == null) {
      void loadEditQuota(user.id);
    }
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const payload: UpdateS3UserPayload = {
        name: editForm.name || undefined,
        email: editForm.email || undefined,
        tags: normalizeUiTags(editForm.tags),
        user_links: editForm.user_links,
        group_links: editForm.group_links,
      };
      if (canManagePrivilegedTargets) {
        payload.allow_bucket_quota_management = editForm.allow_bucket_quota_management;
        payload.allow_access_key_management = editForm.allow_access_key_management;
        payload.allow_managed_private_connection_provisioning =
          editForm.allow_managed_private_connection_provisioning;
      }
      if (allowUserQuotaUpdates) {
        payload.quota_max_size_gb = editForm.quota_max_size_gb !== "" ? Number(editForm.quota_max_size_gb) : null;
        payload.quota_max_size_unit = editForm.quota_max_size_gb !== "" ? editForm.quota_max_size_unit : null;
        payload.quota_max_objects = editForm.quota_max_objects !== "" ? Number(editForm.quota_max_objects) : null;
      }
      await updateS3User(editingUser.id, payload);
      await fetchUsers();
      closeEditModal();
      setActionMessage(t({
        en: "User updated.",
        fr: "Utilisateur mis à jour.",
        de: "Benutzer aktualisiert.",
        zh: "用户已更新。",
      }));
    } catch (err) {
      setEditError(extractError(err));
    } finally {
      setEditBusy(false);
    }
  };

  const createValidation = useAdminRgwFormValidation(createForm, rgwCreateErrors(createForm, locale));
  const importEntries = rgwImportEntries(importText, "user", locale);
  const importValidation = useAdminRgwFormValidation({importText, storage_endpoint_id: importEndpointId}, {
    ...(importEntries.error ? {importText: importEntries.error} : {}),
    ...(!importEndpointId ? {storage_endpoint_id: t(adminRgwSelectACephEndpoint)} : {}),
  });
  const createPending = useRef(false);
  const importPending = useRef(false);

  const submitCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createPending.current || !createValidation.validate(e.currentTarget)) return;
    if (createPermissionLoading) {
      setCreateError(t({
        en: "Checking endpoint permissions. Please wait.",
        fr: "Vérification des autorisations du point de terminaison. Patientez.",
        de: "Endpunktberechtigungen werden geprüft. Bitte warten.",
        zh: "正在检查端点权限，请稍候。",
      }));
      return;
    }
    if (!createEndpointCanWrite) {
      setCreateError(t({
        en: "Selected endpoint does not allow this operation (missing users=write).",
        fr: "Le point de terminaison sélectionné n’autorise pas cette opération (users=write manquant).",
        de: "Der ausgewählte Endpunkt erlaubt diese Aktion nicht (users=write fehlt).",
        zh: "所选端点不允许此操作（缺少 users=write）。",
      }));
      return;
    }
    createPending.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      await createS3User({
        name: createForm.name.trim(),
        uid: createForm.uid.trim() || undefined,
        email: createForm.email.trim() || undefined,
        tags: normalizeUiTags(createForm.tags),
        quota_max_size_gb: createForm.quota_max_size_gb ? Number(createForm.quota_max_size_gb) : undefined,
        quota_max_size_unit: createForm.quota_max_size_gb ? createForm.quota_max_size_unit : undefined,
        quota_max_objects: createForm.quota_max_objects ? Number(createForm.quota_max_objects) : undefined,
        storage_endpoint_id: Number(createForm.storage_endpoint_id),
      });
      setShowCreateModal(false);
      setCreateForm((prev) => ({
        ...prev,
        name: "",
        uid: "",
        email: "",
        tags: [],
        quota_max_size_gb: "",
        quota_max_objects: "",
      }));
      setActionMessage(t({
        en: "User created.",
        fr: "Utilisateur créé.",
        de: "Benutzer erstellt.",
        zh: "用户已创建。",
      }));
      await fetchUsers();
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      createPending.current = false;
      setCreating(false);
    }
  };

  const submitImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (importPending.current || !importValidation.validate(event.currentTarget)) return;
    if (importPermissionLoading || !importEndpointCanWrite) return;
    importPending.current = true;
    setImportBusy(true);
    setImportError(null);
    setImportMessage(null);
    try {
      await importS3Users(importEntries.entries.map(identifier => ({
        uid: identifier,
        storage_endpoint_id: Number(importEndpointId),
      })));
      setImportMessage(t({
        en: "Users imported.",
        fr: "Utilisateurs importés.",
        de: "Benutzer importiert.",
        zh: "用户已导入。",
      }));
      importValidation.reset();
      setImportText("");
      setImportInitialSignature(stableSignature({ importText: "", importEndpointId }));
      await fetchUsers();
    } catch (err) {
      setImportError(extractError(err));
    } finally {
      importPending.current = false;
      setImportBusy(false);
    }
  };

  const startDeleteUser = async (user: S3User) => {
    setDeleteModalError(null);
    setActionMessage(null);
    try {
      const detail = await getS3UserWithBuckets(user.id);
      setUserToDelete(detail);
      setDeleteFromRgw(false);
    } catch (err) {
      setUserToDelete(user);
      setDeleteFromRgw(false);
      setDeleteModalError(extractError(err));
    }
  };

  const closeDeleteModal = () => {
    if (deleteModalBusy) {
      return;
    }
    setUserToDelete(null);
    setDeleteFromRgw(false);
    setDeleteModalError(null);
  };

  const deleteModalBusy = userToDelete ? deleteBusyId === userToDelete.id : false;
  const selectedCreateEndpointId = createForm.storage_endpoint_id ? Number(createForm.storage_endpoint_id) : null;
  const selectedImportEndpointId = importEndpointId ? Number(importEndpointId) : null;
  const createPermissionLoading = selectedCreateEndpointId ? Boolean(endpointPermissionLoading[selectedCreateEndpointId]) : false;
  const importPermissionLoading = selectedImportEndpointId ? Boolean(endpointPermissionLoading[selectedImportEndpointId]) : false;
  const createEndpointCanWrite = selectedCreateEndpointId ? endpointUsersWrite[selectedCreateEndpointId] === true : false;
  const importEndpointCanWrite = selectedImportEndpointId ? endpointUsersWrite[selectedImportEndpointId] === true : false;
  const createPermissionError = selectedCreateEndpointId ? endpointPermissionErrors[selectedCreateEndpointId] ?? null : null;
  const importPermissionError = selectedImportEndpointId ? endpointPermissionErrors[selectedImportEndpointId] ?? null : null;
  const createCurrentSignature = useMemo(
    () => stableSignature({ createForm: { ...createForm, tags: normalizeUiTags(createForm.tags) } }),
    [createForm]
  );
  const createCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: Boolean(createInitialSignature) && createCurrentSignature !== createInitialSignature,
    disabled: creating,
    onClose: () => setShowCreateModal(false),
  });
  const importCurrentSignature = useMemo(
    () => stableSignature({ importText, importEndpointId }),
    [importEndpointId, importText]
  );
  const importCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: Boolean(importInitialSignature) && importCurrentSignature !== importInitialSignature,
    disabled: importBusy,
    onClose: () => setShowImportModal(false),
  });
  const closeEditModal = () => {
    setEditingUser(null);
    setEditTab("general");
    setPortalUserSearch("");
    setGroupSearch("");
    setShowEditPortalUserPanel(false);
    setShowEditGroupPanel(false);
    setEditPortalUserSelections([]);
    setEditGroupSelections([]);
    setEditInitialSignature("");
  };
  const editCurrentSignature = useMemo(
    () => stableSignature({ editForm: { ...editForm, tags: normalizeUiTags(editForm.tags) } }),
    [editForm]
  );
  const editCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: Boolean(editingUser && editInitialSignature && editCurrentSignature !== editInitialSignature),
    disabled: editBusy,
    onClose: closeEditModal,
  });
  const userTableColumns: Array<DataTableColumn<S3User, SortField>> = [
    {
      id: "name",
      label: t(messageName),
      field: "name",
      primary: true,
      cellClassName: "min-w-[240px] max-w-[360px]",
      render: (user) => {
        const tagItems = buildUiTagItems(user.tags);
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 flex-1 truncate">{user.name}</span>
            {tagItems.length > 0 && (
              <UiTagBadgeList
                items={tagItems}
                variant="listing-compact"
                layout="inline-compact"
                className="ml-auto max-w-full"
                maxVisible={4}
              />
            )}
          </div>
        );
      },
    },
    {
      id: "uid",
      label: "UID",
      field: "uid",
      cellClassName: "min-w-[176px]",
      render: (user) => user.rgw_user_uid,
    },
    {
      id: "endpoint",
      label: t(adminRgwEndpoint),
      cellClassName: "min-w-[160px]",
      render: (user) => (
        <span title={user.storage_endpoint_url || undefined}>
          {user.storage_endpoint_name}
        </span>
      ),
    },
    {
      id: "associations",
      label: t({
        en: "UI Users / Groups",
        fr: "Utilisateurs / groupes de l’interface",
        de: "UI-Benutzer / -Gruppen",
        zh: "界面用户 / 用户组",
      }),
      cellClassName: "min-w-[180px] max-w-[240px] align-middle",
      render: renderUserAssociations,
    },
    {
      id: "actions",
      label: t(adminRgwActions),
      align: "right",
      mobileRole: "actions",
      cellClassName: "min-w-[176px]",
      render: (user) => {
        const deleteBusy = deleteBusyId === user.id;
        return (
          <ListActions>
            <ListActionButton
              type="button"
              onClick={() => openEditModal(user)}

              {...dataTableDefaultActionProps}
            >
              {t(adminRgwEdit)}</ListActionButton>
            <ListActionLink to={`/admin/s3-users/${user.id}/keys`}>
              {t(adminRgwKeys)}</ListActionLink>
            <ListActionButton type="button" onClick={() => startDeleteUser(user)}  variant="danger" disabled={deleteBusy}>
              {deleteBusy ? t(adminRgwDeleting) : t(adminRgwDelete)}
            </ListActionButton>
          </ListActions>
        );
      },
    },
  ];
  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: users.length,
  });

  const confirmDeleteUser = async () => {
    if (!userToDelete || deleteModalBusy) return;
    setDeleteBusyId(userToDelete.id);
    setDeleteModalError(null);
    setActionMessage(null);
    try {
      await deleteS3User(userToDelete.id, { deleteRgw: deleteFromRgw });
      await fetchUsers();
      setActionMessage(t({
        en: `Deleted ${userToDelete.name}.`,
        fr: `${userToDelete.name} supprimé.`,
        de: `${userToDelete.name} gelöscht.`,
        zh: `已删除 ${userToDelete.name}。`,
      }));
      setUserToDelete(null);
      setDeleteFromRgw(false);
    } catch (err) {
      setDeleteModalError(extractError(err));
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <div className={workflowPageHostClass(showImportModal || Boolean(editingUser))}>
      <PageHeader actionPresentation="listing"
        title={t(adminRgwRGWUsers)}
        description={t({
          en: "Manage standalone RGW users for direct access to Manager.",
          fr: "Gérez les utilisateurs RGW autonomes pour un accès direct au gestionnaire.",
          de: "Eigenständige RGW-Benutzer für den direkten Zugriff auf die Verwaltung verwalten.",
          zh: "管理可直接访问管理控制台的独立 RGW 用户。",
        })}
        breadcrumbs={rgwBreadcrumbs()}
        actions={[
          {
            label: t(adminRgwImport),
            onClick: () => {
              importValidation.reset();
              setImportError(null);
              setImportMessage(null);
              setImportInitialSignature(stableSignature({ importText, importEndpointId }));
              setShowImportModal(true);
              void loadEndpointsIfNeeded();
            },
            variant: "ghost",
          },
          {
            label: t(adminRgwCreateUser),
            onClick: () => {
              createValidation.reset();
              setCreateError(null);
              setCreateInitialSignature(stableSignature({ createForm: { ...createForm, tags: normalizeUiTags(createForm.tags) } }));
              setShowCreateModal(true);
              void loadEndpointsIfNeeded();
            },
          },
        ]}
      />

      {error && <PageBanner tone="error">{error}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{actionMessage}</PageBanner>}

      <ListPageSection
        variant="page"
        mobileSort={<TableSortControls columns={userTableColumns} sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }} />}
          title={t(adminRgwRGWUsers)}
          countLabel={t({
            en: `${totalUsers} entr${totalUsers === 1 ? "y" : "ies"}`,
            fr: `${totalUsers} entrée${totalUsers === 1 ? "" : "s"}`,
            de: `${totalUsers} Eintr${totalUsers === 1 ? "ag" : "äge"}`,
            zh: `${totalUsers} 条记录`,
          })}
          search={
            <ToolbarSearchInput
              value={filter}
              onChange={handleFilterChange}
              placeholder={t({
                en: "Search by name, UID, email, group, or tag",
                fr: "Rechercher par nom, UID, e-mail, groupe ou étiquette",
                de: "Nach Name, UID, E-Mail, Gruppe oder Tag suchen",
                zh: "按名称、UID、邮箱、用户组或标签搜索",
              })}
              className="w-full sm:w-64"
              active={quickFilterActive}
              matchMode={quickFilterMode}
              onToggleMatchMode={toggleQuickFilterMode}
            />
          }
          secondaryContent={
            quickFilterActive ? (
              <ActiveFiltersBar
                label={t({
                  en: "Active filters summary",
                  fr: "Résumé des filtres actifs",
                  de: "Übersicht aktiver Filter",
                  zh: "当前筛选条件",
                })}
                items={[
                  {
                    id: "search",
                    label: t({
                      en: `Search ${quickFilterMode === "exact" ? "exact" : "contains"}: ${filter.trim()}`,
                      fr: `Recherche ${quickFilterMode === "exact" ? "exacte" : "partielle"} : ${filter.trim()}`,
                      de: `Suche (${quickFilterMode === "exact" ? "exakt" : "enthält"}): ${filter.trim()}`,
                      zh: `${quickFilterMode === "exact" ? "精确" : "包含"}搜索：${filter.trim()}`,
                    }),
                  },
                ]}
                onClearAll={clearAllFilters}
              />
            ) : null
          }
      >
        <DataTableShell
          columns={userTableColumns}
          rows={users}
          rowKey={(user) => user.id}
          status={tableStatus}
          loadingMessage={t({
            en: "Loading users...",
            fr: "Chargement des utilisateurs…",
            de: "Benutzer werden geladen…",
            zh: "正在加载用户…",
          })}
          errorMessage={t({
            en: "Unable to load users.",
            fr: "Impossible de charger les utilisateurs.",
            de: "Benutzer konnten nicht geladen werden.",
            zh: "无法加载用户。",
          })}
          emptyMessage={t({
            en: "No users.",
            fr: "Aucun utilisateur.",
            de: "Keine Benutzer.",
            zh: "暂无用户。",
          })}
          sort={{ field: sort.field, direction: sort.direction, onSort: toggleSort }}
          primaryColumnId="name"
          responsiveCards
          tableClassName="ui-data-table"
          pagination={{
            page,
            pageSize,
            total: totalUsers,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
            disabled: loading,
          }}
        />
      </ListPageSection>

      {showCreateModal && (
        <SettingsDialog title={t(adminRgwCreateUser)} onClose={createCloseGuard.requestClose} closeDisabled={creating} maxWidthClass="max-w-2xl">
          <SettingsForm label={t({
            en: "Create RGW user",
            fr: "Créer un utilisateur RGW",
            de: "RGW-Benutzer erstellen",
            zh: "创建 RGW 用户",
          })} presentation="dialog" busy={creating} onSubmit={submitCreate}
            submitDisabled={createPermissionLoading || !createEndpointCanWrite}
            onCancel={createCloseGuard.requestClose} submitLabel={t(adminRgwCreateUser)} busyLabel={t(adminRgwCreating)}>
            <AdminRgwCreateFields kind="user" value={createForm} onChange={patch => setCreateForm(current => ({...current, ...patch}))}
              errors={createValidation.errors} busy={creating}
              endpoint={{label: t(adminRgwCephEndpoint), endpoints: adminCephEndpoints, loading: loadingEndpoints,
                operation: "users", permissionLoading: createPermissionLoading, permissionError: createPermissionError, canWrite: createEndpointCanWrite}}
              tags={{catalog: adminTagCatalog, loading: adminTagCatalogLoading, error: adminTagCatalogError}} />
            {createError && <UiInlineMessage tone="error" role="alert">{createError}</UiInlineMessage>}
          </SettingsForm>
          {createCloseGuard.confirmationDialog}
        </SettingsDialog>
      )}

      {showImportModal && (
        <WorkflowPage title={t(adminRgwImportRGWUsers)} description={t({
          en: "Import existing standalone RGW users from a Ceph endpoint.",
          fr: "Importez des utilisateurs RGW autonomes existants depuis un point de terminaison Ceph.",
          de: "Vorhandene eigenständige RGW-Benutzer von einem Ceph-Endpunkt importieren.",
          zh: "从 Ceph 端点导入已有的独立 RGW 用户。",
        })} breadcrumbs={rgwBreadcrumbs({label: t(adminRgwImport)})} backLabel={t(adminRgwBackToRGWUsers)} backDisabled={importBusy} onBack={importCloseGuard.requestClose} contentVariant="plain" width="standard">
          <SettingsForm label={t(adminRgwImportRGWUsers)} busy={importBusy} onSubmit={submitImport}
            submitDisabled={importPermissionLoading || !importEndpointCanWrite}
            onCancel={importCloseGuard.requestClose} submitLabel={t(adminRgwImport)} busyLabel={t({
              en: "Importing...",
              fr: "Importation…",
              de: "Wird importiert…",
              zh: "正在导入…",
            })}>
            <div className="settings-fields settings-form">
              <p className="settings-body text-[var(--ui-text-muted)]">{t({
                en: "Enter RGW user IDs, one per line. The platform will fetch or generate keys.",
                fr: "Saisissez les identifiants des utilisateurs RGW, un par ligne. La plateforme récupérera ou générera les clés.",
                de: "Geben Sie eine RGW-Benutzer-ID pro Zeile ein. Die Plattform ruft Schlüssel ab oder erstellt sie.",
                zh: "输入 RGW 用户 ID，每行一个。平台将获取或生成密钥。",
              })}</p>
              <UiTextarea label={t({
                en: "RGW user IDs",
                fr: "Identifiants des utilisateurs RGW",
                de: "RGW-Benutzer-IDs",
                zh: "RGW 用户 ID",
              })} name="importText" rows={6} required value={importText}
                error={importValidation.errors.importText} placeholder="user-alpha"
                onChange={event => setImportText(event.target.value)} />
              <AdminRgwEndpointField label={t(adminRgwCephEndpoint)} value={importEndpointId}
                onChange={setImportEndpointId} endpoints={adminCephEndpoints}
                error={importValidation.errors.storage_endpoint_id} loading={loadingEndpoints} operation="users"
                permissionLoading={importPermissionLoading} permissionError={importPermissionError} canWrite={importEndpointCanWrite} />
              {importError && <UiInlineMessage tone="error" role="alert">{importError}</UiInlineMessage>}
              {importMessage && <UiInlineMessage tone="success" role="status">{importMessage}</UiInlineMessage>}
            </div>
          </SettingsForm>
          {importCloseGuard.confirmationDialog}
        </WorkflowPage>
      )}

      {editingUser && (
        <WorkflowPage
          title={t({
            en: `Edit ${editingUser.name}`,
            fr: `Modifier ${editingUser.name}`,
            de: `${editingUser.name} bearbeiten`,
            zh: `编辑 ${editingUser.name}`,
          })}
          description={t({
            en: "Manage quotas, UI associations, and privileged access for this RGW user.",
            fr: "Gérez les quotas, les associations à l’interface et les accès privilégiés de cet utilisateur RGW.",
            de: "Kontingente, UI-Zuordnungen und privilegierten Zugriff dieses RGW-Benutzers verwalten.",
            zh: "管理此 RGW 用户的配额、界面关联和特权访问。",
          })}
          breadcrumbs={rgwBreadcrumbs({ label: t(adminRgwEdit) })}
          backLabel={t(adminRgwBackToRGWUsers)}
          onBack={editCloseGuard.requestClose}
          contentVariant="plain"
          width="wide"
          metaContent={
            <WorkflowMetadata
              items={[
                {
                  label: "UID",
                  value: editingUser.rgw_user_uid,
                },
                {
                  label: t(adminRgwEndpoint),
                  value: editingUser.storage_endpoint_name,
                  title: editingUser.storage_endpoint_url,
                },
              ]}
            />
          }
        >
          {editError && (
            <UiInlineMessage tone="error" className="mb-3">
              {editError}
            </UiInlineMessage>
          )}
          <form onSubmit={submitEdit} className="space-y-4">
            <WorkflowTabs<EditTab>
              panelClassName={editTab === "users" || editTab === "groups" ? adminAssociationPanelClass : undefined}
              activeTab={editTab}
              onTabChange={(tab) => {
                if (tab === "users") {
                  void loadPortalUsersIfNeeded();
                }
                if (tab === "groups") {
                  void loadGroupsIfNeeded();
                }
                setEditTab(tab);
              }}
              ariaLabel={t({
                en: "RGW user configuration sections",
                fr: "Sections de configuration de l’utilisateur RGW",
                de: "Konfigurationsbereiche des RGW-Benutzers",
                zh: "RGW 用户配置分区",
              })}
              idPrefix="admin-rgw-user-edit"
              tabs={[
                { id: "general", label: t(messageGeneral) },
                { id: "users", label: t(adminRgwLinkedUIUsers) },
                { id: "groups", label: t(adminRgwLinkedUIGroups) },
                { id: "privileged", label: t({
                  en: "Privileged access",
                  fr: "Accès privilégié",
                  de: "Privilegierter Zugriff",
                  zh: "特权访问",
                }), visible: canManagePrivilegedTargets },
              ]}
            >

            {showEditGeneralTab && (
              <>
                <WorkflowSection
                  title={t(adminRgwUserDetails)}
                  description={t({
                    en: "Update the display information and administrative tags for this RGW user.",
                    fr: "Mettez à jour les informations affichées et les étiquettes administratives de cet utilisateur RGW.",
                    de: "Anzeigeinformationen und Verwaltungstags dieses RGW-Benutzers aktualisieren.",
                    zh: "更新此 RGW 用户的显示信息和管理标签。",
                  })}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <UiInput
                      label={t({
                        en: "Display name",
                        fr: "Nom affiché",
                        de: "Anzeigename",
                        zh: "显示名称",
                      })}
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <UiInput
                      label={t(adminRgwEmail)}
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                    <div className="md:col-span-2">
                      {adminTagCatalogError && <PageBanner tone="warning">{adminTagCatalogError}</PageBanner>}
                      <UiTagEditor
                        label={t(adminRgwTags)}
                        tags={editForm.tags}
                        catalog={adminTagCatalog}
                        onChange={(tags) => setEditForm((prev) => ({ ...prev, tags }))}
                        placeholder={t(adminRgwAddATagForThisRGWUser)}
                        hint={adminTagCatalogLoading ? t(adminRgwLoadingExistingTagCatalog) : undefined}
                      />
                    </div>
                  </div>
                </WorkflowSection>
                <StorageUsageCard
                  accountName={editingUser.name}
                  storage={{
                    used: editingUsageStats?.total_bytes ?? null,
                    quotaBytes:
                      editingUser.quota_max_size_gb != null ? editingUser.quota_max_size_gb * 1024 ** 3 : null,
                  }}
                  objects={{
                    used: editingUsageStats?.total_objects ?? null,
                    quota: editingUser.quota_max_objects ?? null,
                  }}
                  bucketOverview={editingUsageStats?.bucket_overview}
                  loading={editingUsageLoading}
                  metricsDisabled={false}
                  errorMessage={editingUsageError}
                />
                <AdminQuotaFields
                  storageValue={editForm.quota_max_size_gb}
                  storageUnit={editForm.quota_max_size_unit}
                  objectValue={editForm.quota_max_objects}
                  disabled={!allowUserQuotaUpdates}
                  onStorageValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, quota_max_size_gb: value }))
                  }
                  onStorageUnitChange={(value) =>
                    setEditForm((prev) => ({ ...prev, quota_max_size_unit: value }))
                  }
                  onObjectValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, quota_max_objects: value }))
                  }
                />
              </>
            )}

            {showEditUsersTab && (
              <div className="space-y-3">
                <AdminAssociationSectionHeader
                  title={t(adminRgwLinkedUIUsers)}
                  countLabel={t({
                    en: `${editForm.user_links.length} linked`,
                    fr: `${editForm.user_links.length} associé(s)`,
                    de: `${editForm.user_links.length} verknüpft`,
                    zh: `已关联 ${editForm.user_links.length} 个`,
                  })}
                  actionLabel={showEditPortalUserPanel ? t(adminRgwClose) : t(adminRgwAddUIUsers)}
                  onAction={() => setShowEditPortalUserPanel((prev) => !prev)}
                />
                <div className={associationTableContainerClass}>
                  <table className="ui-data-table">
                    <thead>
                      <tr>
                        <th className="text-left">
                          {t(adminRgwUser)}</th>
                        <th className="w-px whitespace-nowrap text-right">
                          {t(adminRgwActions)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editForm.user_links.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="ui-table-secondary">
                            {t({
                              en: "No linked users yet.",
                              fr: "Aucun utilisateur associé.",
                              de: "Noch keine verknüpften Benutzer.",
                              zh: "尚未关联用户。",
                            })}</td>
                        </tr>
                      ) : (
                        editForm.user_links.map((link) => (
                          <tr key={link.user_id}>
                            <td className="ui-table-primary">
                              {portalUserLabelById.get(link.user_id) ?? t({
                                en: `User #${link.user_id}`,
                                fr: `Utilisateur n° ${link.user_id}`,
                                de: `Benutzer #${link.user_id}`,
                                zh: `用户 #${link.user_id}`,
                              })}
                            </td>
                            <td className="ui-table-actions-cell w-px text-right">
                              <AdminAssociationAdvancedSettings
                                targetLabel={portalUserLabelById.get(link.user_id) ?? t({
                                  en: `User #${link.user_id}`,
                                  fr: `Utilisateur n° ${link.user_id}`,
                                  de: `Benutzer #${link.user_id}`,
                                  zh: `用户 #${link.user_id}`,
                                })}
                                associationKind="rgw_user"
                                allowManagerBrowserDataAccess={Boolean(link.allow_manager_browser_data_access)}
                                onApply={(allowed) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    user_links: prev.user_links.map((item) =>
                                      item.user_id === link.user_id
                                        ? { ...item, allow_manager_browser_data_access: allowed }
                                        : item
                                    ),
                                  }))
                                }
                              />
                              <ListActionButton
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    user_links: prev.user_links.filter((item) => item.user_id !== link.user_id),
                                  }))
                                }
                                 variant="danger"
                              >
                                {t(adminRgwRemove)}</ListActionButton>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {showEditPortalUserPanel && (
                  <AdminAssociationPickerPanel
                    title={t(adminRgwAddUIUsers)}
                    hint={t({
                      en: "(filter by email)",
                      fr: "(filtrer par e-mail)",
                      de: "(nach E-Mail filtern)",
                      zh: "（按邮箱筛选）",
                    })}
                    search={portalUserSearch}
                    onSearchChange={setPortalUserSearch}
                    searchAriaLabel={t({
                      en: "Search UI users",
                      fr: "Rechercher des utilisateurs de l’interface",
                      de: "UI-Benutzer suchen",
                      zh: "搜索界面用户",
                    })}
                    loading={false}
                    availableCount={availablePortalUsers.length}
                    maxVisibleOptions={MAX_LINK_OPTIONS}
                    selectedCount={editPortalUserSelections.length}
                    loadingLabel={t({
                      en: "Loading UI users...",
                      fr: "Chargement des utilisateurs de l’interface…",
                      de: "UI-Benutzer werden geladen…",
                      zh: "正在加载界面用户…",
                    })}
                    onCancel={() => {
                      setShowEditPortalUserPanel(false);
                      setEditPortalUserSelections([]);
                      setPortalUserSearch("");
                    }}
                    onAdd={() => {
                      if (editPortalUserSelections.length === 0) return;
                      setEditForm((prev) => ({
                        ...prev,
                        user_links: [
                          ...prev.user_links,
                          ...editPortalUserSelections.map((userId) => ({
                            user_id: userId,
                            allow_manager_browser_data_access: false,
                          })),
                        ],
                      }));
                      setEditPortalUserSelections([]);
                      setPortalUserSearch("");
                      setShowEditPortalUserPanel(false);
                    }}
                    addDisabled={editPortalUserSelections.length === 0}
                  >
                    <AdminAssociationCheckboxOptions
                      options={visiblePortalUsers}
                      selectedIds={editPortalUserSelections}
                      onToggle={toggleEditPortalUserSelection}
                      getLabel={(option) => option.label}
                    />
                  </AdminAssociationPickerPanel>
                )}
              </div>
            )}

            {showEditGroupsTab && (
              <div className="space-y-3">
                <AdminAssociationSectionHeader
                  title={t(adminRgwLinkedUIGroups)}
                  countLabel={t({
                    en: `${editForm.group_links.length} linked${uiGroupsLoading ? " · loading..." : ""}`,
                    fr: `${editForm.group_links.length} associé(s)${uiGroupsLoading ? " · chargement…" : ""}`,
                    de: `${editForm.group_links.length} verknüpft${uiGroupsLoading ? " · wird geladen…" : ""}`,
                    zh: `已关联 ${editForm.group_links.length} 个${uiGroupsLoading ? " · 正在加载…" : ""}`,
                  })}
                  actionLabel={showEditGroupPanel ? t(adminRgwClose) : t(adminRgwAddUIGroups)}
                  onAction={() => {
                    if (!showEditGroupPanel) {
                      void loadGroupsIfNeeded();
                    }
                    setShowEditGroupPanel((prev) => !prev);
                  }}
                />
                <div className={associationTableContainerClass}>
                  <table className="ui-data-table">
                    <thead>
                      <tr>
                        <th className="text-left">
                          {t({
                            en: "Group",
                            fr: "Groupe",
                            de: "Gruppe",
                            zh: "用户组",
                          })}</th>
                        <th className="w-px whitespace-nowrap text-right">
                          {t(adminRgwActions)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editForm.group_links.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="ui-table-secondary">
                            {t({
                              en: "No linked groups yet.",
                              fr: "Aucun groupe associé.",
                              de: "Noch keine verknüpften Gruppen.",
                              zh: "尚未关联用户组。",
                            })}</td>
                        </tr>
                      ) : (
                        editForm.group_links.map((link) => (
                          <tr key={link.group_id}>
                            <td className="ui-table-primary">
                              {groupLabelById.get(link.group_id) ?? t({
                                en: `Group #${link.group_id}`,
                                fr: `Groupe n° ${link.group_id}`,
                                de: `Gruppe #${link.group_id}`,
                                zh: `用户组 #${link.group_id}`,
                              })}
                            </td>
                            <td className="ui-table-actions-cell w-px text-right">
                              <AdminAssociationAdvancedSettings
                                targetLabel={groupLabelById.get(link.group_id) ?? t({
                                  en: `Group #${link.group_id}`,
                                  fr: `Groupe n° ${link.group_id}`,
                                  de: `Gruppe #${link.group_id}`,
                                  zh: `用户组 #${link.group_id}`,
                                })}
                                associationKind="rgw_user"
                                allowManagerBrowserDataAccess={Boolean(link.allow_manager_browser_data_access)}
                                onApply={(allowed) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    group_links: prev.group_links.map((item) =>
                                      item.group_id === link.group_id
                                        ? { ...item, allow_manager_browser_data_access: allowed }
                                        : item
                                    ),
                                  }))
                                }
                              />
                              <ListActionButton
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    group_links: prev.group_links.filter((item) => item.group_id !== link.group_id),
                                  }))
                                }
                                 variant="danger"
                              >
                                {t(adminRgwRemove)}</ListActionButton>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {showEditGroupPanel && (
                  <AdminAssociationPickerPanel
                    title={t(adminRgwAddUIGroups)}
                    hint={t({
                      en: "(filter by name)",
                      fr: "(filtrer par nom)",
                      de: "(nach Namen filtern)",
                      zh: "（按名称筛选）",
                    })}
                    search={groupSearch}
                    onSearchChange={setGroupSearch}
                    searchAriaLabel={t({
                      en: "Search UI groups",
                      fr: "Rechercher des groupes de l’interface",
                      de: "UI-Gruppen suchen",
                      zh: "搜索界面用户组",
                    })}
                    loading={uiGroupsLoading}
                    availableCount={availableGroups.length}
                    maxVisibleOptions={MAX_LINK_OPTIONS}
                    selectedCount={editGroupSelections.length}
                    loadingLabel={t({
                      en: "Loading UI groups...",
                      fr: "Chargement des groupes de l’interface…",
                      de: "UI-Gruppen werden geladen…",
                      zh: "正在加载界面用户组…",
                    })}
                    onCancel={() => {
                      setShowEditGroupPanel(false);
                      setEditGroupSelections([]);
                      setGroupSearch("");
                    }}
                    onAdd={() => {
                      if (editGroupSelections.length === 0) return;
                      setEditForm((prev) => ({
                        ...prev,
                        group_links: [
                          ...prev.group_links,
                          ...editGroupSelections.map((groupId) => ({
                            group_id: groupId,
                            allow_manager_browser_data_access: false,
                          })),
                        ],
                      }));
                      setEditGroupSelections([]);
                      setGroupSearch("");
                      setShowEditGroupPanel(false);
                    }}
                    addDisabled={editGroupSelections.length === 0}
                  >
                    <AdminAssociationCheckboxOptions
                      options={visibleGroups}
                      selectedIds={editGroupSelections}
                      onToggle={toggleEditGroupSelection}
                      getLabel={(group) => group.name}
                    />
                  </AdminAssociationPickerPanel>
                )}
              </div>
            )}

            {showEditPrivilegedTab && (
              <AdminAccessToggleSection
                title={t({
                  en: "Privileged Ceph access",
                  fr: "Accès Ceph privilégié",
                  de: "Privilegierter Ceph-Zugriff",
                  zh: "Ceph 特权访问",
                })}
                description={t({
                  en: "Ceph admin-API actions granted directly to this RGW user outside the Ceph Admin workspace.",
                  fr: "Actions de l’API d’administration Ceph accordées directement à cet utilisateur RGW en dehors de l’espace Ceph Admin.",
                  de: "Ceph-Admin-API-Aktionen, die diesem RGW-Benutzer außerhalb des Ceph-Admin-Arbeitsbereichs direkt gewährt werden.",
                  zh: "在 Ceph Admin 工作区之外，直接授予此 RGW 用户的 Ceph 管理 API 操作权限。",
                })}
                items={[
                  {
                    title: t(adminRgwBucketQuotaManagement),
                    description: editingEndpointCanWriteBuckets
                      ? t({
                        en: "Allow Ceph bucket quota updates for this RGW User in Manager.",
                        fr: "Autoriser cet utilisateur RGW à modifier les quotas de bucket Ceph dans le gestionnaire.",
                        de: "Diesem RGW-Benutzer das Aktualisieren von Ceph-Bucket-Kontingenten in der Verwaltung erlauben.",
                        zh: "允许此 RGW 用户在管理控制台中更新 Ceph 存储桶配额。",
                      })
                      : t({
                        en: "Requires buckets=write on the endpoint Admin Ops identity before this grant can be enabled.",
                        fr: "L’identité Admin Ops du point de terminaison doit disposer de buckets=write avant d’activer cette autorisation.",
                        de: "Die Admin-Ops-Identität des Endpunkts benötigt buckets=write, bevor diese Berechtigung aktiviert werden kann.",
                        zh: "启用此授权前，端点的 Admin Ops 身份必须具有 buckets=write 权限。",
                      }),
                    ariaLabel: t(adminRgwBucketQuotaManagement),
                    checked: editForm.allow_bucket_quota_management,
                    disabled: !editForm.allow_bucket_quota_management && !editingEndpointCanWriteBuckets,
                    onChange: (checked) =>
                      setEditForm((prev) => ({
                        ...prev,
                        allow_bucket_quota_management: checked,
                      })),
                  },
                  {
                    title: t(adminRgwCephS3UserKeys),
                    description: t({
                      en: "Allow access to Manager > Ceph > Access keys.",
                      fr: "Autoriser l’accès à Gestionnaire > Ceph > Clés d’accès.",
                      de: "Zugriff auf Verwaltung > Ceph > Zugriffsschlüssel erlauben.",
                      zh: "允许访问管理控制台 > Ceph > 访问密钥。",
                    }),
                    ariaLabel: t(adminRgwCephS3UserKeys),
                    checked: editForm.allow_access_key_management,
                    onChange: (checked) =>
                      setEditForm((prev) => ({
                        ...prev,
                        allow_access_key_management: checked,
                      })),
                  },
                  {
                    title: t(adminRgwManagedPrivateConnectionProvisioning),
                    description: t({
                      en: "Allow Manager to provision a dedicated private Browser connection for this RGW User.",
                      fr: "Autoriser le gestionnaire à créer une connexion privée dédiée à l’explorateur pour cet utilisateur RGW.",
                      de: "Der Verwaltung erlauben, eine dedizierte private Browser-Verbindung für diesen RGW-Benutzer bereitzustellen.",
                      zh: "允许管理控制台为此 RGW 用户配置专用的私有浏览器连接。",
                    }),
                    ariaLabel: t(adminRgwManagedPrivateConnectionProvisioning),
                    checked: editForm.allow_managed_private_connection_provisioning,
                    onChange: (checked) =>
                      setEditForm((prev) => ({
                        ...prev,
                        allow_managed_private_connection_provisioning: checked,
                      })),
                  },
                ]}
              />
            )}
            </WorkflowTabs>

            <WorkflowActions>
              <UiButton variant="secondary" onClick={editCloseGuard.requestClose}>
                {t(adminRgwCancel)}</UiButton>
              <UiButton
                type="submit"
                disabled={editBusy}
              >
                {editBusy ? t(adminRgwSaving) : t({
                  en: "Save changes",
                  fr: "Enregistrer les modifications",
                  de: "Änderungen speichern",
                  zh: "保存更改",
                })}
              </UiButton>
            </WorkflowActions>
            {editCloseGuard.confirmationDialog}
          </form>
        </WorkflowPage>
      )}

      {userToDelete && (
        <ConfirmActionDialog
          title={t({
            en: `Delete ${userToDelete.name}`,
            fr: `Supprimer ${userToDelete.name}`,
            de: `${userToDelete.name} löschen`,
            zh: `删除 ${userToDelete.name}`,
          })}
          description={t({
            en: "This removes the standalone RGW user from the UI and deletes the access key used by this interface. You can also delete the underlying RGW user once it no longer owns buckets.",
            fr: "Cette action retire l’utilisateur RGW autonome de l’interface et supprime la clé d’accès utilisée par celle-ci. Vous pouvez aussi supprimer l’utilisateur RGW sous-jacent lorsqu’il ne possède plus de buckets.",
            de: "Dadurch wird der eigenständige RGW-Benutzer aus der Oberfläche entfernt und deren Zugriffsschlüssel gelöscht. Der zugrunde liegende RGW-Benutzer kann ebenfalls gelöscht werden, sobald er keine Buckets mehr besitzt.",
            zh: "这会从界面中移除独立 RGW 用户，并删除本界面使用的访问密钥。该用户不再拥有存储桶后，也可以删除底层 RGW 用户。",
          })}
          confirmLabel={t({
            en: "Delete user",
            fr: "Supprimer l’utilisateur",
            de: "Benutzer löschen",
            zh: "删除用户",
          })}
          processingLabel={t(adminRgwDeleting)}
          loading={deleteModalBusy}
          error={deleteModalError}
          warningTone="warning"
          warning={deleteModalHasResources && (
            <div className="space-y-2">
              <p>{t({
                en: "This RGW user still has linked resources. Remove owned buckets before deleting it from RGW.",
                fr: "Cet utilisateur RGW possède encore des ressources associées. Supprimez ses buckets avant de le supprimer de RGW.",
                de: "Dieser RGW-Benutzer hat noch verknüpfte Ressourcen. Entfernen Sie seine Buckets, bevor Sie ihn aus RGW löschen.",
                zh: "此 RGW 用户仍有关联资源。从 RGW 中删除前，请先移除其拥有的存储桶。",
              })}</p>
              <p className="settings-label">{t({
                en: "Buckets:",
                fr: "Buckets :",
                de: "Buckets:",
                zh: "存储桶：",
              })}{" "}{userToDelete.bucket_count ?? t({
                en: "unknown",
                fr: "inconnu",
                de: "unbekannt",
                zh: "未知",
              })}</p>
            </div>
          )}
          options={
            <UiCheckboxField
              checked={deleteFromRgw}
              disabled={deleteModalBusy || deleteModalHasResources}
              onChange={(event) => setDeleteFromRgw(event.target.checked)}
            >
              <span className="modal-option-copy">
                {t({
                  en: "Also delete RGW user",
                  fr: "Supprimer également l’utilisateur RGW",
                  de: "RGW-Benutzer ebenfalls löschen",
                  zh: "同时删除 RGW 用户",
                })}{" "}<code className="break-all font-mono">{userToDelete.rgw_user_uid}</code>
              </span>
            </UiCheckboxField>
          }
          onCancel={closeDeleteModal}
          onConfirm={() => void confirmDeleteUser()}
        />
      )}

    </div>
  );
}
