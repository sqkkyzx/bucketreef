/*
 * Copyright (c) 2025 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import { useI18n } from "../../i18n";
import { isApiError } from "../../api/client";
import { useCallback, useEffect, useState } from "react";
import { fetchAdminS3UserStats, ManagerStats } from "../../api/stats";

type UseAdminS3UserStatsResult = {
  stats: ManagerStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useAdminS3UserStats(
  userId: number | null,
  enabled: boolean = true,
  refreshKey?: string | null
): UseAdminS3UserStatsResult {
  const { t } = useI18n();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || userId == null) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setStats(null);
    try {
      const data = await fetchAdminS3UserStats(userId);
      setStats(data);
      setError(null);
    } catch (err) {
      let message = t({
        en: "Unable to load storage stats.",
        fr: "Impossible de charger les statistiques de stockage.",
        de: "Speicherstatistiken konnten nicht geladen werden.",
        zh: "无法加载存储统计。",
      });
      if (isApiError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string" && detail.trim()) {
          message = detail;
        } else if (err.response?.status === 403) {
          message = t({
            en: "Storage metrics are not available for this user.",
            fr: "Les métriques de stockage ne sont pas disponibles pour cet utilisateur.",
            de: "Für diesen Benutzer sind keine Speichermetriken verfügbar.",
            zh: "此用户的存储指标不可用。",
          });
        }
      }
      setError(message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return { stats, loading, error, reload: load };
}
