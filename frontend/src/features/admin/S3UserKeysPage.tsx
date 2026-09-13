/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  messageStatus,
  messageSecretKey,
} from "../../uiMessages";
import {
  adminRgwAdmin,
  adminRgwRGWUsers,
  adminRgwUnexpectedError,
  adminRgwUser,
  adminRgwAccessKey,
  adminRgwActions,
  adminRgwSaving,
  adminRgwDeleting,
  adminRgwDelete,
  adminRgwUserAccessKeys,
  adminRgwAccessKeys,
  adminRgwCreating,
  adminRgwCopy,
  adminRgwKeys,
} from "./adminRgwMessages";
import type { PageBreadcrumb } from "../../components/PageHeader";
import { useI18n } from "../../i18n";
import { ListActions, ListBadge, ListActionButton } from "../../components/list/ListControls";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CreatedS3UserAccessKey,
  S3User,
  S3UserAccessKey,
  createS3UserKey,
  deleteS3UserKey,
  getS3User,
  listS3UserKeys,
  rotateS3UserKeys,
  updateS3UserKeyStatus,
} from "../../api/s3Users";
import OneTimeSecretPanel from "../../components/OneTimeSecretPanel";
import PageShell from "../../components/PageShell";
import { adminPageBreadcrumbs } from "./adminBreadcrumbs";
import PageBanner from "../../components/PageBanner";
import ListPageSection from "../../components/list/ListPageSection";
import DataTableShell, { type DataTableColumn } from "../../components/list/DataTableShell";
import { resolveListTableStatus } from "../../components/list/listTableStatus";

import { cx } from "../../components/ui/styles";
import { extractApiError } from "../../utils/apiError";
import { useConfirmActionDialog } from "../../components/useConfirmActionDialog";

