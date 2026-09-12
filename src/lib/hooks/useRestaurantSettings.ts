"use client";

import * as React from "react";

export interface RestaurantSettings {
  restaurantName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  taxRate?: number | string;
  receiptHeader?: string;
  receiptFooter?: string;
  onlinePaymentInfo?: string | null;
  printerName?: string;
  paperWidth?: number;
}

/**
 * Restaurant settings for client components that only need to read them.
 *
 * Fetched once per page load and shared by every caller, so opening a receipt modal
 * repeatedly does not re-request the same row. `invalidateRestaurantSettings()` drops
 * the cache after the Settings screen saves.
 */
let cached: Promise<RestaurantSettings | null> | null = null;

function load(): Promise<RestaurantSettings | null> {
  if (!cached) {
    cached = fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return cached;
}

export function invalidateRestaurantSettings() {
  cached = null;
}

export function useRestaurantSettings(): RestaurantSettings | null {
  const [settings, setSettings] = React.useState<RestaurantSettings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void load().then((value) => {
      if (!cancelled) setSettings(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
