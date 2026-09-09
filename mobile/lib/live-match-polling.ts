import { AppState } from 'react-native';

import { fetchMobileQuery } from '@/lib/api-client';

type Listener<T> = { onData?: (data: T) => void; onError?: () => void; onLoading?: (loading: boolean) => void };
type Channel = {
  listeners: Set<Listener<unknown>>;
  data?: unknown;
  request?: Promise<void>;
  controller?: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  appState?: ReturnType<typeof AppState.addEventListener>;
};
const channels = new Map<string, Channel>();
const POLL_MS = 10_000;

/** The feed and notification trigger share one public request per match. */
export function subscribeLiveMatch<T>(matchId: string, listener: Listener<T> = {}) {
  let channel = channels.get(matchId);
  if (!channel) {
    channel = { listeners: new Set() };
    channels.set(matchId, channel);
  }
  const current = channel;
  const subscriber = listener as Listener<unknown>;
  current.listeners.add(subscriber);

  const stopTimer = () => {
    if (current.timer !== undefined) clearTimeout(current.timer);
    current.timer = undefined;
  };
  const load = () => {
    if (current.request) return current.request;
    if (current.listeners.size === 0 || AppState.currentState !== 'active') return Promise.resolve();
    stopTimer();
    current.controller = new AbortController();
    current.listeners.forEach((item) => item.onLoading?.(true));
    const path = `/api/mobile/v1/matches/${encodeURIComponent(matchId)}/live`;
    current.request = fetchMobileQuery<unknown>(path, path, false, false, { signal: current.controller.signal, cancelOnUnused: true })
      .then((data) => {
        current.data = data;
        if (AppState.currentState === 'active') current.listeners.forEach((item) => item.onData?.(data));
      })
      .catch(() => {
        if (AppState.currentState === 'active') current.listeners.forEach((item) => item.onError?.());
      })
      .finally(() => {
        current.request = undefined;
        current.listeners.forEach((item) => item.onLoading?.(false));
        if (current.listeners.size > 0 && AppState.currentState === 'active') {
          current.timer = setTimeout(() => { void load(); }, POLL_MS);
        }
      });
    return current.request;
  };

  if (!current.appState) {
    current.appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
      else stopTimer();
    });
  }
  if (current.data !== undefined) subscriber.onData?.(current.data);
  subscriber.onLoading?.(Boolean(current.request));
  // An additional consumer uses the running request or latest snapshot, and
  // does not reset the polling cadence established by the first consumer.
  if (!current.request && current.timer === undefined) void load();

  return {
    refresh: load,
    unsubscribe() {
      current.listeners.delete(subscriber);
      if (current.listeners.size !== 0) return;
      stopTimer();
      current.appState?.remove();
      current.controller?.abort();
      channels.delete(matchId);
    },
  };
}
