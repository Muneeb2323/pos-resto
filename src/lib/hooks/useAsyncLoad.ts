"use client";

import * as React from "react";

/**
 * Run an async loader on mount, and again whenever the loader identity changes.
 *
 * Two things this does that a bare `useEffect(() => { load(); }, [load])` does not:
 *
 *  - The call is deferred to a microtask, so the loader's `setLoading(true)` lands in
 *    a follow-up commit instead of cascading out of the render that scheduled it.
 *  - A load in flight when the component unmounts (or when the loader changes) is
 *    abandoned, so a slow response cannot write into a screen the cashier has left.
 *
 * The loader itself stays available for manual refreshes - pass the same
 * `useCallback` to a refresh button.
 */
export function useAsyncLoad(load: () => Promise<unknown>): void {
  React.useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      return load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);
}
