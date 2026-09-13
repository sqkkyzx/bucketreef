/* Copyright (c) 2026 Laurent Barbe; Licensed under the Apache License, Version 2.0 */
import { translate, useI18n } from "../../i18n";
import { infrastructureMessages } from "../../infrastructureMessages";
import { useMemo } from "react";
import type { StorageEndpoint, StorageProvider } from "../../api/storageEndpoints";
import ActiveFiltersBar from "../../components/ActiveFiltersBar";
import PageBanner from "../../components/PageBanner";
import ToolbarSearchInput from "../../components/ToolbarSearchInput";
import UiTagBadgeList from "../../components/UiTagBadgeList";
import DataTableShell, { dataTableDefaultActionProps, type DataTableColumn } from "../../components/list/DataTableShell";
import ListPageSection from "../../components/list/ListPageSection";
import { resolveListTableStatus } from "../../components/list/listTableStatus";
import { ListActionButton, ListActions } from "../../components/list/ListControls";
import UiBadge from "../../components/ui/UiBadge";
import UiSelect from "../../components/ui/UiSelect";
import { matchesExactTextCandidate, type TextMatchMode } from "../../utils/textMatch";
import { buildUiTagItems } from "../../utils/uiTags";
import { resolveFeatureState, type FeatureKey } from "./storageEndpointFormModel";
import "./storageEndpointList.css";




export type EndpointListFilters = { query: string; mode: TextMatchMode; provider: StorageProvider | "all" };

type Props = {
  endpoints: StorageEndpoint[];
  loading: boolean;
  error: string | null;
  envManaged: boolean;
  metadataReady: boolean;
  canEdit: boolean;
  defaultBusyId: number | null;
  deleteBusy: boolean;
  filters: EndpointListFilters;
  onFiltersChange: (filters: EndpointListFilters) => void;
  onOpen: (endpoint: StorageEndpoint) => void;
  onSetDefault: (endpoint: StorageEndpoint) => void;
  onDelete: (endpoint: StorageEndpoint) => void;
  onRetry: () => void;
};