export default function S3UserKeysPage() {
  const { t, locale } = useI18n();
  const rgwBreadcrumbs = (...trailing: PageBreadcrumb[]) => adminPageBreadcrumbs("rgw-users", ...trailing).map((crumb, index) => ({ ...crumb, label: index === 0 ? t(adminRgwAdmin) : index === 1 ? t(adminRgwRGWUsers) : crumb.label }));
  const { userId } = useParams<{ userId: string }>();
  const numericUserId = userId ? Number(userId) : NaN;
  const [user, setUser] = useState<S3User | null>(null);
  const [keys, setKeys] = useState<S3UserAccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedS3UserAccessKey | null>(null);
  const keyConfirmation = useConfirmActionDialog();

  const extractError = useCallback((err: unknown): string => extractApiError(err, t(adminRgwUnexpectedError)), [t]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
  };

  const loadUser = useCallback(async () => {
    if (!Number.isFinite(numericUserId)) return;
    try {
      const data = await getS3User(numericUserId);
      setUser(data);
    } catch (err) {
      setError(extractError(err));
    }
  }, [extractError, numericUserId]);

  const loadKeys = useCallback(async () => {
    if (!Number.isFinite(numericUserId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listS3UserKeys(numericUserId);
      setKeys(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [extractError, numericUserId]);

  useEffect(() => {
    if (!Number.isFinite(numericUserId)) {
      setError(t({
        en: "Invalid user id.",
        fr: "Identifiant utilisateur invalide.",
        de: "Ungültige Benutzer-ID.",
        zh: "用户 ID 无效。",
      }));
      return;
    }
    loadUser();
    loadKeys();
  }, [loadKeys, loadUser, numericUserId, t]);

  const handleCreateKey = async () => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy("create");
    setError(null);
    setActionMessage(null);
    try {
      const key = await createS3UserKey(numericUserId);
      setCreatedKey(key);
      await loadKeys();
      setActionMessage(t({
        en: "Access key created.",
        fr: "Clé d’accès créée.",
        de: "Zugriffsschlüssel erstellt.",
        zh: "访问密钥已创建。",
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (accessKeyId: string) => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy(`delete:${accessKeyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await deleteS3UserKey(numericUserId, accessKeyId);
      await loadKeys();
      setActionMessage(t({
        en: "Access key deleted.",
        fr: "Clé d’accès supprimée.",
        de: "Zugriffsschlüssel gelöscht.",
        zh: "访问密钥已删除。",
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleKey = async (accessKeyId: string, nextActive: boolean) => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy(`toggle:${accessKeyId}`);
    setError(null);
    setActionMessage(null);
    try {
      await updateS3UserKeyStatus(numericUserId, accessKeyId, nextActive);
      await loadKeys();
      setActionMessage(nextActive ? t({
        en: "Access key enabled.",
        fr: "Clé d’accès activée.",
        de: "Zugriffsschlüssel aktiviert.",
        zh: "访问密钥已启用。",
      }) : t({
        en: "Access key disabled.",
        fr: "Clé d’accès désactivée.",
        de: "Zugriffsschlüssel deaktiviert.",
        zh: "访问密钥已禁用。",
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteKey = (accessKeyId: string) => {
    keyConfirmation.requestConfirmation({
      title: t({
        en: "Delete access key?",
        fr: "Supprimer la clé d’accès ?",
        de: "Zugriffsschlüssel löschen?",
        zh: "删除访问密钥？",
      }),
      description: t({
        en: "Permanently remove this RGW access key from the selected user.",
        fr: "Supprimer définitivement cette clé d’accès RGW de l’utilisateur sélectionné.",
        de: "Diesen RGW-Zugriffsschlüssel dauerhaft vom ausgewählten Benutzer entfernen.",
        zh: "永久删除所选用户的此 RGW 访问密钥。",
      }),
      confirmLabel: t({
        en: "Delete key",
        fr: "Supprimer la clé",
        de: "Schlüssel löschen",
        zh: "删除密钥",
      }),
      details: [
        { label: t(adminRgwUser), value: pageTitle },
        { label: t(adminRgwAccessKey), value: accessKeyId, mono: true },
      ],
      impacts: [t({
        en: "Applications using this key will immediately lose access.",
        fr: "Les applications utilisant cette clé perdront immédiatement leur accès.",
        de: "Anwendungen, die diesen Schlüssel verwenden, verlieren sofort den Zugriff.",
        zh: "使用此密钥的应用将立即失去访问权限。",
      })],
      onConfirm: () => deleteKey(accessKeyId),
    });
  };

  const handleToggleKey = (accessKeyId: string, nextActive: boolean) => {
    if (nextActive) {
      void toggleKey(accessKeyId, true);
      return;
    }
    keyConfirmation.requestConfirmation({
      title: t({
        en: "Disable access key?",
        fr: "Désactiver la clé d’accès ?",
        de: "Zugriffsschlüssel deaktivieren?",
        zh: "禁用访问密钥？",
      }),
      description: t({
        en: "Temporarily prevent this RGW access key from authenticating.",
        fr: "Empêcher temporairement cette clé d’accès RGW de s’authentifier.",
        de: "Die Authentifizierung mit diesem RGW-Zugriffsschlüssel vorübergehend verhindern.",
        zh: "暂时禁止使用此 RGW 访问密钥进行认证。",
      }),
      confirmLabel: t({
        en: "Disable key",
        fr: "Désactiver la clé",
        de: "Schlüssel deaktivieren",
        zh: "禁用密钥",
      }),
      details: [
        { label: t(adminRgwUser), value: pageTitle },
        { label: t(adminRgwAccessKey), value: accessKeyId, mono: true },
      ],
      impacts: [t({
        en: "Applications using this key will lose access until the key is enabled again.",
        fr: "Les applications utilisant cette clé perdront leur accès jusqu’à sa réactivation.",
        de: "Anwendungen verlieren den Zugriff, bis dieser Schlüssel wieder aktiviert wird.",
        zh: "使用此密钥的应用将失去访问权限，直到密钥重新启用。",
      })],
      onConfirm: () => toggleKey(accessKeyId, false),
    });
  };

  const handleRotateUiKey = async () => {
    if (!Number.isFinite(numericUserId)) return;
    setBusy("rotate");
    setError(null);
    setActionMessage(null);
    try {
      await rotateS3UserKeys(numericUserId);
      await Promise.all([loadUser(), loadKeys()]);
      setActionMessage(t({
        en: "Interface key rotated.",
        fr: "Clé de l’interface renouvelée.",
        de: "Oberflächenschlüssel rotiert.",
        zh: "界面密钥已轮换。",
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(null);
    }
  };

  const pageTitle = useMemo(() => {
    if (user?.name) return user.name;
    if (userId) return t({
      en: `User #${userId}`,
      fr: `Utilisateur n° ${userId}`,
      de: `Benutzer #${userId}`,
      zh: `用户 #${userId}`,
    });
    return t(adminRgwUser);
  }, [t, user?.name, userId]);

  const interfaceKey = keys.find((k) => k.is_ui_managed);
  const tableStatus = resolveListTableStatus({
    loading,
    error,
    rowCount: keys.length,
  });
  const keyTableColumns: Array<DataTableColumn<S3UserAccessKey>> = [
    {
      id: "access-key",
      label: t(adminRgwAccessKey),
      primary: true,
      mobileRole: "primary",
      cellClassName: "font-mono",
      render: (key) => key.access_key_id,
    },
    {
      id: "status",
      label: t(messageStatus),
      cellClassName: "text-slate-700 dark:text-slate-200",
      render: (key) => (key.is_active ? t({
        en: "Active",
        fr: "Actif",
        de: "Aktiv",
        zh: "已启用",
      }) : t({
        en: "Disabled",
        fr: "Désactivé",
        de: "Deaktiviert",
        zh: "已禁用",
      })),
    },
    { id: "created", label: t({
      en: "Created on",
      fr: "Créé le",
      de: "Erstellt am",
      zh: "创建时间",
    }), render: (key) => formatDate(key.created_at) },
    {
      id: "usage",
      label: t({
        en: "Usage",
        fr: "Utilisation",
        de: "Auslastung",
        zh: "用途",
      }),
      render: (key) =>
        key.is_ui_managed ? (
          <ListBadge tone="neutral">
            {t({
              en: "Interface key",
              fr: "Clé de l’interface",
              de: "Oberflächenschlüssel",
              zh: "界面密钥",
            })}</ListBadge>
        ) : (
          <span className="ui-caption text-slate-500 dark:text-slate-400">{t({
            en: "Custom",
            fr: "Personnalisé",
            de: "Benutzerdefiniert",
            zh: "自定义",
          })}</span>
        ),
    },
    {
      id: "actions",
      label: t(adminRgwActions),
      align: "right",
      mobileRole: "actions",
      render: (key) =>
        key.is_ui_managed ? (
          <ListActionButton
            type="button"
            onClick={handleRotateUiKey}
            disabled={busy === "rotate"}
          >
            {busy === "rotate" ? t({
              en: "Rotating...",
              fr: "Rotation…",
              de: "Wird rotiert…",
              zh: "正在轮换…",
            }) : t({
              en: "Rotate",
              fr: "Renouveler",
              de: "Rotieren",
              zh: "轮换",
            })}
          </ListActionButton>
        ) : (
          <ListActions>
            <ListActionButton
              type="button"
              onClick={() => handleToggleKey(key.access_key_id, !key.is_active)}
              disabled={Boolean(busy)}
            >
              {busy === `toggle:${key.access_key_id}` ? t(adminRgwSaving) : key.is_active ? t({
                en: "Disable",
                fr: "Désactiver",
                de: "Deaktivieren",
                zh: "禁用",
              }) : t({
                en: "Enable",
                fr: "Activer",
                de: "Aktivieren",
                zh: "启用",
              })}
            </ListActionButton>
            <ListActionButton
              type="button"
              onClick={() => handleDeleteKey(key.access_key_id)}
               variant="danger"
              disabled={Boolean(busy)}
            >
              {busy === `delete:${key.access_key_id}` ? t(adminRgwDeleting) : t(adminRgwDelete)}
            </ListActionButton>
          </ListActions>
        ),
    },
  ];

  if (!userId || Number.isNaN(numericUserId)) {
    return (
      <PageShell actionPresentation="listing"
        title={t(adminRgwUserAccessKeys)}
        description={t({
          en: "Manage RGW keys for the selected user.",
          fr: "Gérez les clés RGW de l’utilisateur sélectionné.",
          de: "RGW-Schlüssel des ausgewählten Benutzers verwalten.",
          zh: "管理所选用户的 RGW 密钥。",
        })}
        breadcrumbs={rgwBreadcrumbs({ label: t(adminRgwAccessKeys) })}
      >
        <PageBanner tone="error">{t({
          en: "Invalid user id provided.",
          fr: "L’identifiant utilisateur fourni est invalide.",
          de: "Die angegebene Benutzer-ID ist ungültig.",
          zh: "提供的用户 ID 无效。",
        })}</PageBanner>
      </PageShell>
    );
  }

  return (
    <PageShell actionPresentation="listing"
      title={t(adminRgwUserAccessKeys)}
      description={
        <>
          {t({
            en: `Manage keys for ${pageTitle}.`,
            fr: `Gérez les clés de ${pageTitle}.`,
            de: `Schlüssel für ${pageTitle} verwalten.`,
            zh: `管理 ${pageTitle} 的密钥。`,
          })}
        </>
      }
      breadcrumbs={rgwBreadcrumbs({ label: pageTitle }, { label: t(adminRgwAccessKeys) })}
      actions={[
        { label: t({
          en: "← Back to users",
          fr: "← Retour aux utilisateurs",
          de: "← Zurück zu Benutzern",
          zh: "← 返回用户",
        }), to: "/admin/s3-users", variant: "ghost" },
        {
          label: busy === "create" ? t(adminRgwCreating) : t({
            en: "New key",
            fr: "Nouvelle clé",
            de: "Neuer Schlüssel",
            zh: "新建密钥",
          }),
          onClick: handleCreateKey,
          variant: "primary",
        },
      ]}
    >

      {interfaceKey && (
        <PageBanner tone="info">
          {t({
            en: "The interface key is reserved for the console. Delete other keys as needed, and rotate the interface key instead of deleting it.",
            fr: "La clé de l’interface est réservée à la console. Supprimez les autres clés si nécessaire et renouvelez celle de l’interface au lieu de la supprimer.",
            de: "Der Oberflächenschlüssel ist für die Konsole reserviert. Löschen Sie andere Schlüssel bei Bedarf und rotieren Sie den Oberflächenschlüssel, statt ihn zu löschen.",
            zh: "界面密钥专供控制台使用。可按需删除其他密钥；对于界面密钥，请使用轮换而非删除。",
          })}</PageBanner>
      )}

      {error && <PageBanner tone="error">{error}</PageBanner>}
      {actionMessage && <PageBanner tone="success">{actionMessage}</PageBanner>}

      {createdKey && createdKey.secret_access_key && (
        <OneTimeSecretPanel
          title={t({
            en: `Key created for ${pageTitle}`,
            fr: `Clé créée pour ${pageTitle}`,
            de: `Schlüssel für ${pageTitle} erstellt`,
            zh: `已为 ${pageTitle} 创建密钥`,
          })}
          description={t({
            en: "The secret is shown only once.",
            fr: "Le secret n’est affiché qu’une seule fois.",
            de: "Der geheime Schlüssel wird nur einmal angezeigt.",
            zh: "秘密密钥仅显示一次。",
          })}
          badge={t({
            en: "Copy these values now",
            fr: "Copiez ces valeurs maintenant",
            de: "Diese Werte jetzt kopieren",
            zh: "请立即复制这些值",
          })}
          values={[
            { label: t(adminRgwAccessKey), value: createdKey.access_key_id, copyLabel: t(adminRgwCopy) },
            { label: t(messageSecretKey), value: createdKey.secret_access_key, copyLabel: t(adminRgwCopy) },
          ]}
        />
      )}

      <ListPageSection variant="page"
        title={t(adminRgwKeys)}
        countLabel={t({
          en: `${keys.length} key${keys.length === 1 ? "" : "s"}`,
          fr: `${keys.length} clé${keys.length === 1 ? "" : "s"}`,
          de: `${keys.length} Schlüssel`,
          zh: `${keys.length} 个密钥`,
        })}
      >
        <DataTableShell
          responsiveCards
          columns={keyTableColumns}
          rows={keys}
          rowKey={(key) => key.access_key_id}
          rowClassName={(key) =>
            cx("hover:bg-slate-50 dark:hover:bg-slate-800/50", !key.is_active && "bg-slate-50/70 dark:bg-slate-900/40")
          }
          status={tableStatus}
          loadingMessage={t({
            en: "Loading keys...",
            fr: "Chargement des clés…",
            de: "Schlüssel werden geladen…",
            zh: "正在加载密钥…",
          })}
          errorMessage={t({
            en: "Unable to load keys.",
            fr: "Impossible de charger les clés.",
            de: "Schlüssel konnten nicht geladen werden.",
            zh: "无法加载密钥。",
          })}
          emptyMessage={t({
            en: "No keys for this user.",
            fr: "Aucune clé pour cet utilisateur.",
            de: "Keine Schlüssel für diesen Benutzer.",
            zh: "此用户没有密钥。",
          })}
          tableLayout="fixed"
        />
      </ListPageSection>
      {keyConfirmation.confirmationDialog}
    </PageShell>
  );
}
