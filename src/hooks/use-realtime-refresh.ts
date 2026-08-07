import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

type RealtimeRefreshOptions = {
  channelName: string;
  enabled: boolean;
  onRefresh: () => unknown | Promise<unknown>;
  tables: readonly (string | { table: string; filter?: string })[];
};

let channelSequence = 0;

/**
 * Refetches a query when one of its backing Postgres tables changes.
 * A short debounce folds multi-row/database-trigger updates into one request.
 */
export function useRealtimeRefresh({
  channelName,
  enabled,
  onRefresh,
  tables,
}: RealtimeRefreshOptions) {
  const refreshRef = useRef(onRefresh);
  const tablesRef = useRef(tables);
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables, tablesKey]);

  useEffect(() => {
    if (!enabled || tablesRef.current.length === 0) {
      return;
    }

    channelSequence += 1;
    const channel = supabase.channel(`${channelName}:${channelSequence}`);
    let refreshTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        globalThis.clearTimeout(refreshTimeout);
      }

      refreshTimeout = globalThis.setTimeout(() => {
        refreshTimeout = undefined;
        void refreshRef.current();
      }, 100);
    };

    tablesRef.current.forEach((subscription) => {
      const { table, filter } = typeof subscription === 'string'
        ? { table: subscription, filter: undefined }
        : subscription;

      if (!filter) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          scheduleRefresh,
        );
        return;
      }

      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table, filter },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table, filter },
          scheduleRefresh,
        )
        // Supabase cannot filter DELETE events. The default replica identity
        // only exposes the deleted row's primary key, then the scoped query is refetched.
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table },
          scheduleRefresh,
        );
    });

    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        scheduleRefresh();
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Realtime] ${channelName} subscription failed (${status}).`, error);
      }
    });

    return () => {
      if (refreshTimeout) {
        globalThis.clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, tablesKey]);
}
