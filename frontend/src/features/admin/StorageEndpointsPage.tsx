/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { translate, useI18n } from "../../i18n";
import type { UiLanguage } from "../../components/language";
import { infrastructureMessages } from "../../infrastructureMessages";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cx, uiCheckboxClass } from "../../components/ui/styles";
import {
  detectStorageEndpointFeatures,
  createStorageEndpoint,
  deleteStorageEndpoint,
  fetchStorageEndpointsMeta,
  listStorageEndpoints,
  setDefaultStorageEndpoint,
  updateStorageEndpoint,
  updateStorageEndpointTags,
  type StorageEndpoint,
  type StorageEndpointPayload,
  type StorageProvider,
} from "../../api/storageEndpoints";
import ConfirmActionDialog from "../../components/ConfirmActionDialog";
import WorkflowPage, { WorkflowActions, WorkflowSection } from "../../components/WorkflowPage";
import PageHeader from "../../components/PageHeader";
import PageTabs from "../../components/PageTabs";
import { localizedAdminPageBreadcrumbs as adminPageBreadcrumbs } from "./adminBreadcrumbs";
import PageBanner from "../../components/PageBanner";
import UiTagBadgeList from "../../components/UiTagBadgeList";
import UiTagEditor from "../../components/UiTagEditor";
import UiButton from "../../components/ui/UiButton";
import { ListActionButton } from "../../components/list/ListControls";
import UiInput from "../../components/ui/UiInput";
import UiSelect from "../../components/ui/UiSelect";
import { useTagCatalog } from "../../hooks/useTagCatalog";
import { useGeneralSettings } from "../../components/GeneralSettingsContext";
import { useUnsavedChangesGuard } from "../../components/useUnsavedChangesGuard";
import { extractApiError } from "../../utils/apiError";
import { stableSignature } from "../../utils/stableSignature";
import { buildUiTagItems, normalizeUiTags } from "../../utils/uiTags";
import { isSuperAdminRole, readStoredUser } from "../../utils/workspaces";
import {
  applyFeatureConstraints,
  awsCoordinatesForRegion,
  awsIamEndpointForRegion,
  awsS3EndpointForRegion,
  awsStsEndpointForRegion,
  AWS_DEFAULT_REGION,
  buildFeaturesYaml,
  createEmptyForm,
  createFormFromEndpoint,
  defaultFeaturesForProvider,
  EMPTY_STORAGE_ENDPOINT_FORM,
  normalizeAwsRegion,
  parseCoordinateInput,
  type FeaturesState,
  type FormState,
} from "./storageEndpointFormModel";

import StorageEndpointList, { type EndpointListFilters } from "./StorageEndpointList";

type EndpointEditorTab = "general" | "credentials" | "capabilities";
const endpointToggleCardClass =
  "flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 ui-caption font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const endpointToggleCardDisabledClass = cx(endpointToggleCardClass, "opacity-70");
const endpointToggleCheckboxClass = cx(uiCheckboxClass, "disabled:cursor-not-allowed disabled:opacity-50");
const endpointReadOnlyInputClass =
  "read-only:bg-slate-100 read-only:text-slate-600 dark:read-only:bg-slate-900 dark:read-only:text-slate-300";
const ADMIN_OPS_COMMAND = [
  "radosgw-admin user create \\",
  '  --uid="bkr-admin" \\',
  '  --display-name="BucketReef Admin Ops" \\',
  '  --caps="users=read,write;accounts=read,write;buckets=write"',
].join("\n");

const SUPERVISION_OPS_COMMAND = [
  "radosgw-admin user create \\",
  '  --uid="bkr-supervision" \\',
  '  --display-name="BucketReef Supervision Ops" \\',
  '  --caps="usage=read;buckets=read"',
].join("\n");
const CEPH_ADMIN_COMMAND = [
  "radosgw-admin user create \\",
  '  --uid="bkr-ceph-admin" \\',
  '  --display-name="BucketReef Ceph Admin" \\',
  '  --admin',
].join("\n");

function extractError(err: unknown, locale: UiLanguage = "en"): string {
  return extractApiError(err, translate(infrastructureMessages.anErrorOccurred, locale));
}

function isMethodNotAllowedError(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("405") || normalized.includes("methodnotallowed") || normalized.includes("method not allowed");
}

function StoredSecretStatus({ label, stored }: { label: string; stored: boolean }) {
  const { locale } = useI18n();
  return (
    <div className="space-y-1">
      <p className="ui-caption font-semibold text-[var(--ui-text-muted)]">{label}</p>
      <div className="min-h-10 rounded-lg border border-[color:var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 ui-body text-[var(--ui-text)]">
        {stored ? translate(infrastructureMessages.storedValueHidden, locale) : translate(infrastructureMessages.notConfigured, locale)}
      </div>
    </div>
  );
}

