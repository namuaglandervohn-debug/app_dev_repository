import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

type LiveModuleRefreshOptions = {
  enabled: boolean;
  channelName: string;
  tables: string[];
  refresh: () => void | Promise<void>;
};

/**
 * Keeps a read-only operational screen current while it is open. Database
 * policies still decide which rows reach the signed-in user; this hook only
 * asks the current screen to reload when one of its source tables changes.
 */
export function useLiveModuleRefresh({
  enabled,
  channelName,
  tables,
  refresh,
}: LiveModuleRefreshOptions) {
  const refreshRef = useRef(refresh);
  const tablesKey = tables.join('|');

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void refreshRef.current();
      }, 350);
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') queueRefresh();
    };

    let channel = supabase.channel(channelName);
    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        queueRefresh,
      );
    });
    channel.subscribe();

    window.addEventListener('focus', queueRefresh);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('focus', queueRefresh);
      document.removeEventListener('visibilitychange', refreshOnVisible);
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, tablesKey]);
}
