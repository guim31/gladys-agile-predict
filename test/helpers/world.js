// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake AgilePredict serving
// the real forecasts of 19 November 2026 (regions A and P), a settable clock
// and a temporary /data, with the integration wired on top through
// createApp — the very wiring index.js uses.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/source/${name}`, import.meta.url), 'utf8'));

/**
 * Read on 19 November 2026 from https://agilepredict.com/api/{A,P}?days=8:
 * the forecast made at 16:16 UTC, 385 half-hours from 19 Nov 15:30 UTC to
 * 27 Nov 16:00 UTC, p/kWh with VAT.
 */
export const FIXTURES = {
  A: fixture('region-A.json'),
  P: fixture('region-P.json'),
};

/** 19 November 2026, 17:10 in London (GMT = UTC), after the 16:16 forecast. */
export const AT = '2026-11-19T17:10:00Z';

/**
 * A fake AgilePredict. `source.bodies[region]` is what /api/{region} serves
 * (regions without a fixture answer an empty forecast, like the real API),
 * `source.status` its status, `source.down` makes every request fail like an
 * unreachable host.
 */
export function createFakeSource() {
  const source = {
    bodies: { ...FIXTURES },
    status: 200,
    down: false,
    requests: [],
    async fetch(url, init) {
      const parsed = new URL(url);
      source.requests.push({ url: parsed, headers: init?.headers ?? {} });
      if (source.down) {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      }
      const region = parsed.pathname.split('/').filter(Boolean).at(-1);
      const body = source.bodies[region] ?? [
        { name: `Region | ${region}`, created_at: '2026-11-19T16:16:18.563039Z', prices: [] },
      ];
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      return new Response(text, {
        status: source.status,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    /** Requests for one region. */
    reads(region = 'A') {
      return source.requests.filter((request) => request.url.pathname.endsWith(`/${region}`));
    },
  };
  return source;
}

/** A clock the test moves by hand. */
export function createClock(iso = AT) {
  let current = new Date(iso).getTime();
  return {
    now: () => current,
    set(next) {
      current = new Date(next).getTime();
    },
    advance(ms) {
      current += ms;
    },
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {boolean} [options.created] the user already added the devices
 * @param {string} [options.at] the clock, ISO
 * @param {boolean} [options.connect]
 * @param {string} [options.dataDir]
 * @param {(source: ReturnType<typeof createFakeSource>) => void} [options.prepare]
 */
export async function createWorld({
  config = { regions: ['A'] },
  created = true,
  at = AT,
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-agile-predict-')),
  prepare,
} = {}) {
  const source = createFakeSource();
  prepare?.(source);
  const clock = createClock(at);
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { fetch: source.fetch, now: clock.now, timers: false, dataDir });
  const world = { gladys, source, clock, app, dataDir };
  if (created) {
    // The devices as the user added them, before the integration connects.
    const { buildDevice } = await import('../../src/device.js');
    const { normalizeConfig } = await import('../../src/config.js');
    const normalized = normalizeConfig(config);
    gladys.fake.devices = normalized.regions.map((region) =>
      buildDevice(gladys, region, normalized),
    );
  }
  if (connect) {
    await gladys.connect();
  }
  return world;
}

/** External id of a feature of a region's device. */
export const featureId = (gladys, key, region = 'A') =>
  gladys.externalIds('agile-predict', region.toLowerCase()).feature(key);

/** The last state of a feature: a number, or the text of a text feature. */
export function last(gladys, key, region = 'A') {
  const id = featureId(gladys, key, region);
  const states = gladys.fake.states.filter((s) => s.device_feature_external_id === id);
  const state = states.at(-1);
  return state === undefined ? undefined : (state.text ?? state.state);
}