export default function StorageEndpointList({
  endpoints, loading, error, envManaged, metadataReady, canEdit, defaultBusyId,
  deleteBusy, filters, onFiltersChange, onOpen, onSetDefault, onDelete, onRetry,
}: Props) {
  const { locale } = useI18n();
const providers = useMemo<Record<StorageProvider, string>>(() => ({ ceph: "Ceph", aws: "AWS", other: translate(infrastructureMessages.other, locale) }), [locale]);
const services: Array<{ key: FeatureKey; label: string }> = [
  { key: "admin", label: translate({ en: "Admin", zh: "管理" }, locale) }, { key: "account", label: translate(infrastructureMessages.accountAPI, locale) },
  { key: "usage", label: translate(infrastructureMessages.usageLog, locale) }, { key: "metrics", label: translate(infrastructureMessages.metrics, locale) },
  { key: "sns", label: "SNS" }, { key: "sts", label: "STS" },
  { key: "static_website", label: translate(infrastructureMessages.staticWebsite, locale) }, { key: "iam", label: "IAM" },
  { key: "sse", label: "SSE" }, { key: "replication", label: translate(infrastructureMessages.replication, locale) },
  { key: "healthcheck", label: translate(infrastructureMessages.healthcheck, locale) },
];
  const query = filters.query.trim();
  const rows = useMemo(() => endpoints.filter((endpoint) => {
    if (filters.provider !== "all" && endpoint.provider !== filters.provider) return false;
    const candidates = [endpoint.name, endpoint.endpoint_url, endpoint.provider, providers[endpoint.provider], endpoint.region,
      ...endpoint.tags.map((tag) => tag.label)];
    return filters.mode === "exact"
      ? matchesExactTextCandidate(candidates, query)
      : candidates.some((value) => (value ?? "").toLowerCase().includes(query.toLowerCase()));
  }), [endpoints, filters.provider, filters.mode, providers, query]);
  const pending = loading || deleteBusy || defaultBusyId !== null;
  const mutable = canEdit && metadataReady && !envManaged;
  const activeFilters = [
    ...(query ? [{ id: "search", label: translate({ en: `Search ${filters.mode}: ${query}`, zh: `搜索${filters.mode === "exact" ? "（精确匹配）" : "（包含）"}：${query}` }, locale) }] : []),
    ...(filters.provider !== "all" ? [{ id: "provider", label: translate({ en: `Provider: ${providers[filters.provider]}`, zh: `提供商：${providers[filters.provider]}` }, locale) }] : []),
  ];
  const columns: DataTableColumn<StorageEndpoint>[] = [
    {
      id: "endpoint", label: translate(infrastructureMessages.endpoint, locale), primary: true,
      render: (endpoint) => (
        <div className="endpoint-identity">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="endpoint-name" title={endpoint.name}>{endpoint.name}</span>
            {endpoint.is_default && <UiBadge className="endpoint-status-badge" tone="primary">{translate(infrastructureMessages.default, locale)}</UiBadge>}
            {envManaged ? <UiBadge className="endpoint-status-badge">{translate(infrastructureMessages.envManaged, locale)}</UiBadge> : !endpoint.is_editable && <UiBadge className="endpoint-status-badge">{translate(infrastructureMessages.protected, locale)}</UiBadge>}
          </div>
          <span className="endpoint-url" title={endpoint.endpoint_url}>{endpoint.endpoint_url}</span>
          {endpoint.tags.length > 0 && <div data-table-row-click-ignore="true">
            <UiTagBadgeList items={buildUiTagItems(endpoint.tags)} variant="listing-compact" layout="inline-compact" maxVisible={2} />
          </div>}
        </div>
      ),
    },
    {
      id: "provider", label: translate(infrastructureMessages.provider, locale), headerClassName: "endpoint-provider-cell",
      render: (endpoint) => <div className="endpoint-summary">
        <span>{providers[endpoint.provider]}</span>
        <span className="text-[var(--ui-text-muted)]">{endpoint.region || translate(infrastructureMessages.notSpecified, locale)}</span>
      </div>,
    },
    {
      id: "connection", label: translate(infrastructureMessages.connection, locale), headerClassName: "endpoint-connection-cell",
      render: (endpoint) => <div className="endpoint-summary">
        {endpoint.verify_tls !== false ? <span>{translate(infrastructureMessages.tLSVerificationOn, locale)}</span> : <UiBadge tone="warning">{translate(infrastructureMessages.tLSVerificationOff, locale)}</UiBadge>}
        <span className="text-[var(--ui-text-muted)]">{endpoint.force_path_style ? translate(infrastructureMessages.pathStyle, locale) : translate(infrastructureMessages.virtualhostStyle, locale)}</span>
      </div>,
    },
    {
      id: "services", label: translate(infrastructureMessages.enabledServices, locale), headerClassName: "endpoint-services-cell",
      render: (endpoint) => {
        const features = resolveFeatureState(endpoint, endpoint.provider);
        const enabled = services.filter((service) => features[service.key].enabled);
        return <div className="endpoint-services" role="group" aria-label={`${translate(infrastructureMessages.enabledServices, locale)}: ${enabled.map((service) => service.label).join(", ") || translate(infrastructureMessages.none, locale)}`}>
          {enabled.slice(0, 3).map((service) => <UiBadge key={service.key}>{service.label}</UiBadge>)}
          {enabled.length > 3 && <UiBadge title={enabled.slice(3).map((service) => service.label).join(", ")}>+{enabled.length - 3}</UiBadge>}
          {!enabled.length && <span className="text-[var(--ui-text-muted)]">{translate(infrastructureMessages.noneEnabled, locale)}</span>}
        </div>;
      },
    },
    {
      id: "actions", label: translate(infrastructureMessages.actions, locale), align: "right", mobileRole: "actions",
      headerClassName: "endpoint-actions-cell", cellClassName: "endpoint-actions-cell",
      render: (endpoint) => <ListActions className="endpoint-actions">
        {!endpoint.is_default && <ListActionButton variant="secondary" disabled={!mutable || pending} onClick={() => onSetDefault(endpoint)}>
          {defaultBusyId === endpoint.id ? translate(infrastructureMessages.setting, locale) : translate(infrastructureMessages.setAsDefault, locale)}
        </ListActionButton>}
        <ListActionButton variant="secondary" onClick={() => onOpen(endpoint)} {...dataTableDefaultActionProps}>
          {mutable && endpoint.is_editable ? translate(infrastructureMessages.edit, locale) : translate(infrastructureMessages.view, locale)}
        </ListActionButton>
        {mutable && endpoint.is_editable && <ListActionButton variant="danger" disabled={pending} onClick={() => onDelete(endpoint)}>{translate(infrastructureMessages.delete, locale)}</ListActionButton>}
      </ListActions>,
    },
  ];
  const count = new Intl.NumberFormat(locale);
  const status = resolveListTableStatus({ loading, error, rowCount: endpoints.length });

  return <div className="storage-endpoint-list">
    {error && <PageBanner tone="error"><ListActions className="justify-between" role="alert">
      <span>{error}</span><ListActionButton variant="secondary" disabled={loading} onClick={onRetry}>{translate(infrastructureMessages.retry, locale)}</ListActionButton>
    </ListActions></PageBanner>}
    <ListPageSection variant="page" title={translate(infrastructureMessages.s3Endpoints, locale)}
      countLabel={loading && !endpoints.length ? translate(infrastructureMessages.loadingEndpoints, locale) : error && !endpoints.length ? translate(infrastructureMessages.endpointsUnavailable, locale) : translate({ en: `${count.format(rows.length)}${activeFilters.length ? ` of ${count.format(endpoints.length)}` : ""} endpoint${(activeFilters.length ? endpoints.length : rows.length) === 1 ? "" : "s"}`, zh: `${count.format(rows.length)}${activeFilters.length ? ` / ${count.format(endpoints.length)}` : ""} 个端点` }, locale)}
      search={<ToolbarSearchInput value={filters.query} onChange={(value) => onFiltersChange({ ...filters, query: value })}
        placeholder={translate(infrastructureMessages.searchNameURLProviderRegionOrTag, locale)} className="endpoint-search w-full sm:w-80" active={Boolean(query)} matchMode={filters.mode}
        onToggleMatchMode={() => onFiltersChange({ ...filters, mode: filters.mode === "contains" ? "exact" : "contains" })} />}
      filters={<UiSelect label={translate(infrastructureMessages.provider, locale)} size="compact" value={filters.provider}
        onChange={(event) => onFiltersChange({ ...filters, provider: event.target.value as EndpointListFilters["provider"] })}>
        <option value="all">{translate(infrastructureMessages.all, locale)}</option>{Object.entries(providers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </UiSelect>}
      secondaryContent={activeFilters.length > 0 && <ActiveFiltersBar items={activeFilters}
        onClearAll={() => onFiltersChange({ query: "", mode: "contains", provider: "all" })} />}>
      <DataTableShell columns={columns} rows={rows} rowKey={(endpoint) => endpoint.id}
        status={status === "ready" && !rows.length ? "empty" : status}
        loadingMessage={translate(infrastructureMessages.loadingEndpoints, locale)} errorMessage={translate(infrastructureMessages.unableToLoadEndpointsUseRetryToTryAgain, locale)}
        emptyMessage={endpoints.length ? translate(infrastructureMessages.noEndpointsMatchTheseFilters, locale) : translate(infrastructureMessages.noEndpointsConfiguredYet, locale)}
        primaryColumnId="endpoint" responsiveCards stickyActions={false} tableLayout="fixed"
        tableClassName="ui-data-table endpoint-table" containerClassName="rounded-t-none border-x-0 border-b-0" />
    </ListPageSection>
  </div>;
}
