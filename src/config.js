// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with unknown values.
// -----------------------------------------------------------------------------

import { REGIONS } from './source.js';

/** The languages every text carries, in this order. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The choices of the cheapest window shown by the device (select values). */
export const WINDOW_HOURS = ['0.5', '1', '1.5', '2', '3', '4', '5', '6', '8'];
export const WINDOW_HORIZONS = ['12', '24', '48', '72', '168'];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Language of the feature names and of the texts the container writes
  // (a device integration is not told the user's language).
  language: 'fr',
  // The regions to follow, one device each. None by default: the user picks
  // the region of their meter (a wrong default would publish a wrong device).
  regions: [],
  // The cheapest window the devices show: this many consecutive hours...
  window_hours: '3',
  // ...searched in the next hours.
  window_horizon: '24',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pick = (key, allowed) =>
    allowed.includes(String(raw[key])) ? String(raw[key]) : DEFAULT_CONFIG[key];
  const asked = Array.isArray(raw.regions) ? raw.regions.map(String) : [];
  return {
    language: pick('language', LANGUAGES),
    // In the order of REGIONS, whatever order the core stores them in.
    regions: REGIONS.filter((region) => asked.includes(region)),
    windowHours: Number(pick('window_hours', WINDOW_HOURS)),
    windowHorizon: Number(pick('window_horizon', WINDOW_HORIZONS)),
  };
}