export default function StorageEndpointsPage() {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { endpointId: endpointIdParam } = useParams();
  const { generalSettings } = useGeneralSettings();
  const currentUser = useMemo(() => readStoredUser(), []);
  const canEditEndpoints = isSuperAdminRole(currentUser?.role);
  const [endpoints, setEndpoints] = useState<StorageEndpoint[]>([]);
  const [envManaged, setEnvManaged] = useState(false);
  const [metadataReady, setMetadataReady] = useState(false);
  const mutationPending = useRef(false);
  const closingForm = useRef(false);
  const [listFilters, setListFilters] = useState<EndpointListFilters>({ query: "", mode: "contains", provider: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<EndpointEditorTab>("general");
  const [form, setForm] = useState<FormState>(EMPTY_STORAGE_ENDPOINT_FORM);
  const [formInitialSignature, setFormInitialSignature] = useState("");
  const [showOpsHelp, setShowOpsHelp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [defaultBusyId, setDefaultBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorageEndpoint | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [featureDetectBusy, setFeatureDetectBusy] = useState(false);
  const [featureDetectError, setFeatureDetectError] = useState<string | null>(null);
  const [featureDetectWarnings, setFeatureDetectWarnings] = useState<string[]>([]);
  const {
    catalog: endpointTagCatalog,
    loading: endpointTagCatalogLoading,
    error: endpointTagCatalogError,
  } = useTagCatalog({ kind: "admin", domain: "endpoint" }, Boolean(showForm && canEditEndpoints));

  const resetForm = useCallback(() => {
    setForm(createEmptyForm());
    setActiveTab("general");
    setFormInitialSignature("");
    setShowOpsHelp(false);
    setFormError(null);
    setFeatureDetectBusy(false);
    setFeatureDetectError(null);
    setFeatureDetectWarnings([]);
    setEditingId(null);
  }, []);

  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMetadataReady(false);
    const [data, meta] = await Promise.allSettled([listStorageEndpoints(), fetchStorageEndpointsMeta()]);
    if (data.status === "fulfilled") setEndpoints(data.value);
    if (meta.status === "fulfilled") {
      setEnvManaged(Boolean(meta.value.managed_by_env));
      setMetadataReady(true);
    }
    if (data.status === "rejected") setError(extractError(data.reason, locale));
    else if (meta.status === "rejected") setError(translate({ en: `Unable to load endpoint management mode. Changes are disabled. ${extractError(meta.reason, locale)}`, zh: `无法加载端点管理模式，已禁用修改。${extractError(meta.reason, locale)}` }, locale));
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  const cephMode = useMemo(() => form.provider === "ceph", [form.provider]);
  const cephAdminConfigEnabled = Boolean(generalSettings.ceph_admin_enabled);
  const editingEndpoint = useMemo(
    () => (editingId == null ? null : endpoints.find((endpoint) => endpoint.id === editingId) ?? null),
    [editingId, endpoints]
  );
  const routeEndpointId = Number(endpointIdParam ?? "");
  const hasEndpointRoute = endpointIdParam !== undefined;
  const hasValidEndpointRoute = Number.isFinite(routeEndpointId) && routeEndpointId > 0;
  const routeEndpointMissing = Boolean(
    hasEndpointRoute && !loading && (!hasValidEndpointRoute || !endpoints.some((endpoint) => endpoint.id === routeEndpointId))
  );
  const routeEndpointLoading = hasEndpointRoute && !routeEndpointMissing && !showForm;
  const configurationReadOnly = Boolean(
    editingId != null && (!metadataReady || envManaged || editingEndpoint?.is_editable === false || !canEditEndpoints)
  );
  useEffect(() => {
    if (!showForm || !cephMode || !canEditEndpoints || configurationReadOnly) {
      setFeatureDetectBusy(false);
      setFeatureDetectError(null);
      setFeatureDetectWarnings([]);
      return;
    }
    const endpointUrl = form.endpoint_url.trim();
    const adminEndpointOverride = form.features.admin.endpoint.trim();
    const adminAccessKey = form.admin_access_key.trim();
    const adminSecretKey = form.admin_secret_key.trim();
    const supervisionAccessKey = form.supervision_access_key.trim();
    const supervisionSecretKey = form.supervision_secret_key.trim();
    const hasAdminCredentials = Boolean(adminAccessKey && (adminSecretKey || form.has_admin_secret));
    const hasSupervisionCredentials = Boolean(
      supervisionAccessKey && (supervisionSecretKey || form.has_supervision_secret)
    );

    if (!endpointUrl || (!hasAdminCredentials && !hasSupervisionCredentials)) {
      setFeatureDetectBusy(false);
      setFeatureDetectError(null);
      setFeatureDetectWarnings([]);
      setForm((prev) => {
        if (prev.provider !== "ceph") return prev;
        const next = applyFeatureConstraints(
          {
            ...prev.features,
            admin: { ...prev.features.admin, enabled: false },
            account: { ...prev.features.account, enabled: false },
            usage: { ...prev.features.usage, enabled: false },
            metrics: { ...prev.features.metrics, enabled: false },
          },
          prev.provider
        );
        if (
          next.admin.enabled === prev.features.admin.enabled &&
          next.account.enabled === prev.features.account.enabled &&
          next.usage.enabled === prev.features.usage.enabled &&
          next.metrics.enabled === prev.features.metrics.enabled
        ) {
          return prev;
        }
        return { ...prev, features: next };
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFeatureDetectBusy(true);
      setFeatureDetectError(null);
      try {
        const detection = await detectStorageEndpointFeatures({
          endpoint_id: editingId,
          endpoint_url: endpointUrl,
          admin_endpoint: adminEndpointOverride || null,
          region: form.region.trim() || null,
          verify_tls: form.verify_tls,
          admin_access_key: adminAccessKey || null,
          admin_secret_key: adminSecretKey || null,
          supervision_access_key: supervisionAccessKey || null,
          supervision_secret_key: supervisionSecretKey || null,
        });
        if (cancelled) return;
        const warnings: string[] = [];
        if (Array.isArray(detection.warnings)) {
          warnings.push(...detection.warnings.filter((item) => typeof item === "string" && item.trim()));
        }
        const errorParts: string[] = [];
        if (hasAdminCredentials && !detection.admin && detection.admin_error) {
          errorParts.push(`${translate(infrastructureMessages.administration, locale)}: ${detection.admin_error}`);
        }
        if (hasAdminCredentials && !detection.account && detection.account_error) {
          if (isMethodNotAllowedError(detection.account_error)) {
            warnings.push(translate(infrastructureMessages.accountAPIIsNotAvailableOnThisEndpointOptionalCapability, locale));
          } else {
            errorParts.push(`${translate(infrastructureMessages.accountAPI, locale)}: ${detection.account_error}`);
          }
        }
        if (hasSupervisionCredentials && !detection.metrics && detection.metrics_error) {
          errorParts.push(`${translate(infrastructureMessages.metrics, locale)}: ${detection.metrics_error}`);
        }
        if (hasSupervisionCredentials && !detection.usage && detection.usage_error) {
          errorParts.push(`${translate(infrastructureMessages.usageLog, locale)}: ${detection.usage_error}`);
        }
        setFeatureDetectWarnings(warnings);
        setFeatureDetectError(errorParts.length > 0 ? errorParts.join(" | ") : null);
        setForm((prev) => {
          if (prev.provider !== "ceph") return prev;
          const next = applyFeatureConstraints(
            {
              ...prev.features,
              admin: { ...prev.features.admin, enabled: Boolean(detection.admin) },
              account: { ...prev.features.account, enabled: Boolean(detection.account) },
              usage: { ...prev.features.usage, enabled: Boolean(detection.usage) },
              metrics: { ...prev.features.metrics, enabled: Boolean(detection.metrics) },
            },
            prev.provider
          );
          if (
            next.admin.enabled === prev.features.admin.enabled &&
            next.account.enabled === prev.features.account.enabled &&
            next.usage.enabled === prev.features.usage.enabled &&
            next.metrics.enabled === prev.features.metrics.enabled
          ) {
            return prev;
          }
          return { ...prev, features: next };
        });
      } catch (err) {
        if (!cancelled) {
          setFeatureDetectWarnings([]);
          setFeatureDetectError(extractError(err, locale));
        }
      } finally {
        if (!cancelled) {
          setFeatureDetectBusy(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cephMode, editingId, form.admin_access_key, form.admin_secret_key, form.endpoint_url, form.features.admin.endpoint, form.has_admin_secret, form.has_supervision_secret, form.region, form.verify_tls, form.supervision_access_key, form.supervision_secret_key, showForm, canEditEndpoints, configurationReadOnly, locale]);

  const awsMode = form.provider === "aws";
  const computedAwsRegion = normalizeAwsRegion(form.region);
  const computedAwsS3Endpoint = awsS3EndpointForRegion(computedAwsRegion);
  const computedAwsStsEndpoint = awsStsEndpointForRegion(computedAwsRegion);
  const computedAwsIamEndpoint = awsIamEndpointForRegion(computedAwsRegion);

  const updateFeatures = useCallback(
    (updater: (current: FeaturesState) => FeaturesState, providerOverride?: StorageProvider) => {
      setForm((prev) => {
        const provider = providerOverride ?? prev.provider;
        const nextRaw = updater(prev.features);
        const constrained = applyFeatureConstraints(nextRaw, provider);
        return {
          ...prev,
          provider,
          features: constrained,
        };
      });
    },
    []
  );

  const handleProviderChange = (provider: StorageProvider) => {
    setForm((prev) => {
      const awsRegion = AWS_DEFAULT_REGION;
      const awsCoordinates = awsCoordinatesForRegion(awsRegion);
      const defaultFeatures = defaultFeaturesForProvider(provider, awsRegion);
      const constrained = applyFeatureConstraints(defaultFeatures, provider);
      return {
        ...prev,
        provider,
        endpoint_url: provider === "aws" ? awsS3EndpointForRegion(awsRegion) : prev.endpoint_url,
        region: provider === "aws" ? awsRegion : prev.region,
        latitude: provider === "aws" ? (awsCoordinates?.latitude ?? "") : prev.latitude,
        longitude: provider === "aws" ? (awsCoordinates?.longitude ?? "") : prev.longitude,
        verify_tls: provider === "aws" ? true : prev.verify_tls,
        admin_access_key: provider === "ceph" ? prev.admin_access_key : "",
        admin_secret_key: provider === "ceph" ? prev.admin_secret_key : "",
        supervision_access_key: provider === "ceph" ? prev.supervision_access_key : "",
        supervision_secret_key: provider === "ceph" ? prev.supervision_secret_key : "",
        ceph_admin_access_key: provider === "ceph" ? prev.ceph_admin_access_key : "",
        ceph_admin_secret_key: provider === "ceph" ? prev.ceph_admin_secret_key : "",
        features: constrained,
      };
    });
  };

  const handleRegionChange = (region: string) => {
    setForm((prev) => {
      if (prev.provider !== "aws") {
        return { ...prev, region };
      }
      const nextRegion = normalizeAwsRegion(region);
      const nextCoordinates = awsCoordinatesForRegion(region);
      const nextFeatures = applyFeatureConstraints(
        {
          ...prev.features,
          sts: { ...prev.features.sts, endpoint: awsStsEndpointForRegion(nextRegion) },
          iam: { ...prev.features.iam, endpoint: awsIamEndpointForRegion(nextRegion) },
        },
        prev.provider
      );
      return {
        ...prev,
        region,
        endpoint_url: awsS3EndpointForRegion(nextRegion),
        latitude: nextCoordinates?.latitude ?? "",
        longitude: nextCoordinates?.longitude ?? "",
        features: nextFeatures,
      };
    });
  };

  const startCreate = () => {
    if (!metadataReady || envManaged || !canEditEndpoints) return;
    const nextForm = createEmptyForm();
    setForm(nextForm);
    setActiveTab("general");
    setFormInitialSignature(stableSignature({ form: { ...nextForm, tags: normalizeUiTags(nextForm.tags) } }));
    setShowOpsHelp(false);
    setFormError(null);
    setFeatureDetectBusy(false);
    setFeatureDetectError(null);
    setFeatureDetectWarnings([]);
    setEditingId(null);
    setShowForm(true);
  };

  const openEndpointPage = useCallback((endpoint: StorageEndpoint) => {
    const nextForm = createFormFromEndpoint(endpoint);
    setEditingId(endpoint.id);
    setActiveTab("general");
    setForm(nextForm);
    setFormInitialSignature(stableSignature({ form: { ...nextForm, tags: normalizeUiTags(nextForm.tags) } }));
    setFormError(null);
    setShowForm(true);
  }, []);

  const startEdit = (endpoint: StorageEndpoint) => {
    closingForm.current = false;
    openEndpointPage(endpoint);
    navigate(`/admin/storage-endpoints/${endpoint.id}`);
  };

  useEffect(() => {
    if (!hasEndpointRoute) {
      closingForm.current = false;
      return;
    }
    // Router transitions may commit after local state; do not reopen the closing form.
    if (closingForm.current || loading || !hasValidEndpointRoute) return;
    if (editingId === routeEndpointId && showForm) return;
    const endpoint = endpoints.find((candidate) => candidate.id === routeEndpointId);
    if (endpoint) {
      openEndpointPage(endpoint);
    }
  }, [
    editingId,
    endpoints,
    hasEndpointRoute,
    hasValidEndpointRoute,
    loading,
    openEndpointPage,
    routeEndpointId,
    showForm,
  ]);

  const onCloseForm = () => {
    closingForm.current = true;
    setShowForm(false);
    resetForm();
    if (hasEndpointRoute) {
      navigate("/admin/storage-endpoints");
    }
  };
  const formCurrentSignature = useMemo(
    () => stableSignature({ form: { ...form, tags: normalizeUiTags(form.tags) } }),
    [form]
  );
  const hasFormChanges = Boolean(formInitialSignature) && formCurrentSignature !== formInitialSignature;
  const formCloseGuard = useUnsavedChangesGuard({
    hasUnsavedChanges: hasFormChanges,
    disabled: saving,
    onClose: onCloseForm,
  });

  const handleDelete = async () => {
    if (!metadataReady || envManaged || !canEditEndpoints || mutationPending.current) return;
    if (!deleteTarget?.is_editable) return;
    mutationPending.current = true;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteStorageEndpoint(deleteTarget.id);
      setDeleteTarget(null);
      setActionMessage(translate(infrastructureMessages.endpointDeleted, locale));
      await loadEndpoints();
    } catch (err) {
      setDeleteError(extractError(err, locale));
    } finally {
      mutationPending.current = false;
      setDeleteBusy(false);
    }
  };

  const handleSetDefault = async (endpoint: StorageEndpoint) => {
    if (!metadataReady || envManaged || !canEditEndpoints || mutationPending.current) return;
    if (endpoint.is_default) return;
    mutationPending.current = true;
    setDefaultError(null);
    setDefaultBusyId(endpoint.id);
    try {
      await setDefaultStorageEndpoint(endpoint.id);
      setActionMessage(translate(infrastructureMessages.defaultEndpointUpdated, locale));
      await loadEndpoints();
    } catch (err) {
      setDefaultError(extractError(err, locale));
    } finally {
      mutationPending.current = false;
      setDefaultBusyId(null);
    }
  };

  const buildPayload = (): StorageEndpointPayload | null => {
    const trimmedName = form.name.trim();
    const awsPayloadRegion = normalizeAwsRegion(form.region);
    const trimmedEndpoint = form.provider === "aws" ? awsS3EndpointForRegion(awsPayloadRegion) : form.endpoint_url.trim();
    const trimmedRegion = form.provider === "aws" ? awsPayloadRegion : form.region.trim();
    const trimmedAdminAccess = form.admin_access_key.trim();
    const trimmedAdminSecret = form.admin_secret_key.trim();
    const trimmedSupervisionAccess = form.supervision_access_key.trim();
    const trimmedSupervisionSecret = form.supervision_secret_key.trim();
    const trimmedCephAdminAccess = form.ceph_admin_access_key.trim();
    const trimmedCephAdminSecret = form.ceph_admin_secret_key.trim();
    let latitude: number | null;
    let longitude: number | null;
    const featuresSource =
      form.provider === "aws"
        ? {
            ...form.features,
            sts: { ...form.features.sts, endpoint: awsStsEndpointForRegion(awsPayloadRegion) },
            iam: { ...form.features.iam, endpoint: awsIamEndpointForRegion(awsPayloadRegion) },
          }
        : form.features;
    const constrainedFeatures = applyFeatureConstraints(featuresSource, form.provider);
    const featuresConfig = buildFeaturesYaml(constrainedFeatures);
    const adminEnabled = constrainedFeatures.admin.enabled;
    const usageMetricsEnabled = constrainedFeatures.usage.enabled || constrainedFeatures.metrics.enabled;

    if (!trimmedName) {
      setFormError(translate(infrastructureMessages.endpointNameIsRequired, locale));
      return null;
    }
    if (!trimmedEndpoint) {
      setFormError(translate(infrastructureMessages.endpointURLIsRequired, locale));
      return null;
    }
    try {
      latitude = parseCoordinateInput(form.latitude, translate(infrastructureMessages.latitude, locale), -90, 90, locale);
      longitude = parseCoordinateInput(form.longitude, translate(infrastructureMessages.longitude, locale), -180, 180, locale);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : translate(infrastructureMessages.invalidCoordinates, locale));
      return null;
    }

    const payload: StorageEndpointPayload = {
      name: trimmedName,
      endpoint_url: trimmedEndpoint,
      region: trimmedRegion || null,
      force_path_style: Boolean(form.force_path_style),
      verify_tls: Boolean(form.verify_tls),
      latitude,
      longitude,
      provider: form.provider,
      features_config: featuresConfig,
    };

    if (form.provider === "ceph") {
      if (adminEnabled && !trimmedAdminAccess) {
        setFormError(translate(infrastructureMessages.adminAccessKeyIsRequiredWhenAdminIsEnabled, locale));
        return null;
      }
      if (usageMetricsEnabled && !trimmedSupervisionAccess) {
        setFormError(translate(infrastructureMessages.supervisionAccessKeyIsRequiredWhenUsageLogOrMetrics, locale));
        return null;
      }
      if (editingId) {
        if (trimmedAdminAccess) {
          payload.admin_access_key = trimmedAdminAccess;
          if (trimmedAdminSecret) payload.admin_secret_key = trimmedAdminSecret;
        } else {
          payload.admin_access_key = null;
          payload.admin_secret_key = null;
        }
        if (trimmedSupervisionAccess) {
          payload.supervision_access_key = trimmedSupervisionAccess;
          if (trimmedSupervisionSecret) payload.supervision_secret_key = trimmedSupervisionSecret;
        } else {
          payload.supervision_access_key = null;
          payload.supervision_secret_key = null;
        }
        if (trimmedCephAdminAccess) {
          payload.ceph_admin_access_key = trimmedCephAdminAccess;
          if (trimmedCephAdminSecret) payload.ceph_admin_secret_key = trimmedCephAdminSecret;
        } else {
          payload.ceph_admin_access_key = null;
          payload.ceph_admin_secret_key = null;
        }
      } else {
        payload.admin_access_key = trimmedAdminAccess || null;
        payload.admin_secret_key = trimmedAdminSecret || null;
        payload.supervision_access_key = trimmedSupervisionAccess || null;
        payload.supervision_secret_key = trimmedSupervisionSecret || null;
        payload.ceph_admin_access_key = trimmedCephAdminAccess || null;
        payload.ceph_admin_secret_key = trimmedCephAdminSecret || null;
        if (adminEnabled && (!payload.admin_access_key || !payload.admin_secret_key)) {
          setFormError(translate(infrastructureMessages.adminCredentialsAreRequiredForACephEndpoint, locale));
          return null;
        }
        if (usageMetricsEnabled && (!payload.supervision_access_key || !payload.supervision_secret_key)) {
          setFormError(translate(infrastructureMessages.supervisionCredentialsAreRequiredForUsageLogmetricsOnACeph, locale));
          return null;
        }
      }
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!metadataReady || !canEditEndpoints) return;
    setFormError(null);
    setSaving(true);
    try {
      const normalizedTags = normalizeUiTags(form.tags);
      if (editingId) {
        if (!configurationReadOnly) {
          const payload = buildPayload();
          if (!payload) {
            setSaving(false);
            return;
          }
          await updateStorageEndpoint(editingId, payload);
        }
        await updateStorageEndpointTags(editingId, { tags: normalizedTags });
        setActionMessage(configurationReadOnly ? translate(infrastructureMessages.endpointTagsUpdated, locale) : translate(infrastructureMessages.endpointUpdated, locale));
      } else {
        if (envManaged) return;
        const payload = buildPayload();
        if (!payload) {
          setSaving(false);
          return;
        }
        const created = await createStorageEndpoint(payload);
        if (normalizedTags.length > 0) {
          await updateStorageEndpointTags(created.id, { tags: normalizedTags });
        }
        setActionMessage(translate(infrastructureMessages.endpointAdded, locale));
      }
      setShowForm(false);
      resetForm();
      await loadEndpoints();
      if (hasEndpointRoute) {
        navigate("/admin/storage-endpoints");
      }
    } catch (err) {
      setFormError(extractError(err, locale));
    } finally {
      setSaving(false);
    }
  };

  const showUsageLogUnavailableWarning =
    cephMode &&
    !featureDetectBusy &&
    !featureDetectError &&
    Boolean(form.endpoint_url.trim()) &&
    Boolean(form.supervision_access_key.trim() || form.has_supervision_secret) &&
    !form.features.usage.enabled;
  const hasSupervisionCredentialsForSignedProbe = Boolean(
    form.supervision_access_key.trim() && (form.supervision_secret_key.trim() || form.has_supervision_secret)
  );
  const editorTabs = [
    { id: "general", label: translate(infrastructureMessages.connection, locale) },
    { id: "credentials", label: translate(infrastructureMessages.credentials, locale) },
    { id: "capabilities", label: translate(infrastructureMessages.capabilitiesHealth, locale) },
  ];
  const signedProbeBlockedReason = !cephMode
    ? translate({ en: "S3 signed probe is available only for Ceph endpoints.", zh: "仅 Ceph 端点支持 S3 签名探针。" }, locale)
    : !hasSupervisionCredentialsForSignedProbe
    ? translate({ en: "S3 signed probe requires Supervision credentials (access key + secret key).", zh: "S3 签名探针需要监控凭据（访问密钥和秘密密钥）。" }, locale)
    : null;
  const editorEndpointName = form.name.trim() || editingEndpoint?.name || translate(infrastructureMessages.endpoint, locale);
  const editorTitle = editingId
    ? `${configurationReadOnly ? translate(infrastructureMessages.storageEndpoint, locale) : translate(infrastructureMessages.editStorageEndpoint, locale)} · ${editorEndpointName}`
    : translate(infrastructureMessages.newStorageEndpoint, locale);
  const providerOptionClass = cx(
    "flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 ui-body font-semibold text-slate-700 shadow-sm transition dark:border-slate-700 dark:text-slate-100",
    configurationReadOnly
      ? "cursor-not-allowed opacity-70"
      : "cursor-pointer hover:border-primary hover:text-primary dark:hover:border-primary-400 dark:hover:text-primary-100"
  );

  useEffect(() => {
    if (signedProbeBlockedReason && form.features.healthcheck.mode === "s3") {
      updateFeatures((current) => ({
        ...current,
        healthcheck: {
          ...current.healthcheck,
          mode: "http",
        },
      }));
    }
  }, [form.features.healthcheck.mode, signedProbeBlockedReason, updateFeatures]);

  return (
    <div className="space-y-4 ui-caption leading-relaxed">
      {routeEndpointLoading ? (
        <WorkflowPage
          title={translate(infrastructureMessages.loadingStorageEndpoint, locale)}
          description={translate(infrastructureMessages.retrievingEndpointConfigurationAndAccessMode, locale)}
          breadcrumbs={adminPageBreadcrumbs("storage-endpoints", locale, { label: translate(infrastructureMessages.loadingText, locale) })}
          width="narrow"
        >
          <PageBanner tone="info">{translate(infrastructureMessages.loadingEndpointConfiguration, locale)}</PageBanner>
        </WorkflowPage>
      ) : routeEndpointMissing ? (
        <WorkflowPage
          title={translate(infrastructureMessages.storageEndpointNotFound, locale)}
          description={translate(infrastructureMessages.theRequestedEndpointDoesNotExistOrIsNoLonger, locale)}
          breadcrumbs={adminPageBreadcrumbs("storage-endpoints", locale, { label: translate(infrastructureMessages.notFound, locale) })}
          backLabel={translate(infrastructureMessages.backToEndpoints, locale)}
          onBack={() => navigate("/admin/storage-endpoints")}
          width="narrow"
        >
          <PageBanner tone="warning">{translate(infrastructureMessages.selectAnEndpointFromTheCurrentStorageEndpointList, locale)}</PageBanner>
        </WorkflowPage>
      ) : !showForm ? (
        <>
      <PageHeader
        title={translate(infrastructureMessages.s3Endpoints, locale)}
        description={translate(infrastructureMessages.manageTheS3CephEndpointsUsedByTheConsole, locale)}
        breadcrumbs={adminPageBreadcrumbs("storage-endpoints", locale)}
        rightContent={metadataReady && !loading && !envManaged && canEditEndpoints ? <ListActionButton variant="primary" onClick={startCreate}>{translate(infrastructureMessages.newEndpoint, locale)}</ListActionButton> : undefined}
      />

      {envManaged && (
        <PageBanner tone="info">
          {translate(infrastructureMessages.storageEndpointsAreManagedByEnvironmentVariablesENVSTORAGEENDPOINTSConfigurationChanges, locale)}</PageBanner>
      )}
      {!envManaged && !canEditEndpoints && (
        <PageBanner tone="info">
          {translate(infrastructureMessages.endpointEditingIsRestrictedToSuperadminUsersYouCurrentlyHave, locale)}</PageBanner>
      )}
      {defaultError && <PageBanner tone="error">{defaultError}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{actionMessage}</PageBanner>}
      <StorageEndpointList endpoints={endpoints} loading={loading} error={error}
        envManaged={envManaged} metadataReady={metadataReady} canEdit={canEditEndpoints}
        defaultBusyId={defaultBusyId} deleteBusy={deleteBusy} filters={listFilters}
        onFiltersChange={setListFilters} onOpen={startEdit} onSetDefault={handleSetDefault}
        onDelete={(endpoint) => { setDeleteTarget(endpoint); setDeleteError(null); }}
        onRetry={() => void loadEndpoints()} />
        </>
      ) : null}

      {showForm && (
        <WorkflowPage
          title={editorTitle}
          description={translate(infrastructureMessages.manageConnectionSettingsOperationalCredentialsCapabilitiesAndHealthChecksFor, locale)}
          breadcrumbs={adminPageBreadcrumbs("storage-endpoints", locale, {
            label: editingId ? editingEndpoint?.name ?? translate(infrastructureMessages.endpoint, locale) : translate(infrastructureMessages.create, locale),
          })}
          backLabel={translate(infrastructureMessages.backToEndpoints, locale)}
          onBack={formCloseGuard.requestClose}
          contentVariant="plain"
          width="wide"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <PageBanner tone="error">{formError}</PageBanner>}
            {configurationReadOnly && (
              <PageBanner tone="info">
                {translate(infrastructureMessages.endpointConfigurationIsReadonly, locale)}{!metadataReady
                  ? translate(infrastructureMessages.managementModeIsUnavailableReturnToEndpointsAndRetryBefore, locale)
                  : canEditEndpoints ? translate(infrastructureMessages.youCanStillUpdateTheTagsAssociatedWithThisEndpoint, locale)
                    : translate(infrastructureMessages.allSettingsAndTagsAreAvailableForConsultationOnly, locale)}
              </PageBanner>
            )}
            {endpointTagCatalogError && <PageBanner tone="warning">{endpointTagCatalogError}</PageBanner>}
            <PageTabs
              tabs={editorTabs}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab as EndpointEditorTab)}
              variant="line"
              ariaLabel={translate(infrastructureMessages.endpointConfigurationSections, locale)}
              idPrefix="endpoint-editor"
            />

            {activeTab === "general" && (
              <div
                id="endpoint-editor-panel-general"
                role="tabpanel"
                aria-labelledby="endpoint-editor-tab-general"
              >
                <WorkflowSection
                  title={translate(infrastructureMessages.identityAndConnection, locale)}
                  description={translate(infrastructureMessages.nameTheBackendIdentifyItsProviderAndDefineHowBucketReef, locale)}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <UiInput
                      label={translate(infrastructureMessages.endpointName, locale)}
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className={endpointReadOnlyInputClass}
                      readOnly={configurationReadOnly}
                      required
                    />

                    <div>
                      <p className="mb-1 ui-caption font-semibold text-[var(--ui-text-muted)]">{translate(infrastructureMessages.endpointTags, locale)}</p>
                      {canEditEndpoints ? (
                        <UiTagEditor
                          label={translate(infrastructureMessages.endpointTags, locale)}
                          tags={form.tags}
                          catalog={endpointTagCatalog}
                          onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
                          placeholder={translate(infrastructureMessages.addATagForThisEndpoint, locale)}
                          hint={endpointTagCatalogLoading ? translate(infrastructureMessages.loadingExistingEndpointTags, locale) : undefined}
                          hideLabel
                          compact
                        />
                      ) : (
                        <div className="min-h-10 rounded-lg border border-[color:var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2">
                          <UiTagBadgeList items={buildUiTagItems(form.tags)} emptyLabel={translate(infrastructureMessages.noTags, locale)} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
            <div className="space-y-2">
              <span className="ui-body font-semibold text-slate-700 dark:text-slate-100">{translate(infrastructureMessages.provider, locale)}</span>
              <div className="flex gap-3">
                <label className={providerOptionClass}>
                  <input
                    type="radio"
                    name="provider"
                    value="ceph"
                    checked={form.provider === "ceph"}
                    onChange={() => handleProviderChange("ceph")}
                    disabled={configurationReadOnly}
                  />
                  <span>Ceph</span>
                </label>
                <label className={providerOptionClass}>
                  <input
                    type="radio"
                    name="provider"
                    value="aws"
                    checked={form.provider === "aws"}
                    onChange={() => handleProviderChange("aws")}
                    disabled={configurationReadOnly}
                  />
                  <span>AWS</span>
                </label>
                <label className={providerOptionClass}>
                  <input
                    type="radio"
                    name="provider"
                    value="other"
                    checked={form.provider === "other"}
                    onChange={() => handleProviderChange("other")}
                    disabled={configurationReadOnly}
                  />
                  <span>{translate(infrastructureMessages.other, locale)}</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UiInput
                label={translate({ en: "S3 endpoint URL", zh: "S3 端点 URL" }, locale)}
                value={awsMode ? computedAwsS3Endpoint : form.endpoint_url}
                onChange={(e) => {
                  if (!awsMode) {
                    setForm((prev) => ({ ...prev, endpoint_url: e.target.value }));
                  }
                }}
                className={endpointReadOnlyInputClass}
                placeholder={awsMode ? computedAwsS3Endpoint : "https://s3.example.com"}
                readOnly={configurationReadOnly || awsMode}
                required
              />
              <UiInput
                label={translate(infrastructureMessages.regionOptional, locale)}
                value={form.region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className={endpointReadOnlyInputClass}
                readOnly={configurationReadOnly}
                placeholder="us-east-1"
              />
              <UiInput
                label={translate(infrastructureMessages.latitudeOptional, locale)}
                type="number"
                value={form.latitude}
                onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                className={endpointReadOnlyInputClass}
                readOnly={configurationReadOnly}
                placeholder="48.8566"
                min="-90"
                max="90"
                step="any"
              />
              <UiInput
                label={translate(infrastructureMessages.longitudeOptional, locale)}
                type="number"
                value={form.longitude}
                onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                className={endpointReadOnlyInputClass}
                readOnly={configurationReadOnly}
                placeholder="2.3522"
                min="-180"
                max="180"
                step="any"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <label className="flex items-center justify-between gap-4 ui-body font-semibold text-slate-700 dark:text-slate-100">
                {translate(infrastructureMessages.forcePathStyle, locale)}<input
                  type="checkbox"
                  checked={form.force_path_style}
                  onChange={(e) => setForm((prev) => ({ ...prev, force_path_style: e.target.checked }))}
                  className={endpointToggleCheckboxClass}
                  disabled={configurationReadOnly}
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <label className="flex items-center justify-between gap-4 ui-body font-semibold text-slate-700 dark:text-slate-100">
                {translate(infrastructureMessages.insecureSSLSkipCertificateValidation, locale)}<input
                  type="checkbox"
                  checked={!form.verify_tls}
                  onChange={(e) => setForm((prev) => ({ ...prev, verify_tls: !e.target.checked }))}
                  className={endpointToggleCheckboxClass}
                  disabled={configurationReadOnly}
                />
              </label>
              {!form.verify_tls && (
                <p className="mt-2 ui-caption text-amber-700 dark:text-amber-300">
                  {translate(infrastructureMessages.tLSCertificateValidationIsDisabledForThisEndpointUseOnly, locale)}</p>
              )}
            </div>

                  </div>
                </WorkflowSection>
              </div>
            )}

            {activeTab === "credentials" && (
              <div
                id="endpoint-editor-panel-credentials"
                role="tabpanel"
                aria-labelledby="endpoint-editor-tab-credentials"
              >
                <WorkflowSection
                  title={translate(infrastructureMessages.operationalCredentials, locale)}
                  description={translate(infrastructureMessages.keepAdministrativeMonitoringAndClusterwideIdentitiesIsolatedByPurpose, locale)}
                >
                  <div className="space-y-4">
            {cephMode ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 ui-body text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                  <p className="ui-caption font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{translate(infrastructureMessages.management, locale)}</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 ui-body font-semibold text-slate-700 dark:text-slate-100">
                      <p>{translate(infrastructureMessages.administrationAdminOps, locale)}</p>
                      <div className="grid gap-3">
                        <UiInput
                          label={translate(infrastructureMessages.adminAccessKey, locale)}
                          value={form.admin_access_key}
                          onChange={(e) => setForm((prev) => ({ ...prev, admin_access_key: e.target.value }))}
                          className={endpointReadOnlyInputClass}
                          readOnly={configurationReadOnly}
                          placeholder={translate(infrastructureMessages.accessKeyAdmin, locale)}
                          required={form.features.admin.enabled}
                        />
                        {configurationReadOnly ? (
                          <StoredSecretStatus label={translate(infrastructureMessages.adminSecretKey, locale)} stored={form.has_admin_secret} />
                        ) : (
                          <UiInput
                            label={translate(infrastructureMessages.adminSecretKey, locale)}
                            type="password"
                            value={form.admin_secret_key}
                            onChange={(e) => setForm((prev) => ({ ...prev, admin_secret_key: e.target.value }))}
                            placeholder={editingId ? translate(infrastructureMessages.secretKeyAdminLeaveBlankToKeep, locale) : translate(infrastructureMessages.secretKeyAdmin, locale)}
                            required={!editingId && form.features.admin.enabled}
                          />
                        )}
                      </div>
                      {!configurationReadOnly && <p className="ui-caption font-normal text-slate-500 dark:text-slate-400">
                        {editingId ? translate(infrastructureMessages.leaveTheSecretKeyEmptyToKeepTheCurrentOne, locale) : translate(infrastructureMessages.requiredWhenAdminIsEnabled, locale)}
                      </p>}
                    </div>
                    <div className="space-y-1 ui-body font-semibold text-slate-700 dark:text-slate-100">
                      <p>{translate(infrastructureMessages.monitoringSupervisionOps, locale)}</p>
                      <div className="grid gap-3">
                        <UiInput
                          label={translate(infrastructureMessages.supervisionAccessKey, locale)}
                          value={form.supervision_access_key}
                          onChange={(e) => setForm((prev) => ({ ...prev, supervision_access_key: e.target.value }))}
                          className={endpointReadOnlyInputClass}
                          readOnly={configurationReadOnly}
                          placeholder={translate(infrastructureMessages.accessKeySupervision, locale)}
                          required={form.features.usage.enabled || form.features.metrics.enabled}
                        />
                        {configurationReadOnly ? (
                          <StoredSecretStatus label={translate(infrastructureMessages.supervisionSecretKey, locale)} stored={form.has_supervision_secret} />
                        ) : (
                          <UiInput
                            label={translate(infrastructureMessages.supervisionSecretKey, locale)}
                            type="password"
                            value={form.supervision_secret_key}
                            onChange={(e) => setForm((prev) => ({ ...prev, supervision_secret_key: e.target.value }))}
                            placeholder={translate(infrastructureMessages.secretKeySupervision, locale)}
                            required={!editingId && (form.features.usage.enabled || form.features.metrics.enabled)}
                          />
                        )}
                      </div>
                      <p className="ui-caption font-normal text-slate-500 dark:text-slate-400">
                        {translate(infrastructureMessages.useTheseKeysForReadonlyMonitoringActions, locale)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 ui-caption text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="ui-body font-semibold text-slate-700 dark:text-slate-100">
                      {translate(infrastructureMessages.whatAreAdminOpsAndSupervisionOps, locale)}</p>
                    <UiButton
                      size="xs"
                      variant="secondary"
                      onClick={() => setShowOpsHelp((prev) => !prev)}
                      aria-expanded={showOpsHelp}
                    >
                      {showOpsHelp ? translate(infrastructureMessages.hide, locale) : translate(infrastructureMessages.show, locale)}
                    </UiButton>
                  </div>
                  {showOpsHelp && (
                    <>
                      <p className="mt-2">
                        <span className="font-semibold">{translate(infrastructureMessages.adminOps, locale)}</span> {translate(infrastructureMessages.keysLetBucketReefCreateRGWAccountsAndS3UsersAnd, locale)}<code> buckets=write</code> {translate(infrastructureMessages.capabilityIncludedInTheExampleBelowIfYouDoNot, locale)}</p>
                      <p className="mt-2">
                        <span className="font-semibold">Supervision Ops</span> {translate(infrastructureMessages.keysAreReadonlyCredentialsUsedForUsageLogsAndMetrics, locale)}</p>
                      <p className="mt-3 font-semibold text-slate-700 dark:text-slate-100">{translate(infrastructureMessages.cephRadosgwadminExamples, locale)}</p>
                      <div className="mt-2 space-y-3">
                        <div>
                          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">{translate(infrastructureMessages.adminOps, locale)}</p>
                          <pre className="overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
                            {ADMIN_OPS_COMMAND}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Supervision Ops</p>
                          <pre className="overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
                            {SUPERVISION_OPS_COMMAND}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {cephAdminConfigEnabled && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 ui-caption text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-100">
                    <p className="ui-body font-semibold">{translate(infrastructureMessages.cephAdminDedicatedCredentials, locale)}</p>
                    <p className="mt-2">
                      {translate(infrastructureMessages.theseCredentialsAreUsedOnlyByThe, locale)}<code>/ceph-admin</code> {translate(infrastructureMessages.workspaceAdvancedClusterwideOperationsTheyAreIsolatedFromAdminOps, locale)}</p>
                    <p className="mt-1 ui-caption opacity-80">
                      {translate(infrastructureMessages.noteAccessTo, locale)}<code>/ceph-admin</code> {translate(infrastructureMessages.usesTheseDedicatedCredentialsAndDoesNotDependOnThe, locale)}<code> admin.enabled</code> {translate(infrastructureMessages.endpointFeatureFlag, locale)}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <UiInput
                        label={translate(infrastructureMessages.cephAdminAccessKey, locale)}
                        value={form.ceph_admin_access_key}
                        onChange={(e) => setForm((prev) => ({ ...prev, ceph_admin_access_key: e.target.value }))}
                        className={endpointReadOnlyInputClass}
                        readOnly={configurationReadOnly}
                        placeholder={translate(infrastructureMessages.cephAdminAccessKey, locale)}
                      />
                      {configurationReadOnly ? (
                        <StoredSecretStatus
                          label={translate(infrastructureMessages.cephAdminSecretKey, locale)}
                          stored={Boolean(editingEndpoint?.has_ceph_admin_secret)}
                        />
                      ) : (
                        <UiInput
                          label={translate(infrastructureMessages.cephAdminSecretKey, locale)}
                          type="password"
                          value={form.ceph_admin_secret_key}
                          onChange={(e) => setForm((prev) => ({ ...prev, ceph_admin_secret_key: e.target.value }))}
                          placeholder={editingId ? translate(infrastructureMessages.cephAdminSecretKeyLeaveBlankToKeep, locale) : translate(infrastructureMessages.cephAdminSecretKey, locale)}
                        />
                      )}
                    </div>
                    {!configurationReadOnly && <p className="mt-2">
                      {editingId
                        ? translate(infrastructureMessages.leaveTheSecretKeyEmptyToKeepTheCurrentOne, locale)
                        : translate(infrastructureMessages.recommendedKeepThisAccountDedicatedToCephadminOnly, locale)}
                    </p>}
                    <p className="mt-3 font-semibold text-amber-900 dark:text-amber-100">{translate(infrastructureMessages.cephRadosgwadminExample, locale)}</p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
                      {CEPH_ADMIN_COMMAND}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <PageBanner tone="info">
                {form.provider === "aws"
                  ? translate(infrastructureMessages.aWSEndpointsUseTheActiveExecutionIdentityAndDoNot, locale)
                  : translate(infrastructureMessages.thisProviderDoesNotUseDedicatedOperationalCredentialsInBucketReef, locale)}
              </PageBanner>
            )}
                  </div>
                </WorkflowSection>
              </div>
            )}

            {activeTab === "capabilities" && (
              <div
                id="endpoint-editor-panel-capabilities"
                role="tabpanel"
                aria-labelledby="endpoint-editor-tab-capabilities"
              >
                <WorkflowSection
                  title={translate(infrastructureMessages.capabilitiesAndHealth, locale)}
                  description={translate(infrastructureMessages.reviewDetectedCephServicesS3CapabilitiesAndTheProbeUsed, locale)}
                >
                  <div className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 ui-body text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <p className="ui-caption font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{translate(infrastructureMessages.features, locale)}</p>
                <div className="mt-3 space-y-4">
                  {cephMode && (
                    <div className="space-y-3">
                      <p className="ui-caption font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ceph</p>
                      {(featureDetectBusy ||
                        featureDetectError ||
                        featureDetectWarnings.length > 0 ||
                        showUsageLogUnavailableWarning) && (
                        <div className="space-y-2">
                          {featureDetectBusy && (
                            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 ui-caption text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100">
                              {translate(infrastructureMessages.featureDetectionInProgressFromEnteredCredentials, locale)}</p>
                          )}
                          {featureDetectError && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 ui-caption text-red-900 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-100">
                              {featureDetectError}
                            </p>
                          )}
                          {featureDetectWarnings.map((warning, idx) => (
                            <p
                              key={`${warning}-${idx}`}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 ui-caption text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-100"
                            >
                              {warning}
                            </p>
                          ))}
                          {showUsageLogUnavailableWarning && (
                              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 ui-caption text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-100">
                                {translate(infrastructureMessages.usageLogDoesNotSeemEnabledOnRGWRgwenableusagelogSo, locale)}</p>
                            )}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          title={translate(infrastructureMessages.thisOptionIsAutomaticallyDetectedFromCredentialsAndCannotBe, locale)}
                          className={endpointToggleCardDisabledClass}
                        >
                          {translate(infrastructureMessages.adminEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.admin.enabled}
                            readOnly
                            className={endpointToggleCheckboxClass}
                            disabled
                          />
                        </label>
                        <label
                          title={translate(infrastructureMessages.thisOptionIsAutomaticallyDetectedFromCredentialsAndCannotBe, locale)}
                          className={endpointToggleCardDisabledClass}
                        >
                          {translate(infrastructureMessages.accountsEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.account.enabled}
                            readOnly
                            className={endpointToggleCheckboxClass}
                            disabled
                          />
                        </label>
                        <label
                          title={translate(infrastructureMessages.thisOptionIsAutomaticallyDetectedFromCredentialsAndCannotBe, locale)}
                          className={endpointToggleCardDisabledClass}
                        >
                          {translate(infrastructureMessages.usageLogEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.usage.enabled}
                            readOnly
                            className={endpointToggleCheckboxClass}
                            disabled
                          />
                        </label>
                        <label
                          title={translate(infrastructureMessages.thisOptionIsAutomaticallyDetectedFromCredentialsAndCannotBe, locale)}
                          className={endpointToggleCardDisabledClass}
                        >
                          {translate(infrastructureMessages.metricsEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.metrics.enabled}
                            readOnly
                            className={endpointToggleCheckboxClass}
                            disabled
                          />
                        </label>
                        <label className={endpointToggleCardClass}>
                          {translate(infrastructureMessages.sNSTopicsEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.sns.enabled}
                            onChange={(e) =>
                              updateFeatures((current) => ({
                                ...current,
                                sns: { ...current.sns, enabled: e.target.checked },
                              }))
                            }
                            className={endpointToggleCheckboxClass}
                            disabled={configurationReadOnly || !cephMode}
                          />
                        </label>
                        <label className={endpointToggleCardClass}>
                          {translate(infrastructureMessages.bucketReplicationEnabled, locale)}<input
                            type="checkbox"
                            checked={form.features.replication.enabled}
                            onChange={(e) =>
                              updateFeatures((current) => ({
                                ...current,
                                replication: { ...current.replication, enabled: e.target.checked },
                              }))
                            }
                            className={endpointToggleCheckboxClass}
                            disabled={configurationReadOnly || !cephMode}
                          />
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <UiInput
                          label={translate(infrastructureMessages.cephAdminEndpointOverrideOptional, locale)}
                          value={form.features.admin.endpoint}
                          onChange={(e) =>
                            updateFeatures((current) => ({
                              ...current,
                              admin: { ...current.admin, endpoint: e.target.value },
                            }))
                          }
                          className={endpointReadOnlyInputClass}
                          readOnly={configurationReadOnly}
                          placeholder="http://rgw-admin.local"
                        />
                      </div>
                      <p className="ui-caption text-slate-500 dark:text-slate-400">
                        {translate(infrastructureMessages.adminAccountAPIUsageLogAndMetricsAreAutodetectedFrom, locale)}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="ui-caption font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">S3</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={endpointToggleCardClass}>
                        {translate(infrastructureMessages.sTSEnabled, locale)}<input
                          type="checkbox"
                          checked={form.features.sts.enabled}
                          onChange={(e) =>
                            updateFeatures((current) => ({
                              ...current,
                              sts: { ...current.sts, enabled: e.target.checked },
                            }))
                          }
                          className={endpointToggleCheckboxClass}
                          disabled={configurationReadOnly}
                        />
                      </label>
                      <label className={endpointToggleCardClass}>
                        {translate(infrastructureMessages.staticWebsiteEnabled, locale)}<input
                          type="checkbox"
                          checked={form.features.static_website.enabled}
                          onChange={(e) =>
                            updateFeatures((current) => ({
                              ...current,
                              static_website: { ...current.static_website, enabled: e.target.checked },
                            }))
                          }
                          className={endpointToggleCheckboxClass}
                          disabled={configurationReadOnly}
                        />
                      </label>
                      <label className={endpointToggleCardClass}>
                        {translate(infrastructureMessages.iAMEnabled, locale)}<input
                          type="checkbox"
                          checked={form.features.iam.enabled}
                          onChange={(e) =>
                            updateFeatures((current) => ({
                              ...current,
                              iam: { ...current.iam, enabled: e.target.checked },
                            }))
                          }
                          className={endpointToggleCheckboxClass}
                          disabled={configurationReadOnly}
                        />
                      </label>
                      <label className={endpointToggleCardClass}>
                        {translate(infrastructureMessages.serverSideEncryptionSSEEnabled, locale)}<input
                          type="checkbox"
                          checked={form.features.sse.enabled}
                          onChange={(e) =>
                            updateFeatures((current) => ({
                              ...current,
                              sse: { ...current.sse, enabled: e.target.checked },
                            }))
                          }
                          className={endpointToggleCheckboxClass}
                          disabled={configurationReadOnly}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <UiInput
                    label={awsMode ? translate(infrastructureMessages.sTSEndpoint, locale) : translate(infrastructureMessages.sTSEndpointOverrideOptional, locale)}
                    value={awsMode ? computedAwsStsEndpoint : form.features.sts.endpoint}
                    onChange={(e) => {
                      if (!awsMode) {
                        updateFeatures((current) => ({
                          ...current,
                          sts: { ...current.sts, endpoint: e.target.value },
                        }));
                      }
                    }}
                    className={endpointReadOnlyInputClass}
                    placeholder={awsMode ? computedAwsStsEndpoint : "https://sts.example.com"}
                    disabled={!form.features.sts.enabled}
                    readOnly={configurationReadOnly || awsMode}
                    title={!form.features.sts.enabled ? translate(infrastructureMessages.enableSTSFirstToDefineADedicatedSTSEndpoint, locale) : undefined}
                  />
                  <UiInput
                    label={awsMode ? translate(infrastructureMessages.iAMEndpoint, locale) : translate(infrastructureMessages.iAMEndpointOverrideOptional, locale)}
                    value={awsMode ? computedAwsIamEndpoint : form.features.iam.endpoint}
                    onChange={(e) => {
                      if (!awsMode) {
                        updateFeatures((current) => ({
                          ...current,
                          iam: { ...current.iam, endpoint: e.target.value },
                        }));
                      }
                    }}
                    className={endpointReadOnlyInputClass}
                    placeholder={awsMode ? computedAwsIamEndpoint : "https://iam.example.com"}
                    disabled={!form.features.iam.enabled}
                    readOnly={configurationReadOnly || awsMode}
                    title={!form.features.iam.enabled ? translate(infrastructureMessages.enableIAMFirstToDefineADedicatedIAMEndpoint, locale) : undefined}
                  />
                  <UiSelect
                    label={translate(infrastructureMessages.healthcheckMode, locale)}
                    value={form.features.healthcheck.mode ?? "http"}
                    onChange={(e) =>
                      updateFeatures((current) => ({
                        ...current,
                        healthcheck: {
                          ...current.healthcheck,
                          mode: e.target.value === "s3" ? "s3" : "http",
                        },
                      }))
                    }
                    disabled={configurationReadOnly || !cephMode}
                    title={!cephMode ? translate(infrastructureMessages.healthcheckSignedModeIsAvailableOnlyForCephEndpoints, locale) : signedProbeBlockedReason ?? undefined}
                  >
                    <option value="http">{translate(infrastructureMessages.hTTPProbe, locale)}</option>
                    <option value="s3" disabled={Boolean(signedProbeBlockedReason)} title={signedProbeBlockedReason ?? undefined}>
                      {translate(infrastructureMessages.s3SignedProbe, locale)}{signedProbeBlockedReason ? translate({ en: " (requires supervision credentials)", zh: "（需要监控凭据）" }, locale) : ""}
                    </option>
                  </UiSelect>
                  <UiInput
                    label={translate(infrastructureMessages.healthcheckURLOverrideOptional, locale)}
                    fieldClassName="sm:col-span-2"
                    value={form.features.healthcheck.endpoint}
                    onChange={(e) =>
                      updateFeatures((current) => ({
                        ...current,
                        healthcheck: { ...current.healthcheck, endpoint: e.target.value },
                      }))
                    }
                    className={endpointReadOnlyInputClass}
                    readOnly={configurationReadOnly}
                    placeholder="https://rgw.example.com/healthz"
                    hint={translate(infrastructureMessages.emptyValueUsesTheEndpointURLS3ModeSignsA, locale)}
                  />
                </div>
              </div>

            </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {(!configurationReadOnly || canEditEndpoints) && (
              <WorkflowActions className="ui-page-sticky-actions bg-[var(--ui-surface)] py-3 shadow-[0_-8px_18px_-16px_rgba(15,23,42,0.45)]">
                <UiButton variant="secondary" size="sm" onClick={formCloseGuard.requestClose}>
                  {configurationReadOnly ? translate(infrastructureMessages.backToEndpoints, locale) : translate(infrastructureMessages.cancel, locale)}
                </UiButton>
                <UiButton
                  type="submit"
                  size="sm"
                  disabled={!metadataReady || saving || !hasFormChanges}
                  title={!metadataReady ? translate(infrastructureMessages.managementModeIsUnavailable, locale) : saving ? translate(infrastructureMessages.saveInProgress, locale) : !hasFormChanges ? translate(infrastructureMessages.noChangesToSave, locale) : undefined}
                >
                  {saving ? translate(infrastructureMessages.saving, locale) : editingId ? (configurationReadOnly ? translate(infrastructureMessages.saveTags, locale) : translate(infrastructureMessages.updateEndpoint, locale)) : translate(infrastructureMessages.createEndpoint, locale)}
                </UiButton>
              </WorkflowActions>
            )}
            {formCloseGuard.confirmationDialog}
          </form>
        </WorkflowPage>
      )}

      {deleteTarget && (
        <ConfirmActionDialog
          title={translate(infrastructureMessages.deleteEndpoint, locale)}
          description={<>{translate(infrastructureMessages.areYouSureYouWantToDelete, locale)}{" "}<strong>{deleteTarget.name}</strong>{translate(infrastructureMessages.thisActionCannotBeUndone, locale)}</>}
          confirmLabel={translate(infrastructureMessages.delete, locale)}
          processingLabel={translate(infrastructureMessages.deleting, locale)}
          loading={deleteBusy}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}
