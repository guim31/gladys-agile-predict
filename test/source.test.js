// -----------------------------------------------------------------------------
// The source: the real AgilePredict answers, an empty region, the failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchForecast, parseForecast, SourceError } from '../src/source.js';
import { AT, createFakeSource } from './helpers/world.js';

const now = new Date(AT).getTime();

test('the real answer becomes 385 half-hour slots in p/kWh, with its date', async () => {
  const source = createFakeSource();
  const { slots, createdAt } = await fetchForecast('A', { fetch: source.fetch, now });
  assert.equal(slots.length, 385);
  const [first] = slots;
  assert.equal(first.start.toISOString(), '2026-11-19T15:30:00.000Z');
  assert.equal(first.end.toISOString(), '2026-11-19T16:00:00.000Z');
  assert.equal(first.price, 43.69);
  assert.equal(slots.at(-1).start.toISOString(), '2026-11-27T15:30:00.000Z');
  assert.equal(createdAt.toISOString(), '2026-11-19T16:16:18.563Z');
  assert.equal(source.requests[0].url.href, 'https://agilepredict.com/api/A?days=8');
  const p = await fetchForecast('P', { fetch: source.fetch, now });
  assert.equal(p.slots[0].price, 50.41);
});

test('broken entries are skipped, an empty or foreign body is an error', () => {
  const { slots, createdAt } = parseForecast(
    [
      {
        created_at: 'not a date',
        prices: [
          { date_time: '2026-11-19T17:00:00Z', agile_pred: 12.5 },
          { date_time: '2026-11-19T17:30:00Z', agile_pred: null },
          { date_time: 'x', agile_pred: 2 },
          { date_time: '2026-11-19T17:31:00Z', agile_pred: 2 },
          { date_time: '2026-11-19T18:00:00Z', agile_pred: -1.25 },
          { date_time: '2026-11-19T17:00:00Z', agile_pred: 12.5 },
          null,
        ],
      },
    ],
    now,
  );
  assert.deepEqual(
    slots.map((slot) => slot.price),
    [12.5, -1.25],
  );
  assert.equal(createdAt, null);
  // An unknown region: the real API answers 200 with an empty list.
  assert.throws(() => parseForecast([{ name: 'Region | I', prices: [] }], now), /empty/);
  assert.throws(() => parseForecast([], now), /no price list/);
  assert.throws(() => parseForecast({ detail: 'Not found' }, now), SourceError);
  // A forecast from another age is not a forecast.
  assert.throws(
    () => parseForecast([{ prices: [{ date_time: '2020-01-01T00:00:00Z', agile_pred: 1 }] }], now),
    /empty/,
  );
});

test('HTTP errors, non-JSON, unknown regions and network failures say why, without the URL', async () => {
  const source = createFakeSource();
  await assert.rejects(fetchForecast('I', { fetch: source.fetch, now }), /unknown region I/);
  assert.equal(source.requests.length, 0);
  await assert.rejects(fetchForecast('K', { fetch: source.fetch, now }), /empty/);
  source.status = 429;
  await assert.rejects(fetchForecast('A', { fetch: source.fetch, now }), /HTTP 429/);
  source.status = 200;
  source.bodies.A = '<html>maintenance</html>';
  await assert.rejects(fetchForecast('A', { fetch: source.fetch, now }), /not JSON/);
  source.down = true;
  await assert.rejects(fetchForecast('A', { fetch: source.fetch, now }), (err) => {
    assert.ok(err instanceof SourceError);
    assert.equal(err.message, 'forecast unreachable (ENOTFOUND)');
    return true;
  });
});
